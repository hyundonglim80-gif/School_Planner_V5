// V4 수업 → V5 (DESIGN 8-3 수업 줄) - 순수 함수. 읽기는 read.ts, 적기는 run.ts.
//
//   settings/timetable_v5.templates      → timetables (기간)   V4는 이름 붙은 표를 날짜 범위에 '적용'(schedules에 베낌)했다 - 어느 표를 언제 썼는지는 남지 않는다.
//                                                                그래서 학기마다 그 학기의 schedules와 가장 많이 맞는 표(과목 칸의 절반 넘게)를 그 학기 시간표로 본다(학년도 끝까지 - 늦게 시작한 것이 이긴다).
//                                                                어느 학기에도 맞지 않은 표는 이름에 '1학기'·'2학기'가 있으면 올해 그 학기(비어 있으면), 아니면 기간 없이(적용 안 됨) - 빈 표는 가져오지 않는다.
//   settings/timetable_v5.semesterConfig → settings/common.terms (설정 가져오기 - settings.ts)
//   {sp}/schedules/{date}                → lessonDays         **그날 시간표와 같은 칸은 뺀다**(과목이 같고 메모·준비물·첨부·링크가 없으면) - 그래야 시간표를 고치면 따라간다.
//                                                                V4에 칸이 없는데 시간표에 과목이 있으면 subject '' (V4는 비어 보였다). 수업 없는 날(방학·공휴일·수업X)은 시간표가 없으니 과목을 그대로 적는다.
//                                                                memo는 memo(없으면 옛 content), 옛 문자열 값('국어')도 읽는다. linkedItems → linkIds(items의 짝 표로).
//                                                                V4에서 없어진 날 문서는 칸을 비운다(날짜 문서는 지우지 않는다 - 지운 표시를 수업 칸 셈이 보지 않는다).
//   {sp}/v4_progress/{id}                → progress           모양 그대로(sanitizePlan)
import { academicYearOf, isValidDateStr, weekdayOf } from '../../domain/dateUtils';
import { timetableOn, type TimetableLike } from '../../domain/lessons';
import { sanitizePlan } from '../../domain/progress';
import { schoolYearSpan, semesterSpan, type SemesterConfig } from '../../domain/semester';
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { Attachment, ImportSource, LessonPeriod, Stored, TimetableGrid } from '../../data/types';
import { v4id } from './ids';
import { linkIdsOf } from './items';
import { emptyCounts, fingerprint, planDocs, tally, untouched, type ImportCounts, type Planned } from './plan';

/** 읽어 온 V4 문서들 (공간 밑) */
export interface V4LessonDocs {
  /** settings/timetable_v5 */
  timetable?: unknown;
  /** 날짜 → schedules/{date} */
  schedules: Readonly<Record<string, unknown>>;
  /** id → v4_progress/{id} */
  progress: Readonly<Record<string, unknown>>;
}

export interface LessonsPlan {
  ops: WriteOp[];
  counts: { timetables: ImportCounts; lessonDays: ImportCounts; progress: ImportCounts };
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const WEEK: Record<string, string> = { mon: '1', tue: '2', wed: '3', thu: '4', fri: '5' };

export interface V4Template {
  name: string;
  grid: TimetableGrid;
  names: string[];
}

/** timetable_v5.templates → 이름·표(요일 '1'~'5' → 교시 → 과목) - 빈 칸은 뺀다 */
export function v4Templates(doc: unknown): V4Template[] {
  const templates = isObj(doc) && isObj(doc.templates) ? doc.templates : {};
  return Object.entries(templates).map(([name, t]) => {
    const o = isObj(t) ? t : {};
    const data = isObj(o.data) ? o.data : {};
    const grid: TimetableGrid = {};
    for (const [key, wd] of Object.entries(WEEK)) {
      const day = isObj(data[key]) ? (data[key] as Raw) : {};
      for (const [n, v] of Object.entries(day)) {
        const subject = str(v).trim();
        if (subject && /^\d+$/.test(n)) (grid[wd] ||= {})[String(Number(n))] = subject;
      }
    }
    return { name: name.trim() || '시간표', grid, names: Array.isArray(o.names) ? o.names.map(str) : [] };
  });
}

/** V4 방학 설정 (없으면 null) */
export function v4SemesterConfig(doc: unknown): SemesterConfig | null {
  const c = isObj(doc) && isObj(doc.semesterConfig) ? doc.semesterConfig : null;
  if (!c) return null;
  const s = (k: string) => (isValidDateStr(str(c[k])) ? str(c[k]) : '');
  return { summerStart: s('summerStart'), summerEnd: s('summerEnd'), winterStart: s('winterStart'), winterEnd: s('winterEnd') };
}

/** 칸 하나 (V4 새 모양·옛 문자열) */
interface V4Cell {
  subject: string;
  memo: string;
  supplies: string;
  attachments: Attachment[];
  links: unknown[];
}

function cellOf(v: unknown): V4Cell | null {
  if (typeof v === 'string') return { subject: v.trim(), memo: '', supplies: '', attachments: [], links: [] };
  if (!isObj(v)) return null;
  const attachments: Attachment[] = [];
  if (Array.isArray(v.attachments)) {
    for (const a of v.attachments) if (isObj(a) && str(a.url)) attachments.push({ ...(a as unknown as Attachment), name: str(a.name) || '첨부', type: str(a.type) || 'file' });
  }
  return {
    subject: str(v.subject).trim(),
    memo: str(v.memo) || str(v.content),
    supplies: str(v.supplies),
    attachments,
    links: Array.isArray(v.linkedItems) ? v.linkedItems : [],
  };
}

/** schedules/{date}.periods → 교시 → 칸 */
export function v4Cells(doc: unknown): Record<string, V4Cell> {
  const periods = isObj(doc) && isObj(doc.periods) ? doc.periods : {};
  const out: Record<string, V4Cell> = {};
  for (const [k, v] of Object.entries(periods)) {
    const n = Number(k);
    const c = cellOf(v);
    if (Number.isInteger(n) && n >= 1 && n <= 20 && c) out[String(n)] = c;
  }
  return out;
}

export interface TimetableRange {
  template: V4Template;
  from: string;
  to: string;
}

/**
 * 표마다 기간을 정한다. 학기마다(그 학기에 V4 수업 문서가 있으면) 과목이 가장 많이 맞는 표가 그 학기 시간표 - 같은 학년도에 같은 표면 한 장으로.
 * 기간 = 처음 맞은 학기의 시작 ~ 학년도 끝 (다음 학기에 다른 표가 시작하면 그 표가 이긴다).
 */
export function timetableRanges(templates: readonly V4Template[], cells: Readonly<Record<string, Record<string, V4Cell>>>, cfg: SemesterConfig | null, today: string): TimetableRange[] {
  const used = templates.filter((t) => Object.keys(t.grid).length > 0);
  // 학년도·학기 → 그 학기의 날
  const bySem = new Map<string, string[]>();
  for (const date of Object.keys(cells).sort()) {
    const wd = weekdayOf(date);
    if (wd < 1 || wd > 5) continue;
    const y = academicYearOf(date);
    const sem = date <= semesterSpan(y, 1, cfg).end ? 1 : 2;
    const key = `${y}|${sem}`;
    (bySem.get(key) ?? bySem.set(key, []).get(key)!).push(date);
  }
  // 학기마다 가장 많이 맞는 표 - 그 학기 과목 칸의 절반 넘게 맞을 때만(우연히 몇 칸 맞는 표를 시간표로 보지 않는다)
  const picked = new Map<string, V4Template>();
  for (const [key, dates] of bySem) {
    const filled = dates.reduce((n, d) => n + Object.values(cells[d]).filter((c) => c.subject).length, 0);
    let best: V4Template | null = null;
    let bestScore = Math.floor(filled / 2);
    for (const t of used) {
      let score = 0;
      for (const date of dates) {
        const row = t.grid[String(weekdayOf(date))] ?? {};
        for (const [n, c] of Object.entries(cells[date])) if (c.subject && row[n] === c.subject) score++;
      }
      if (score > bestScore) {
        best = t;
        bestScore = score;
      }
    }
    if (best) picked.set(key, best);
  }
  // 어느 학기에도 맞지 않은 표: 이름의 '1학기'·'2학기'로 올해 그 학기 (비어 있으면)
  const thisYear = academicYearOf(today);
  for (const t of used) {
    if ([...picked.values()].includes(t)) continue;
    const sem = /2\s*학기/.test(t.name) ? 2 : /1\s*학기/.test(t.name) ? 1 : 0;
    const key = `${thisYear}|${sem}`;
    if (sem && !picked.has(key)) picked.set(key, t);
  }
  // 학년도마다 표 한 장 (처음 맞은 학기부터 학년도 끝까지)
  const out: TimetableRange[] = [];
  const seen = new Set<string>();
  for (const key of [...picked.keys()].sort()) {
    const t = picked.get(key)!;
    const [y, sem] = key.split('|').map(Number);
    const id = `${t.name}|${y}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ template: t, from: semesterSpan(y, sem as 1 | 2, cfg).start, to: schoolYearSpan(y).end });
  }
  // 기간 없이 (적용 안 됨 - 시간표 창에서 기간을 정하면 쓰인다)
  for (const t of used) if (!out.some((r) => r.template === t)) out.push({ template: t, from: '', to: '' });
  return out;
}

const timetableId = (sid: string, r: TimetableRange) => v4id('timetable', sid, 'settings/timetable_v5', `${r.template.name}|${r.from}`);

/** 그날 V4 칸 → V5 칸 (시간표와 같으면 null) */
function lessonCell(c: V4Cell | undefined, base: string, linkIds: string[]): LessonPeriod | null {
  const out: LessonPeriod = {};
  const subject = c?.subject ?? '';
  if (subject !== base) out.subject = subject;
  if (c?.memo.trim()) out.memo = c.memo;
  if (c?.supplies.trim()) out.supplies = c.supplies;
  if (c?.attachments.length) out.attachments = c.attachments;
  if (linkIds.length) out.linkIds = linkIds;
  return Object.keys(out).length ? out : null;
}

export interface LessonsOptions {
  /** 수업 없는 날인가 (방학·공휴일·수업X 일정) - 그날은 시간표가 없다 */
  offDay: (date: string) => boolean;
  /** V4 링크 하나 → V5 id (items 가져오기의 짝 표) */
  linkOf: (l: unknown) => string | undefined;
  /** 오늘 (이름으로 정하는 학기의 학년도) */
  today: string;
}

export interface ExistingLessonDocs {
  timetables: Readonly<Record<string, Stored<'timetables'>>>;
  lessonDays: Readonly<Record<string, Stored<'lessonDays'>>>;
  progress: Readonly<Record<string, Stored<'progress'>>>;
}

export function planLessons(sid: string, docs: V4LessonDocs, existing: ExistingLessonDocs, opts: LessonsOptions): LessonsPlan {
  const cfg = v4SemesterConfig(docs.timetable);
  const cellsByDate: Record<string, Record<string, V4Cell>> = {};
  for (const [date, doc] of Object.entries(docs.schedules)) if (isValidDateStr(date)) cellsByDate[date] = v4Cells(doc);

  // ───────── 시간표 ─────────
  const ranges = timetableRanges(v4Templates(docs.timetable), cellsByDate, cfg, opts.today);
  const ttPlanned: Planned<'timetables'>[] = ranges.map((r) => ({
    id: timetableId(sid, r),
    data: { name: r.template.name, from: r.from, to: r.to, grid: r.template.grid },
    src: { path: 'settings/timetable_v5', id: `${r.template.name}|${r.from}` },
    year: r.from ? String(academicYearOf(r.from)) : undefined,
  }));
  const tt = planDocs(sid, 'timetables', ttPlanned, existing.timetables, (d) => d.src?.from === 'v4' && d.src.path === 'settings/timetable_v5');
  // 수업 칸 셈은 가져올 시간표로 (기간 없는 것은 쓰이지 않는다)
  const like: TimetableLike[] = ttPlanned.filter((p) => p.data.from).map((p) => ({ id: p.id, name: p.data.name, from: p.data.from, to: p.data.to, grid: p.data.grid }));

  // ───────── 수업 칸 ─────────
  const dayPlanned: Planned<'lessonDays'>[] = [];
  for (const date of Object.keys(cellsByDate).sort()) {
    const v4 = cellsByDate[date];
    const off = opts.offDay(date);
    const t = off ? null : timetableOn(date, like);
    const row = t?.grid[String(weekdayOf(date))] ?? {};
    const periods: Record<string, LessonPeriod> = {};
    for (const n of new Set([...Object.keys(v4), ...Object.keys(row)])) {
      const c = v4[n];
      const cell = lessonCell(c, row[n] ?? '', c ? linkIdsOf(c.links, opts.linkOf) : []);
      if (cell) periods[n] = cell;
    }
    if (Object.keys(periods).length === 0) continue;
    dayPlanned.push({ id: date, data: { periods }, src: { path: `schedules/${date}`, id: date }, year: String(academicYearOf(date)) });
  }
  const ownsDay = (d: Stored<'lessonDays'>) => d.src?.from === 'v4' && /^schedules\//.test(d.src.path ?? '');
  // 날짜 문서는 지우지 않는다 - V4에서 없어진 날은 아래에서 칸을 비운다
  const ld = planDocs(sid, 'lessonDays', dayPlanned, existing.lessonDays, () => false);
  const planned = new Set(dayPlanned.map((p) => p.id));
  for (const d of Object.values(existing.lessonDays)) {
    if (planned.has(d.id) || !ownsDay(d) || Object.keys(d.periods ?? {}).length === 0) continue;
    if (untouched(d)) {
      const src: ImportSource = { ...d.src!, h: fingerprint({ periods: {} }) };
      ld.ops.push(writeOp.patch({ sid, coll: 'lessonDays', id: d.id }, { periods: {}, src }, d));
      tally(ld.counts, 'removed');
    } else tally(ld.counts, 'kept');
  }

  // ───────── 진도 ─────────
  const pgPlanned: Planned<'progress'>[] = [];
  for (const [docId, raw] of Object.entries(docs.progress)) {
    const plan = sanitizePlan(docId, raw);
    if (!plan.key && !plan.classes?.length) continue;
    const { id: _id, ...rest } = plan;
    void _id;
    pgPlanned.push({
      id: v4id('progress', sid, 'v4_progress', docId),
      data: rest,
      src: { path: `v4_progress/${docId}`, id: docId },
      year: plan.startDate ? String(academicYearOf(plan.startDate)) : undefined,
    });
  }
  const pg = planDocs(sid, 'progress', pgPlanned, existing.progress, (d) => d.src?.from === 'v4' && /^v4_progress\//.test(d.src.path ?? ''));

  return {
    ops: [...tt.ops, ...ld.ops, ...pg.ops],
    counts: { timetables: tt.counts ?? emptyCounts(), lessonDays: ld.counts, progress: pg.counts },
  };
}

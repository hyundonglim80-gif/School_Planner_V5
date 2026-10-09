// 조사표 (V4 lib/evalSummary·courseEvals·classHub의 조사표 부분·EvaluationModal의 셈) - 순수 함수. 학생은 sid로 가리킨다.
//   조사표 한 장 = 문서 하나 `evaluations/{id}`(DESIGN 4-7, 공간마다). V4는 하루 문서의 배열(list/evalList)이었다.
//   명단(students)은 만들 때 학급 명렬표에서 찍어 두고, 열 때 지금 명렬표와 맞춘다(새로 온 학생을 더하고 이름·번호를 고치고,
//   명렬표에서 사라졌거나 전출한 학생은 지우지 않고 out 표시 - 그때 준 값이 함께 사라지지 않게, V4 그대로).
//   그룹 공간의 다른 사람은 내 명렬표를 볼 수 없어 이름을 문서에 둔다.
import { getSemesterRanges, semesterConfigOf, type SchoolTerms } from './semester';

export type EvalType = 'eval' | 'check' | 'memo';
export const EVAL_TYPES: EvalType[] = ['eval', 'check', 'memo'];
export const EVAL_TYPE_LABEL: Record<EvalType, string> = { eval: '평가', check: '체크', memo: '메모' };
/** 만들기 칸의 유형 이름 */
export const EVAL_TYPE_CHOICE: Record<EvalType, string> = { eval: '평가', check: '체크(O/X)', memo: '메모' };

export const EVAL_SUBJECTS = ['국어', '도덕', '사회', '수학', '과학', '실과', '체육', '음악', '미술', '영어', '창체'];
export const DEFAULT_STEPS = ['우수', '보통', '노력요함', '미흡', '매우미흡'];

/** 한 학생의 값 - 평가(개인 단계·조 단계·조 이름)·체크·사유·메모 */
export interface EvalValue {
  indiv?: string;
  group?: string;
  groupName?: string;
  checked?: boolean;
  reason?: string;
  memo?: string;
}
export type EvalValues = Record<string, EvalValue>;

export interface EvalStudent {
  sid: string;
  num: number;
  name: string;
  /** 명렬표에서 사라졌거나 전출 (값은 남긴다) */
  out?: true;
}

export interface EvalGroup {
  name: string;
  members: string[];
}

/** 조사표 문서의 셈에 쓰는 칸 (data/types Evaluation과 같은 모양) */
export interface EvalDoc {
  date: string;
  /** 교시 (1부터). null = 기록 칸에 붙은 조사표 */
  period: number | null;
  classId: string;
  title: string;
  type: EvalType;
  subject?: string;
  /** 평가: 개인·조별 */
  indiv?: boolean;
  group?: boolean;
  steps?: string[];
  groups?: EvalGroup[];
  students: EvalStudent[];
  values: EvalValues;
}

/** 조사표가 붙은 자리: 교시 글자 '3' 또는 'journal' (기록 칸) */
export const evalPlaceOf = (ev: Pick<EvalDoc, 'period'>): string => (ev.period == null ? 'journal' : String(ev.period));

/** 자리를 사람이 읽는 말로 ('3교시' / '기록') - 교시 이름이 있으면 그것 */
export function evalPlaceLabel(place: string, periodNames: readonly string[] = []): string {
  if (place === 'journal') return '기록';
  return periodNames[Number(place) - 1] || `${place}교시`;
}

/** 번호 차례로 n조 ('A조'·'B조' - V3·V4 그대로) */
export function groupsByNumber(sids: readonly string[], count: number): EvalGroup[] {
  const n = Math.max(1, Math.floor(count) || 1);
  const groups: EvalGroup[] = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const size = Math.floor(sids.length / n) + (i < sids.length % n ? 1 : 0);
    groups.push({ name: `${String.fromCharCode(65 + i)}조`, members: sids.slice(idx, idx + size) });
    idx += size;
  }
  return groups;
}

interface RosterStudentLike {
  sid: string;
  num: number;
  name: string;
  status?: 'active' | 'out';
}

/** 만들 때의 명단 = 재학생 (번호 차례) */
export function evalStudentsOf(students: readonly RosterStudentLike[]): EvalStudent[] {
  return students
    .filter((s) => s.status !== 'out')
    .map((s) => ({ sid: s.sid, num: s.num, name: s.name }))
    .sort((a, b) => a.num - b.num);
}

/**
 * 열 때 지금 명렬표와 맞춘 명단. 바뀐 것이 없으면 null.
 * - 새로 온 재학생을 더하고, 이름·번호가 바뀌면 고친다. 전출했다 돌아오면 out을 뗀다.
 * - 명렬표에서 사라졌거나 전출한 학생은 out (지우지 않는다).
 */
export function syncEvalStudents(current: readonly EvalStudent[], roster: readonly RosterStudentLike[]): EvalStudent[] | null {
  const bySid = new Map(roster.map((s) => [s.sid, s]));
  const next: EvalStudent[] = [];
  const seen = new Set<string>();
  for (const s of current) {
    seen.add(s.sid);
    const r = bySid.get(s.sid);
    const out = !r || r.status === 'out';
    next.push({ sid: s.sid, num: r?.num ?? s.num, name: r?.name ?? s.name, ...(out ? { out: true as const } : {}) });
  }
  for (const r of roster) if (!seen.has(r.sid) && r.status !== 'out') next.push({ sid: r.sid, num: r.num, name: r.name });
  next.sort((a, b) => a.num - b.num || (a.sid < b.sid ? -1 : 1));
  return JSON.stringify(next) === JSON.stringify(current) ? null : next;
}

/** 그 학생이 명단에 있나 */
export const evalHasStudent = (ev: Pick<EvalDoc, 'students'>, sid: string) => ev.students.some((s) => s.sid === sid);

/** 칸 이름 - 메모는 memo, 나머지는 사유(reason) */
export const evalTextField = (type: EvalType): 'memo' | 'reason' => (type === 'memo' ? 'memo' : 'reason');

/** 한 학생의 값 다듬기 - 빈 칸은 뺀다(빈 값이면 null) */
export function cleanEvalValue(v: EvalValue | undefined): EvalValue | null {
  if (!v) return null;
  const out: EvalValue = {};
  if (v.indiv) out.indiv = v.indiv;
  if (v.group) out.group = v.group;
  if (v.groupName?.trim()) out.groupName = v.groupName.trim();
  if (typeof v.checked === 'boolean') out.checked = v.checked;
  if (v.reason?.trim()) out.reason = v.reason.trim();
  if (v.memo?.trim()) out.memo = v.memo.trim();
  return Object.keys(out).length ? out : null;
}

/** 고친 값 → 바뀐 학생 칸만 (`values.{sid}` 통째로 - 저장 도우미 patch가 그 칸을 갈아 끼운다, 빈 값은 지우기) */
export function evalValuesChanges(before: EvalValues, after: EvalValues): Record<string, EvalValue | undefined> {
  const out: Record<string, EvalValue | undefined> = {};
  for (const sid of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = cleanEvalValue(after[sid]);
    const b = cleanEvalValue(before[sid]);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out[`values.${sid}`] = a ?? undefined;
  }
  return out;
}

/** 한 학생 한 칸 고치기 */
export function withEvalValue(values: EvalValues, sid: string, patch: EvalValue): EvalValues {
  return { ...values, [sid]: { ...(values[sid] ?? {}), ...patch } };
}

/** 전체 일괄 적용 - 명단의 모든 학생(전출 빼고) */
export function applyEvalToAll(values: EvalValues, students: readonly EvalStudent[], patch: EvalValue): EvalValues {
  let next = values;
  for (const s of students) if (!s.out) next = withEvalValue(next, s.sid, patch);
  return next;
}

// ── 모아 보기·학생 카드 (V4 evalSummary) ──

export interface EvalCell {
  /** 평가 단계·O/X·메모 (조별이면 '1모둠 보통') */
  main: string;
  /** 사유·근거 */
  note: string;
}

/** 한 조사표의 한 학생 값 */
export function studentEvalCell(ev: Pick<EvalDoc, 'type' | 'values' | 'indiv' | 'group' | 'groups'>, sid: string): EvalCell {
  const rec = ev.values?.[sid] ?? {};
  if (ev.type === 'eval') {
    const parts: string[] = [];
    if (ev.indiv && rec.indiv) parts.push(rec.indiv);
    if (ev.group && rec.group) {
      const gName = rec.groupName ?? ev.groups?.find((g) => g.members.includes(sid))?.name ?? '';
      parts.push(gName ? `${gName} ${rec.group}` : `조 ${rec.group}`);
    }
    return { main: parts.join(' · '), note: (rec.reason ?? '').trim() };
  }
  if (ev.type === 'check') return { main: rec.checked === true ? 'O' : rec.checked === false ? 'X' : '', note: (rec.reason ?? '').trim() };
  return { main: (rec.memo ?? '').trim(), note: '' };
}

export const isEmptyCell = (c: EvalCell) => !c.main && !c.note;

/** '잘함 - 식을 세워 풂' (값이 없으면 '') */
export function evalCellText(c: EvalCell): string {
  if (c.main && c.note) return `${c.main} - ${c.note}`;
  return c.main || c.note;
}

/** 그 날짜가 몇 학기인가. 그 학년도의 방학 설정이 있으면 2학기 시작일로, 없으면 3~8월 1학기 (V4 그대로) */
export function semesterOf(date: string, schoolYear: number, terms?: SchoolTerms | null): 1 | 2 {
  const cfg = semesterConfigOf(terms, schoolYear);
  if (cfg?.summerStart && cfg.summerEnd) {
    const { sem2 } = getSemesterRanges(cfg);
    if (sem2.start) return date < sem2.start ? 1 : 2;
  }
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return y === schoolYear && m >= 3 && m <= 8 ? 1 : 2;
}

export interface EvalFilter {
  /** '' = 모두, '(없음)' = 교과를 안 고른 것 */
  subject?: string;
  semester?: 1 | 2 | null;
  type?: EvalType | '';
}

export function filterEvals<T extends Pick<EvalDoc, 'subject' | 'date' | 'type'>>(evals: readonly T[], filter: EvalFilter, schoolYear: number, terms?: SchoolTerms | null): T[] {
  return evals.filter((ev) => {
    if (filter.subject) {
      const s = ev.subject ?? '';
      if (filter.subject === '(없음)' ? s !== '' : s !== filter.subject) return false;
    }
    if (filter.type && ev.type !== filter.type) return false;
    if (filter.semester && semesterOf(ev.date, schoolYear, terms) !== filter.semester) return false;
    return true;
  });
}

/** 날짜 차례 (같은 날은 교시 차례 - 기록 칸은 뒤, 그다음 제목) */
export function sortEvals<T extends Pick<EvalDoc, 'date' | 'period' | 'title'>>(evals: readonly T[]): T[] {
  return [...evals].sort((a, b) => a.date.localeCompare(b.date) || (a.period ?? 99) - (b.period ?? 99) || a.title.localeCompare(b.title, 'ko'));
}

/** 표 머리: '10/2 수학 단원평가' */
export function evalColumnTitle(ev: Pick<EvalDoc, 'date' | 'subject' | 'title'>): string {
  const d = ev.date;
  const md = d.length >= 10 ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : d;
  return [md, ev.subject, ev.title].filter(Boolean).join(' ');
}

export interface OverviewStudent {
  sid: string;
  num: number;
  name: string;
  out?: boolean;
}

/** 학급 × 조사표 CSV 줄. 머리 두 줄(날짜·교과·유형 / 제목) 뒤에 학생마다 한 줄. 조사표마다 값과 사유 두 칸 (메모는 한 칸) */
export function overviewCsvRows(evals: ReadonlyArray<Pick<EvalDoc, 'date' | 'subject' | 'title' | 'type' | 'values' | 'indiv' | 'group' | 'groups'>>, students: readonly OverviewStudent[]): string[][] {
  const head1 = ['번호', '이름'];
  const head2 = ['', ''];
  for (const ev of evals) {
    const info = `${ev.date} ${ev.subject ?? ''} ${EVAL_TYPE_LABEL[ev.type] ?? ''}`.replace(/\s+/g, ' ').trim();
    if (ev.type === 'memo') {
      head1.push(info);
      head2.push(ev.title);
    } else {
      head1.push(info, '');
      head2.push(ev.title, '사유');
    }
  }
  const rows = students.map((st) => {
    const row = [String(st.num), st.name + (st.out ? ' (전출)' : '')];
    for (const ev of evals) {
      const c = studentEvalCell(ev, st.sid);
      if (ev.type === 'memo') row.push(c.main);
      else row.push(c.main, c.note);
    }
    return row;
  });
  return [head1, head2, ...rows];
}

/** 조사표 하나의 단계별 사람 수 ('잘함 12 · 보통 8') - 평가만 */
export function stepCounts(ev: Pick<EvalDoc, 'type' | 'values' | 'steps'>, sids: readonly string[]): string {
  if (ev.type !== 'eval') return '';
  const counts = new Map<string, number>();
  for (const sid of sids) {
    const rec = ev.values?.[sid] ?? {};
    const v = rec.indiv || rec.group || '';
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const steps = ev.steps ?? [];
  const order = [...steps, ...[...counts.keys()].filter((k) => !steps.includes(k))];
  return order
    .filter((s) => counts.get(s))
    .map((s) => `${s} ${counts.get(s)}`)
    .join(' · ');
}

/** 하루 조사표 수 - 교시 글자('3')·'journal'마다 (하루 수업 칸 📊n·기록 칸 📊) */
export function evalCountsByPlace(evals: ReadonlyArray<Pick<EvalDoc, 'period'>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of evals) {
    const k = evalPlaceOf(ev);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// ── 과정별 (V4 courseEvals - 교과 모드) ──

export interface CourseEvalColumn<T> {
  /** 묶는 열쇠 '종류|제목' */
  id: string;
  title: string;
  type: EvalType;
  /** 반 '5-2' → 그 반의 조사표 (같은 제목이 둘이면 날짜가 이른 것) */
  byClass: Record<string, T>;
  /** 반들 가운데 가장 이른 날짜 (칸 차례) */
  firstDate: string;
}

const norm = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ');

/** 반마다 모은 조사표를 제목+종류로 묶는다. subject를 주면 그 교과만(과정의 과목). 칸은 가장 이른 날짜 차례 */
export function groupCourseEvals<T extends Pick<EvalDoc, 'title' | 'type' | 'subject' | 'date'>>(evalsByClass: Readonly<Record<string, readonly T[]>>, subject?: string): CourseEvalColumn<T>[] {
  const cols = new Map<string, CourseEvalColumn<T>>();
  for (const [cls, evals] of Object.entries(evalsByClass)) {
    for (const ev of evals) {
      if (subject && norm(ev.subject) !== norm(subject)) continue;
      const title = norm(ev.title);
      const id = `${ev.type}|${title}`;
      let col = cols.get(id);
      if (!col) cols.set(id, (col = { id, title, type: ev.type, byClass: {}, firstDate: ev.date }));
      const old = col.byClass[cls];
      if (!old || ev.date < old.date) col.byClass[cls] = ev;
      if (ev.date < col.firstDate) col.firstDate = ev.date;
    }
  }
  return [...cols.values()].sort((a, b) => a.firstDate.localeCompare(b.firstDate) || a.title.localeCompare(b.title, 'ko'));
}

/** 조사표 하나의 '완료 n/m': 값이 있는 학생 수 / 그 반 학생 수 (sids - 지금 명렬표의 재학생) */
export function courseEvalCompletion(ev: Pick<EvalDoc, 'students' | 'type' | 'values' | 'indiv' | 'group' | 'groups'>, sids: readonly string[]): { done: number; total: number } {
  const listed = new Set(ev.students.map((s) => s.sid));
  let done = 0;
  for (const sid of sids) if (listed.has(sid) && !isEmptyCell(studentEvalCell(ev, sid))) done++;
  return { done, total: sids.length };
}

/** 과정별 CSV 줄: 머리(반, 칸 제목들) + 반마다 '완료/학생 수' (없으면 '') */
export function courseOverviewCsvRows<T extends Pick<EvalDoc, 'students' | 'type' | 'values' | 'indiv' | 'group' | 'groups'>>(
  columns: ReadonlyArray<CourseEvalColumn<T>>,
  classes: ReadonlyArray<{ cls: string; sids: readonly string[] }>,
): string[][] {
  const head = ['반', ...columns.map((c) => c.title)];
  const rows = classes.map(({ cls, sids }) => [
    cls,
    ...columns.map((c) => {
      const ev = c.byClass[cls];
      if (!ev) return '';
      const { done, total } = courseEvalCompletion(ev, sids);
      return `${done}/${total}`;
    }),
  ]);
  return [head, ...rows];
}

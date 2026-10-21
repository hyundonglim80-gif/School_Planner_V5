// 진도 (V4 lib/progress.ts - V4 테스트째, 순수 함수만). V4 사용자 결정(2026-10-01)대로:
//
// - 단위는 '시간표 칸 글자'다. 과목 칸이 '국어'면 국어 하나, '3-2 국어'·'3-3 국어'면 반마다 따로(앞뒤 공백만 정리해 견준다).
// - 차시 목록(단원·차시·내용·교과서·준비물)은 엑셀·한셀에서 표를 복사해 붙여 넣거나 CSV로 불러온다. 한 줄이 한 내용이고
//   차시 칸의 수만큼 그 내용을 잇단 교시에 되풀이한다(lessonPeriods - 10-21 사용자: 행을 늘리지 않는다, 1차시 + 2차시 = 3차시).
// - 시작일부터 그 글자가 적힌 교시를 날짜·교시 차례로 세어 k번째 교시 = k번째 차시. V5는 수업 칸을 **계산**한다(domain/lessons -
//   기간별 시간표 + 그날 바꾼 칸) - 그 결과(subjectsBetween)를 입력으로 받는다. 수업이 없는 날(classOffReason)은 건너뛴다.
// - 수업이 빠진 교시는 '밀기'(Planbook의 Bump): 그 교시는 차시를 받지 않고 뒤가 한 칸씩 밀린다. 되돌리면 다시 당겨진다.
//
// 저장(개인 공간): progress/{planId} = { key, subject?, classes?, startDate, lessons: [{unit, no, content, page, supplies}], bumps: ['YYYY-MM-DD#교시'], noCount? }
// 과정(교과 모드): { …, subject: '과학', classes: ['5-1','5-2'] } - 차시 목록 하나를 여러 반이 반마다 따로 센다. 반 열쇠는 '5-1 과학'(planKeys)이고
// 칸 글자는 정규화해 견준다(domain/teachingSlot). key에는 첫 열쇠를 채워 둔다. bumps는 과정 하나에 한 배열 - 같은 날·교시에 두 반을 가르칠 수 없으니
// '날짜#교시'가 반마다 저절로 다르다. 수업 칸(lessonDays)에는 쓰지 않는다 - 화면에서만 겹쳐 보인다.
import { parseClipboardGrid } from './gridNav';
import { parseCsv } from './csv';
import { formatSlot, normalizeSlotText, parseSlot } from './teachingSlot';

export interface ProgressLesson {
  unit: string;
  /** 차시 칸 글자 그대로 - 그 내용을 몇 차시 동안 하는지('2' = 잇단 두 교시, lessonRepeat). 없으면 '' (1차시) */
  no: string;
  content: string;
  /** 교과서 쪽 ('12~15' 같은 글자 그대로, 19번 U2). 옛 문서에는 없다 - 빈 글자로 읽는다 */
  page: string;
  supplies: string;
  /** 이 차시에 이은 메모 id (P10-4 - 진도 쪽에만 적는다, 비면 칸이 없다). 그 차시를 하는 모든 수업 칸·그날 메모 칸에 보인다 */
  linkIds?: string[];
}

export interface ProgressPlan {
  id: string;
  /** 시간표 칸 글자 (앞뒤 공백을 뗀 것) */
  key: string;
  /** YYYY-MM-DD. 이날부터 센다 */
  startDate: string;
  lessons: ProgressLesson[];
  /** 민 교시 'YYYY-MM-DD#교시' */
  bumps: string[];
  /** 과정(여러 반): 과목. classes와 함께 있다 */
  subject?: string;
  /** 과정(여러 반): 반 '5-2' 목록. 있으면 과정 */
  classes?: string[];
  /**
   * 차시 칸 = 차시 수로 저장한 진도 (10-21~ 진도 창이 저장하면 적는다). 없으면 옛 진도 - 1, 2, 3 … 차례 번호 표(isOrderNumbered)면
   * 한 행 = 한 차시, 아니면 차시 칸의 수만큼.
   */
  noCount?: boolean;
}

type CourseFields = Partial<Pick<ProgressPlan, 'subject' | 'classes'>>;

/** 칸 글자를 견줄 모양으로 (앞뒤 공백만 뗀다 - 사용자가 정함) */
export function progressKey(subject: unknown): string {
  return String(subject ?? '').trim();
}

export const slotId = (date: string, period: string | number) => `${date}#${period}`;

// ── 과정 (여러 반) ──────────────────────────────────────────────────────

/** 반 하나 이상을 가진 과정인가 */
export function isCourse(plan: CourseFields): boolean {
  return Array.isArray(plan.classes) && plan.classes.length > 0;
}

/** 이 진도가 세는 열쇠들. 과정이면 반마다 '5-1 과학', 아니면 [칸 글자] */
export function planKeys(plan: Pick<ProgressPlan, 'key'> & CourseFields): string[] {
  if (isCourse(plan)) return plan.classes!.map((c) => formatSlot(c, plan.subject || ''));
  return [progressKey(plan.key)];
}

/** 열쇠를 견줄 모양 - 과정은 반 표기를 맞추고(lib/teachingSlot), 옛 진도는 앞뒤 공백만 */
const matchKey = (text: unknown, course: boolean) =>
  course ? normalizeSlotText(String(text ?? '')) : progressKey(text);

/** 과정 이름: 반이 모두 같은 학년이면 '5학년 과학', 섞이면 '과학 (5-1 외 3)' */
export function courseTitle(plan: CourseFields): string {
  const classes = plan.classes || [];
  const subject = (plan.subject || '').trim();
  const grades = new Set(classes.map((c) => parseSlot(c).grade));
  if (grades.size === 1) return `${[...grades][0]}학년 ${subject}`.trim();
  const who = classes.length > 1 ? `${classes[0]} 외 ${classes.length - 1}` : classes[0] || '';
  return subject ? `${subject} (${who})` : who;
}

/** 목록·안내에 쓰는 진도 이름 - 과정이면 courseTitle, 아니면 칸 글자 */
export function planLabel(plan: Pick<ProgressPlan, 'key'> & CourseFields): string {
  return isCourse(plan) ? courseTitle(plan) : plan.key;
}

// ── 표 붙여넣기 ─────────────────────────────────────────────────────────

/** 차시 행의 글 칸 (이은 메모 linkIds는 빼고) */
export type LessonField = Exclude<keyof ProgressLesson, 'linkIds'>;
type Field = LessonField;

/** 머리줄 칸 글자 → 어느 칸인가 */
function headerField(cell: string): Field | null {
  const t = cell.replace(/\s+/g, '');
  if (!t) return null;
  if (/^(단원|단원명|대단원|중단원|소단원|영역)$/.test(t)) return 'unit';
  if (/^(차시|순서|번호)$/.test(t)) return 'no';
  if (/^(준비물|준비|자료|학습자료|수업자료|교구)$/.test(t)) return 'supplies';
  if (/^(교과서|교과서\(쪽\)|교과서쪽|교과서쪽수|쪽|쪽수|페이지)$/.test(t)) return 'page';
  if (/^(내용|학습내용|수업내용|주제|학습주제|차시주제|차시명|제재|활동|학습활동|주요활동|학습목표|목표)$/.test(t)) return 'content';
  return null;
}

/**
 * 첫 줄이 머리줄이면 칸마다 어느 칸인지, 아니면 null.
 * 머리줄 이름이 둘 이상이어야 머리줄로 본다(한 칸짜리 표는 그 한 칸) - 내용 칸에 '활동'이라고만 적은 줄을
 * 머리줄로 알고 버리지 않게. 내용 칸 이름을 모르면(예: '오늘 배울 것') 이름을 모르는 첫 칸을 내용으로 본다.
 */
function headerFields(row: string[]): Array<Field | null> | null {
  const hits = row.map(headerField);
  const named = hits.filter((f) => f !== null).length;
  const filled = row.filter((c) => c !== '').length;
  if (!(named >= 2 || (named === 1 && filled === 1))) return null;
  if (!hits.includes('content')) {
    const i = hits.findIndex((f, c) => f === null && row[c] !== '');
    if (i >= 0) hits[i] = 'content';
  }
  return hits;
}

/** '5', '5차시', '5~6', '5-6차시' 같은 차시 칸인가 */
const looksLikeNo = (cell: string) => /^\d{1,3}(\s*[~\-–,]\s*\d{1,3})?\s*(차시)?$/.test(cell.trim());

/**
 * 머리줄이 없을 때 칸 차례로 정한다. 차시처럼 보이는(숫자) 칸이 있으면 그 칸을 기준으로.
 * 단원 번호도 숫자일 수 있다 - 합친 칸이라 듬성듬성하니, 숫자 칸 가운데 가장 많이 채워진 칸을 차시로 본다.
 * 숫자로 된 단원 칸이 다 채워졌거나 교과서 쪽 칸이 있으면 뒤에 내용(글자) 칸이 오는 왼쪽 칸이 차시다.
 */
function positionalFields(rows: string[][]): Array<Field | null> {
  const width = Math.max(...rows.map((r) => r.length));
  const filled = (c: number) => rows.map((r) => r[c] || '').filter(Boolean);
  const isNumeric = (c: number) => {
    const cells = filled(c);
    return cells.length > 0 && cells.filter(looksLikeNo).length / cells.length >= 0.6;
  };
  // 같은 만큼 채워졌으면 바로 뒤에 글자 칸(내용)이 오는 쪽, 그래도 같으면 왼쪽 - 교과서 쪽 '12~13'도 숫자처럼 보인다(19번 U2)
  let noCol: number | undefined;
  let best = 0;
  for (let c = 0; c < width; c++) {
    if (!isNumeric(c)) continue;
    const score = filled(c).length * 2 + (c + 1 < width && filled(c + 1).length > 0 && !isNumeric(c + 1) ? 1 : 0);
    if (score > best) {
      noCol = c;
      best = score;
    }
  }

  const fields: Array<Field | null> = Array(width).fill(null);
  if (noCol !== undefined) {
    if (noCol >= 1) fields[noCol - 1] = 'unit';
    fields[noCol] = 'no';
    // 차시 뒤 칸이 셋 이상이면 새 차례(내용·교과서·준비물), 둘이면 옛 4칸 표(내용·준비물) - 19번 U2
    const after: Field[] = width - noCol - 1 >= 3 ? ['content', 'page', 'supplies'] : ['content', 'supplies'];
    after.forEach((f, i) => {
      if (noCol! + 1 + i < width) fields[noCol! + 1 + i] = f;
    });
    return fields;
  }
  const order: Field[][] = [
    [],
    ['content'],
    ['unit', 'content'],
    ['unit', 'content', 'supplies'],
    ['unit', 'no', 'content', 'supplies'],
  ];
  const pick = order[width] || ['unit', 'no', 'content', 'page', 'supplies'];
  pick.forEach((f, i) => (fields[i] = f));
  return fields;
}

/**
 * 엑셀·한셀에서 복사한 차시 표를 읽는다.
 * - 머리줄(단원·차시·내용·교과서·준비물 …)이 있으면 건너뛰고, 그 이름으로 칸을 맞춘다. 없으면 '단원 | 차시 | 내용 | 교과서 | 준비물' 차례
 *   (칸이 넷이면 옛 표 '단원 | 차시 | 내용 | 준비물' - 교과서 칸을 더하기 전의 표도 그대로 읽는다).
 * - 빈 줄은 뺀다. 단원 칸만 있는 줄은 단원 제목으로 보고 아래 차시들에 붙인다.
 * - 단원 칸이 비면 위 줄의 단원을 잇는다(엑셀에서 합친 칸은 첫 줄에만 글자가 온다).
 * - 차시 칸의 숫자는 그 내용을 몇 차시 동안 하는지다(2026-10-07 사용자가 정함): '2'면 그 행을 잇단 두 교시에(lessonPeriods).
 *   행은 늘리지 않는다(10-21) - 늘려 둔 표(차시 칸이 빈 같은 내용 행)를 붙여 넣으면 한 행으로 합친다.
 */
export function parseLessonTable(text: string): ProgressLesson[] {
  return parseLessonTableInfo(text).lessons;
}

/** CSV 파일의 차시 표 (예시 CSV를 엑셀에서 고쳐 저장한 것 - '단원,차시,내용,교과서,준비물'). 읽는 규칙은 붙여넣기와 같다 */
export function parseLessonCsv(text: string): ProgressLesson[] {
  return parseLessonCsvInfo(text).lessons;
}

export interface LessonParseInfo {
  lessons: ProgressLesson[];
  /** 모두 몇 차시 (차시 칸의 수를 더한 것) */
  periods: number;
}

export function parseLessonTableInfo(text: string): LessonParseInfo {
  return parseLessonRows(parseClipboardGrid(text));
}

export function parseLessonCsvInfo(text: string): LessonParseInfo {
  return parseLessonRows(parseCsv(text).map((r: string[]) => r.map((c: string) => c.trim())));
}

/** 차시 칸이 숫자 하나면 그 숫자 ('2', '2차시'). 범위('5~6')·글자는 null */
const countOf = (no: string): number | null => {
  const m = /^(\d{1,3})\s*(차시)?$/.exec(no.trim());
  return m ? Number(m[1]) : null;
};

/** 한 행을 몇 차시 동안 할까 - 차시 칸의 숫자(1~10). 숫자가 아니면 1 */
export const MAX_LESSON_REPEAT = 10;
export function lessonRepeat(no: string): number {
  const n = countOf(no);
  return n && n >= 1 ? Math.min(n, MAX_LESSON_REPEAT) : 1;
}

/**
 * 차시 칸이 1, 2, 3 … 차례 번호인 옛 표인가 (2026-10-07 '차시 칸 = 차시 수'로 정하기 전에 붙여 넣은 표 - 한 행 = 한 차시).
 * 범위('5~6')가 있거나, 10을 넘는 수가 있거나, 셋 이상인 모든 행이 하나씩 느는 번호면. 표시(noCount)가 있는 진도는 보지 않는다.
 */
export function isOrderNumbered(lessons: Pick<ProgressLesson, 'no' | 'content'>[]): boolean {
  const rows = lessons.filter((l) => l.no.trim() || l.content.trim());
  const nos = rows.map((l) => l.no.trim());
  if (nos.some((no) => /^\d{1,3}\s*[~\-–]\s*\d{1,3}\s*(차시)?$/.test(no))) return true;
  const ns = nos.map(countOf);
  if (ns.some((n) => n !== null && n > MAX_LESSON_REPEAT)) return true;
  return rows.length >= 3 && ns.every((n, i) => n !== null && (i === 0 || n === ns[i - 1]! + 1));
}

/** 이 진도를 한 행 = 한 차시로 세나 (차시 칸 = 차시 수 표시가 없는 옛 차례 번호 표) */
export const isOrderPlan = (plan: Pick<ProgressPlan, 'lessons' | 'noCount'>) => !plan.noCount && isOrderNumbered(plan.lessons);

/**
 * 차시 칸을 늘려 저장하던 때(10-07~10-21)의 표: 차시 칸이 n인 행 바로 뒤에 차시 칸이 빈 같은 내용 행이 있으면 그 n차시 안의 행이다.
 * 행 무리마다 [그 행, 뒤따르는 같은 내용 행 …] (원래 행 번호). 차례 번호 표(order)는 한 행씩.
 */
export function repeatGroups(lessons: Pick<ProgressLesson, 'unit' | 'no' | 'content'>[], order = false): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i];
    const group = [i];
    const want = order || !l.content.trim() ? 1 : lessonRepeat(l.no);
    while (group.length < want) {
      const next = lessons[i + group.length];
      if (!next || next.no.trim() || next.content !== l.content || next.unit !== l.unit) break;
      group.push(i + group.length);
    }
    groups.push(group);
    i += group.length - 1;
  }
  return groups;
}

/** 수업 한 교시에 하는 차시 - 몇째 행인가(row)와 같은 내용 안에서 몇 번째/몇 차시(k/n) */
export interface LessonPeriod {
  row: number;
  k: number;
  n: number;
}

/**
 * 차시 목록 → 차시 하나하나 (10-21 사용자 - 행을 늘리지 않고 차시 칸의 수만큼 수업에 되풀이한다: 1차시 + 2차시 = 3차시).
 * 늘려 저장한 옛 표는 그 행들이 그 차시들이다(repeatGroups - 이은 메모가 행마다 그대로). 차례 번호 표(order)는 한 행 = 한 차시.
 * k/n은 같은 내용(단원·내용이 같은 잇단 차시) 안에서 센다.
 */
export function lessonPeriods(lessons: Pick<ProgressLesson, 'unit' | 'no' | 'content'>[], order = false): LessonPeriod[] {
  const rows: number[] = [];
  for (const group of repeatGroups(lessons, order)) {
    const want = order ? 1 : lessonRepeat(lessons[group[0]].no);
    for (let k = 0; k < Math.max(want, group.length); k++) rows.push(group[k] ?? group[0]);
  }
  const same = (a: number, b: number) => {
    const x = lessons[rows[a]];
    const y = lessons[rows[b]];
    return !!x.content.trim() && x.content === y.content && x.unit === y.unit;
  };
  const out: LessonPeriod[] = [];
  for (let i = 0; i < rows.length; ) {
    let end = i + 1;
    while (end < rows.length && same(i, end)) end++;
    for (let p = i; p < end; p++) out.push({ row: rows[p], k: p - i + 1, n: end - i });
    i = end;
  }
  return out;
}

/** 진도의 차시들 (표시가 없는 옛 차례 번호 표는 한 행 = 한 차시) */
export const planPeriods = (plan: Pick<ProgressPlan, 'lessons' | 'noCount'>) => lessonPeriods(plan.lessons, isOrderPlan(plan));

/** 칸으로 나뉜 표를 차시 목록으로 (붙여넣기·CSV가 함께 쓴다) */
function parseLessonRows(grid: string[][]): LessonParseInfo {
  const rows = grid.filter((r) => r.some((c) => c !== ''));
  if (rows.length === 0) return { lessons: [], periods: 0 };

  const header = headerFields(rows[0]);
  const body = header ? rows.slice(1) : rows;
  if (body.length === 0) return { lessons: [], periods: 0 };
  const fields = header || positionalFields(body);

  const read: ProgressLesson[] = [];
  let unit = '';
  for (const row of body) {
    const lesson: ProgressLesson = { unit: '', no: '', content: '', page: '', supplies: '' };
    fields.forEach((f, i) => {
      if (f && row[i] && !lesson[f]) lesson[f] = row[i];
    });
    if (lesson.unit) unit = lesson.unit;
    if (!lesson.no && !lesson.content && !lesson.page && !lesson.supplies) continue; // 단원 제목 줄 (또는 쓸 칸이 없는 줄)
    read.push({ ...lesson, unit });
  }

  // 행은 늘리지 않는다 - 차시 칸의 수만큼 수업에 되풀이한다(lessonPeriods). 늘려 둔 표를 붙여 넣으면 같은 내용 행을 하나로 합친다
  const lessons = repeatGroups(read).map((g) => read[g[0]]);
  return { lessons, periods: lessonPeriods(lessons).length };
}

// ── 세기 ───────────────────────────────────────────────────────────────

export interface ProgressSlot {
  date: string;
  period: string;
  /** 이 교시에 하는 차시(planPeriods의 차례, 0부터 - 행 번호는 그 차시의 row). 민 교시면 null. 차시 수보다 크면 목록이 끝난 뒤다 */
  lesson: number | null;
  bumped: boolean;
}

export interface ProgressTimeline {
  /** 시작일부터 날짜·교시 차례 */
  slots: ProgressSlot[];
  /** slotId → 교시 */
  bySlot: Record<string, ProgressSlot>;
  /** 마지막 차시를 하는 교시. 읽은 범위 안에서 목록이 끝나지 않으면 null */
  last: ProgressSlot | null;
}

/**
 * 시작일부터 그 칸 글자가 적힌 교시를 차례로 세어 차시를 붙인다.
 * subjectsByDate: 날짜 → (교시 → 과목 글자) - domain/lessons subjectsBetween. isOffDay: 수업이 없는 날(classOffReason).
 * until: 이날부터는 세지 않는다 (같은 칸 글자의 다음 진도가 이어받는 날 - progressUntil).
 */
export function computeProgress(
  plan: Pick<ProgressPlan, 'key' | 'startDate' | 'lessons' | 'bumps' | 'noCount'> & CourseFields,
  subjectsByDate: Record<string, Record<string, string>>,
  isOffDay: (date: string) => boolean = () => false,
  until?: string,
  /** 과정이면 셀 반의 열쇠('5-1 과학', planKeys 가운데 하나). 주지 않으면 첫 열쇠 */
  keyOverride?: string
): ProgressTimeline {
  const course = isCourse(plan);
  const key = matchKey(keyOverride ?? planKeys(plan)[0], course);
  const bumps = new Set(plan.bumps || []);
  const slots: ProgressSlot[] = [];
  const bySlot: Record<string, ProgressSlot> = {};
  let last: ProgressSlot | null = null;
  if (!key || !plan.startDate) return { slots, bySlot, last };

  const dates = Object.keys(subjectsByDate)
    .filter((d) => d >= plan.startDate && (!until || d < until))
    .sort();
  const total = planPeriods(plan).length;
  let next = 0;
  for (const date of dates) {
    const periods = subjectsByDate[date] || {};
    const matching = Object.keys(periods)
      .filter((p) => matchKey(periods[p], course) === key)
      .sort((a, b) => Number(a) - Number(b));
    if (matching.length === 0 || isOffDay(date)) continue;
    for (const period of matching) {
      const bumped = bumps.has(slotId(date, period));
      const slot: ProgressSlot = { date, period, lesson: bumped ? null : next++, bumped };
      slots.push(slot);
      bySlot[slotId(date, period)] = slot;
      if (slot.lesson === total - 1) last = slot;
    }
  }
  return { slots, bySlot, last };
}

/**
 * 같은 칸 글자에 진도가 둘 이상이면(예: 2학기 목록을 따로) 시작일이 늦은 것이 그날부터 이어받는다.
 * 이 진도를 세지 않기 시작하는 날 - 같은 열쇠의 다음 진도 시작일. 없으면 undefined.
 * key: 과정이면 셀 반의 열쇠(주지 않으면 첫 열쇠). 과정이 끼면 반 열쇠를 정규화해 견주고(과정·옛 진도 모두),
 * 옛 진도끼리는 지금처럼 칸 글자를 견준다.
 */
export function progressUntil(
  plan: Pick<ProgressPlan, 'id' | 'key' | 'startDate'> & CourseFields,
  plans: Array<Pick<ProgressPlan, 'id' | 'key' | 'startDate'> & CourseFields>,
  key?: string
): string | undefined {
  const mine = key ?? planKeys(plan)[0];
  const course = isCourse(plan);
  let until: string | undefined;
  for (const p of plans) {
    if (p.id === plan.id || !p.startDate || p.startDate <= plan.startDate) continue;
    const shares =
      course || isCourse(p)
        ? planKeys(p).some((k) => normalizeSlotText(k) === normalizeSlotText(mine))
        : progressKey(p.key) === progressKey(mine);
    if (!shares) continue;
    if (!until || p.startDate < until) until = p.startDate;
  }
  return until;
}

/** 그 교시에 하는 차시(index = 몇째 차시, row = 몇째 행). 민 교시·목록 밖이면 null */
export function lessonAt(
  plan: Pick<ProgressPlan, 'lessons' | 'noCount'>,
  timeline: ProgressTimeline,
  date: string,
  period: string | number
): { index: number; row: number; lesson: ProgressLesson } | null {
  const slot = timeline.bySlot[slotId(date, period)];
  if (!slot || slot.lesson === null) return null;
  const at = planPeriods(plan)[slot.lesson];
  return at ? { index: slot.lesson, row: at.row, lesson: plan.lessons[at.row] } : null;
}

/** 수업 칸에 겹쳐 보일 한 교시의 진도 */
export interface ProgressMark {
  planId: string;
  /** 센 열쇠 - 옛 진도는 칸 글자, 과정은 그 반의 '5-1 과학' */
  key: string;
  /** 과정이면 그 반 '5-1' */
  cls?: string;
  /** 차시 차례 (0부터). 민 교시면 null */
  index: number | null;
  /** 그 차시의 행 (lessons의 차례 - 이은 메모 `progress:{planId}:{row}`). 민 교시면 null */
  row: number | null;
  /** 모두 몇 차시 */
  total: number;
  /** 같은 내용 안에서 몇 번째/몇 차시 (1/3, 2/3 …) */
  run: { k: number; n: number };
  lesson: ProgressLesson | null;
  bumped: boolean;
}

/**
 * 모든 진도를 세어 교시마다 겹쳐 보일 것 (slotId → 진도). 목록이 끝난 뒤의 교시는 넣지 않는다.
 * 같은 칸 글자의 진도가 둘이면 늦게 시작하는 쪽이 그날부터 이어받는다(progressUntil).
 */
export function progressMarks(
  plans: ProgressPlan[],
  subjectsByDate: Record<string, Record<string, string>>,
  isOffDay: (date: string) => boolean = () => false
): Record<string, ProgressMark> {
  const out: Record<string, ProgressMark> = {};
  for (const plan of plans) {
    if (plan.lessons.length === 0) continue;
    const course = isCourse(plan);
    const periods = planPeriods(plan);
    // 과정은 반마다 따로 센다 - 목록이 끝나 멈추는 것도 반마다
    for (const key of planKeys(plan)) {
      const t = computeProgress(plan, subjectsByDate, isOffDay, progressUntil(plan, plans, key), key);
      const cls = course ? parseSlot(key).cls : undefined;
      for (const s of t.slots) {
        if (s.lesson !== null && s.lesson >= periods.length) break; // 목록이 끝났다
        const at = s.lesson === null ? null : periods[s.lesson];
        out[slotId(s.date, s.period)] = {
          planId: plan.id,
          key: course ? key : plan.key,
          ...(cls ? { cls } : {}),
          index: s.lesson,
          row: at ? at.row : null,
          total: periods.length,
          run: at ? { k: at.k, n: at.n } : { k: 1, n: 1 },
          lesson: at ? plan.lessons[at.row] : null,
          bumped: s.bumped,
        };
      }
    }
  }
  return out;
}

/** 그 차시(index, 0부터)를 하는 첫 교시. 밀린 교시는 건너뛴다. 읽은 범위에 없으면 null (S8) */
export function slotOfLesson(timeline: ProgressTimeline, index: number): ProgressSlot | null {
  return timeline.slots.find((s) => s.lesson === index) || null;
}

/** 과정의 반 열쇠마다 센 결과 (progressMarks와 같은 규칙 - 반마다 이어받는 날까지) */
export function courseTimelines(
  plan: ProgressPlan,
  plans: ProgressPlan[],
  subjectsByDate: Record<string, Record<string, string>>,
  isOffDay: (date: string) => boolean = () => false
): Record<string, ProgressTimeline> {
  const out: Record<string, ProgressTimeline> = {};
  for (const key of planKeys(plan)) {
    out[key] = computeProgress(plan, subjectsByDate, isOffDay, progressUntil(plan, plans, key), key);
  }
  return out;
}

export interface CourseEvalTarget {
  cls: string;
  key: string;
  /** 같은 차시를 하는 교시. 아직 시간표에 없으면(읽은 범위 안에서 그 차시에 닿지 않으면) null */
  slot: ProgressSlot | null;
}

/**
 * '같은 과정의 다른 반에도 조사표 만들기'(S8): 이 교시(mark)와 **같은 차시**를 하는 다른 반의 첫 교시.
 * mark가 과정의 표식이 아니거나 민 교시면 빈 목록. 이 반(mark.key)은 뺀다.
 */
export function planCourseEvals(
  mark: Pick<ProgressMark, 'key' | 'index' | 'cls'>,
  plan: Pick<ProgressPlan, 'key' | 'subject' | 'classes'>,
  timelinesByKey: Record<string, ProgressTimeline>
): CourseEvalTarget[] {
  if (!isCourse(plan) || !mark.cls || mark.index === null) return [];
  const mine = normalizeSlotText(mark.key);
  return planKeys(plan)
    .filter((k) => normalizeSlotText(k) !== mine)
    .map((key) => {
      const t = timelinesByKey[key];
      return { cls: parseSlot(key).cls, key, slot: t ? slotOfLesson(t, mark.index!) : null };
    });
}

/** 과정 현황표의 한 반 (ROADMAP-SUBJECT S5) */
export interface CourseClassStatus {
  cls: string;
  key: string;
  /** 오늘까지 마지막으로 한 차시 (밀린 교시는 빼고). 없으면 null */
  last: ProgressSlot | null;
  /** 내일부터 처음 할 차시. 목록이 끝났거나 읽은 범위에 수업이 없으면 null */
  next: ProgressSlot | null;
  /** 오늘까지 한 차시 수 (목록 길이를 넘지 않는다) */
  done: number;
  total: number;
  /** 가장 앞선 반보다 몇 차시 늦은가 (0이면 가장 앞) */
  behind: number;
  finished: boolean;
}

/**
 * 과정의 반별 위치. timelinesByKey: 반 열쇠('5-1 과학') → computeProgress 결과. 오늘 수업은 한 것으로 센다
 * (진도 관리 창의 '오늘까지 n차시'와 같다). behind는 가장 많이 한 반과의 차이 - 2 이상이면 화면이 '늦음'으로 칠한다.
 */
export function courseStatus(
  plan: Pick<ProgressPlan, 'key' | 'lessons' | 'noCount'> & CourseFields,
  timelinesByKey: Record<string, ProgressTimeline>,
  today: string
): CourseClassStatus[] {
  const total = planPeriods(plan).length;
  const rows: CourseClassStatus[] = planKeys(plan).map((key) => {
    const slots = (timelinesByKey[key]?.slots || []).filter((s) => s.lesson !== null && s.lesson < total);
    const past = slots.filter((s) => s.date <= today);
    const next = slots.find((s) => s.date > today) || null;
    const done = past.length;
    return {
      cls: parseSlot(key).cls || key,
      key,
      last: past[past.length - 1] || null,
      next,
      done,
      total,
      behind: 0,
      finished: total > 0 && done >= total,
    };
  });
  const most = Math.max(0, ...rows.map((r) => r.done));
  for (const r of rows) r.behind = most - r.done;
  return rows;
}

/** 그날 교시마다 하는 차시의 준비물 (알림장 '다음 수업일 불러오기', 5-4). 민 교시·준비물 없는 차시는 뺀다 */
export function suppliesByPeriod(marks: Record<string, ProgressMark>, date: string): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = `${date}#`;
  for (const [id, m] of Object.entries(marks)) {
    if (!id.startsWith(prefix) || m.bumped) continue;
    const supplies = (m.lesson?.supplies || '').trim();
    if (supplies) out[id.slice(prefix.length)] = supplies;
  }
  return out;
}

/** 밀기를 켜고 끈 목록 (날짜·교시 차례로) */
export function toggleBump(bumps: string[], date: string, period: string | number): string[] {
  const id = slotId(date, period);
  const set = new Set(bumps || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set].sort();
}

/** 그 날이 든 학년도의 마지막 날 (학년도는 3월~이듬해 2월) */
export function schoolYearEnd(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const endYear = m >= 3 ? y + 1 : y;
  const leap = (endYear % 4 === 0 && endYear % 100 !== 0) || endYear % 400 === 0;
  return `${endYear}-02-${leap ? 29 : 28}`;
}

// ── 저장된 모양 읽기 ────────────────────────────────────────────────────

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** 저장된 모양을 믿지 않고 고쳐 읽는다 */
export function sanitizePlan(id: string, raw: unknown): ProgressPlan {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const lessons: ProgressLesson[] = Array.isArray(r.lessons)
    ? r.lessons
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
        .map((l) => {
          const links = Array.isArray(l.linkIds) ? [...new Set(l.linkIds.filter((x): x is string => typeof x === 'string' && !!x))] : [];
          return {
            unit: str(l.unit),
            no: str(l.no),
            content: str(l.content),
            page: str(l.page),
            supplies: str(l.supplies),
            ...(links.length ? { linkIds: links } : {}),
          };
        })
    : [];
  const classes = sanitizeClasses(r.classes);
  const course = classes.length > 0 ? { subject: str(r.subject).trim().replace(/\s+/g, ' '), classes } : null;
  return {
    id,
    key: progressKey(r.key) || (course ? planKeys({ key: '', ...course })[0] : ''),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(str(r.startDate)) ? str(r.startDate) : '',
    lessons,
    bumps: Array.isArray(r.bumps) ? r.bumps.filter((b): b is string => typeof b === 'string') : [],
    ...(course || {}),
    ...(r.noCount === true ? { noCount: true } : {}),
  };
}

/** 과정의 반 목록: '5-2' 모양만(앞뒤 공백·'05-02'는 맞춘다), 중복은 하나로, 차례는 그대로 */
export function sanitizeClasses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const m = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(v);
    if (!m || Number(m[1]) < 1 || Number(m[2]) < 1) continue;
    const c = `${Number(m[1])}-${Number(m[2])}`;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** 진도 줄의 교과서 쪽 '12~13쪽' (이미 '쪽'·'p'가 적혀 있으면 그대로, 비면 '') - 19번 U3 */
export function lessonPageLabel(page: string | undefined): string {
  const p = (page || '').trim();
  if (!p) return '';
  return /쪽|p\.?$|page/i.test(p) || /^p\.?\s*\d/i.test(p) ? p : `${p}쪽`;
}

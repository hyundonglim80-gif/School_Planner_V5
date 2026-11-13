// 새 학년도 넘기기 (P9-2 - V5 새 기능, V4에는 없다) - 순수 함수. 화면은 features/newYear.
//   넘기는 것이 없다: 라벨·설정·교시·교사 유형은 그대로 쓰고, 지난 학년도 자료(일정·기록·학급·출석)는 그 자리에 남는다(보기만).
//   새로 하는 것만 고른다 - 새 학급(명렬표 붙여넣기) · 새 시간표(지난 것 베끼기) · 그 학년도 방학(나이스로 채우기) · 담임반.
//   띠는 2/15 ~ 3/31에, 지난 자료가 있는 계정에만, 할 것이 남았고 '준비 끝'을 누르지 않았을 때(common.newYearDone).
import { academicYearOf, addDays } from './dateUtils';
import { cellHasContent, timetableOn, type LessonCellDoc } from './lessons';
import { schoolYearSpan, type SchoolTerms } from './semester';
import { textToGender, type CsvStudent, type RosterClass } from './roster';

/** 띠를 띄우는 학년도 - 2월 15일 ~ 3월 31일이면 그 3월에 시작하는 학년도, 아니면 null */
export function newYearTarget(today: string): number | null {
  const [y, m, d] = today.split('-').map(Number);
  if ((m === 2 && d >= 15) || m === 3) return y;
  return null;
}

/** 띠 밖에서 열면: 3~8월은 올해, 9~2월은 다음 학년도 */
export function defaultNewYear(today: string): number {
  const m = Number(today.slice(5, 7));
  return newYearTarget(today) ?? (m >= 3 && m <= 8 ? academicYearOf(today) : academicYearOf(today) + 1);
}

/** 시간표 한 장 (timetables 문서 - 기간만 본다) */
export interface PeriodTimetable {
  id: string;
  name: string;
  from: string;
  to: string;
  grid: Record<string, Record<string, string>>;
  /** 같은 날 시작한 표 가리기 (화면 `timetableOn`과 같이 - 나중에 만든 것) */
  createdAt?: number;
}

/** 그 학년도 기간에 걸친 시간표가 있나 */
export const timetableInYear = (list: readonly PeriodTimetable[], year: number) => {
  const span = schoolYearSpan(year);
  return list.some((t) => t.from && t.to && t.from <= span.end && t.to >= span.start);
};

/**
 * 베낄 시간표 = 마지막에 쓰던 표: 새 학년도 전날(2월 끝날)에 화면이 쓰는 표(`timetableOn` - 겹치면 늦게 시작한 것 → 나중에 만든 것).
 * 그날 쓰는 표가 없으면 그 전에 시작한 것 중 같은 차례로 첫째.
 * (P26-3 실제 자료 - 같은 날 시작한 표가 둘이면 목록 차례로 골라, 화면이 쓰지 않는 옛 V4 가져온 표를 베꼈다)
 */
export function latestTimetableBefore(list: readonly PeriodTimetable[], year: number): PeriodTimetable | null {
  const start = schoolYearSpan(year).start;
  const before = list.filter((t) => t.from && t.from < start);
  const lastDay = addDays(start, -1);
  const inUse = timetableOn(lastDay, before);
  if (inUse) return inUse;
  const latest = timetableOn(lastDay, before.map((t) => ({ ...t, to: '' })));
  return latest ? (before.find((t) => t.id === latest.id) ?? null) : null;
}

/** 베낀 새 시간표 - 그 학년도 3/1 ~ 이듬해 2월 끝, 이름 '1학기 시간표'(2학기 시간표는 시간표 창에서 '2학기부터'로) */
export function copiedTimetable(src: Pick<PeriodTimetable, 'grid'> | null, year: number): Omit<PeriodTimetable, 'id'> {
  const span = schoolYearSpan(year);
  return {
    name: '1학기 시간표',
    from: span.start,
    to: span.end,
    grid: structuredClone(src?.grid ?? {}),
  };
}

/** 수업 칸 문서 (lessonDays - 날짜가 id) */
export interface DayDocLike {
  id: string;
  periods?: Record<string, LessonCellDoc | undefined>;
  src?: { from?: string };
  deletedAt?: unknown;
}

/**
 * 그 학년도 날짜에 남은 V4에서 가져온 '그날 바꾼 과목' (날짜 차례, 교시들).
 * V4는 시간표를 날짜마다(1년 앞까지) 적어 두었고, 가져오기는 V5 시간표가 없는 날의 칸을 모두 '그날 바꾼 과목'으로 옮겼다 -
 * 새 학년도 시간표를 만들어도 그날은 옛 과목('402' 같은 V4 글)이 보인다(P26-3 실제 자료 - 2027-03 ~ 08 월요일 등 27일).
 */
export function staleImportedSubjects(days: Record<string, DayDocLike>, year: number): Array<{ date: string; periods: string[] }> {
  const span = schoolYearSpan(year);
  const out: Array<{ date: string; periods: string[] }> = [];
  for (const d of Object.values(days)) {
    if (d.deletedAt || d.src?.from !== 'v4' || d.id < span.start || d.id > span.end) continue;
    const periods = Object.entries(d.periods ?? {})
      .filter(([, c]) => typeof c?.subject === 'string')
      .map(([n]) => n)
      .sort((a, b) => Number(a) - Number(b));
    if (periods.length) out.push({ date: d.id, periods });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** 그날 문서에서 과목만 빼는 칸 바꾸기 - 비고·첨부·링크가 남으면 과목 칸만, 없으면 그 교시 칸째 (lessonOps와 같은 꼴) */
export function dropSubjectChanges(doc: DayDocLike, periods: readonly string[]): Record<string, undefined> {
  const changes: Record<string, undefined> = {};
  for (const n of periods) {
    const cell = doc.periods?.[n];
    if (!cell || typeof cell.subject !== 'string') continue;
    const { subject: _drop, ...rest } = cell;
    changes[cellHasContent(rest) ? `periods.${n}.subject` : `periods.${n}`] = undefined;
  }
  return changes;
}

/** 그 학년도 방학을 둘 다 적었나 */
export const termsInYear = (terms: SchoolTerms, year: number) => {
  const t = terms[String(year)];
  return !!(t?.summer?.from && t.summer.to && t.winter?.from && t.winter.to);
};

export interface NewYearState {
  year: number;
  /** 그 학년도 학급 */
  classes: RosterClass[];
  /** 지난 학년도 학급 (보기만 - 명렬표에서 학년도를 골라 본다) */
  lastClasses: RosterClass[];
  timetable: boolean;
  terms: boolean;
  /** 담임반이 그 학년도 학급에 있나 (담임반이 없는 교사 유형이면 true) */
  homeroom: boolean;
}

export function newYearState(
  year: number,
  input: {
    classes: readonly RosterClass[];
    timetables: readonly PeriodTimetable[];
    terms: SchoolTerms;
    homeroomClass: string | null;
  },
): NewYearState {
  const classes = input.classes.filter((c) => c.year === year);
  const hr = input.homeroomClass;
  return {
    year,
    classes,
    lastClasses: input.classes.filter((c) => c.year === year - 1),
    timetable: timetableInYear(input.timetables, year),
    terms: termsInYear(input.terms, year),
    homeroom: hr === null || classes.some((c) => `${c.grade}-${c.num}` === hr),
  };
}

/** 할 것이 남았나 (띠를 띄울지) */
export const newYearPending = (s: NewYearState) => s.classes.length === 0 || !s.timetable || !s.terms || !s.homeroom;

/** 지난 자료가 있나 - 처음 쓰는 계정에는 넘길 것이 없다(교사 유형 띠·가져오기 띠가 먼저) */
export const hasPastData = (
  input: {
    classes: readonly RosterClass[];
    timetables: readonly PeriodTimetable[];
  },
  year: number,
) => input.classes.some((c) => c.year < year) || input.timetables.some((t) => t.from && t.from < schoolYearSpan(year).start);

const GENDER_RE = /^(남|여|남자|여자|M|F|m|f)$/;

/**
 * 붙여 넣은 명단 → 학생. 한 줄에 한 명 - 엑셀 칸(탭)·쉼표·띄어쓰기로 나뉜 '번호 이름 성별' 또는 이름만.
 * 번호가 없으면 줄 차례(1번부터), 머리말 줄('번호 이름…')과 빈 줄은 뺀다. 한 줄에 이름만 여럿(쉼표)이면 그대로 여러 명.
 */
export function parseRosterPaste(text: string): CsvStudent[] {
  const out: CsvStudent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = (line.includes('\t') ? line.split('\t') : line.split(/[,，]\s*|\s+/)).map((c) => c.trim()).filter(Boolean);
    if (cells.some((c) => c === '이름' || c === '번호')) continue;
    const num = /^\d{1,3}$/.test(cells[0]) ? Number(cells[0]) : null;
    const rest = num === null ? cells : cells.slice(1);
    if (num !== null) {
      const name = rest.find((c) => !GENDER_RE.test(c)) ?? '';
      const gender = rest.find((c) => GENDER_RE.test(c));
      out.push({
        num,
        name,
        gender: gender ? textToGender(gender) : '',
        status: 'active',
      });
      continue;
    }
    // 번호가 없으면 성별이 아닌 칸마다 한 명(한 줄에 이름만 여럿)
    const names = rest.filter((c) => !GENDER_RE.test(c) && !/^\d+$/.test(c));
    const gender = names.length === 1 ? rest.find((c) => GENDER_RE.test(c)) : undefined;
    for (const name of names)
      out.push({
        num: 0,
        name,
        gender: gender ? textToGender(gender) : '',
        status: 'active',
      });
  }
  // 번호가 없던 학생은 앞 번호 다음부터
  let next = 1;
  const used = new Set(out.filter((s) => s.num > 0).map((s) => s.num));
  for (const s of out) {
    if (s.num > 0) continue;
    while (used.has(next)) next++;
    s.num = next;
    used.add(next);
  }
  return out.sort((a, b) => a.num - b.num);
}

// ── 교과 전담 새 학급 한꺼번에 (P32-3) ──
//   새 학년도 창 ①의 반 칸에 '1~6'·'1, 3, 5'·'1-4'처럼 적으면 그 학년의 빈 명렬표를 한 번에 만든다(명단은 반마다 명렬표에서).

/** 반 번호 1~30 (명렬표·새 학년도 창과 같다) */
export const MAX_CLASS_NUM = 30;

/**
 * 반 칸 글자 → 반 번호들(작은 것부터, 겹치지 않게). '3' · '1~6'(또는 '1-6') · '1, 3, 5' · '1~3 5' · 전각 숫자·물결도.
 * 읽지 못한 조각(0·31·'4~2'·글자)은 bad - 하나라도 있으면 만들지 않는다(창이 안내).
 */
export function parseClassNums(text: string): { nums: number[]; bad: string[] } {
  const src = String(text ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[～〜∼]/g, '~')
    .replace(/[‐‑‒–—―－−]/g, '-')
    .replace(/，/g, ',')
    .replace(/반/g, ' ')
    .replace(/\s*([~-])\s*/g, '$1');
  const set = new Set<number>();
  const bad: string[] = [];
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_CLASS_NUM;
  for (const piece of src.split(/[,\s]+/).filter(Boolean)) {
    const range = /^(\d{1,2})[~-](\d{1,2})$/.exec(piece);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (ok(from) && ok(to) && from <= to) {
        for (let n = from; n <= to; n++) set.add(n);
        continue;
      }
      bad.push(piece);
      continue;
    }
    if (/^\d{1,2}$/.test(piece) && ok(Number(piece))) set.add(Number(piece));
    else bad.push(piece);
  }
  return { nums: [...set].sort((a, b) => a - b), bad };
}

/** 만들 반과 이미 있는 반 (지운 표시가 있는 학급은 없는 것 - 다시 만든다) */
export function newClassPlan(exists: (id: string) => boolean, c: { year: number; grade: number; nums: readonly number[] }): { make: number[]; skip: number[] } {
  const make: number[] = [];
  const skip: number[] = [];
  for (const num of c.nums) (exists(`${c.year}-${c.grade}-${num}`) ? skip : make).push(num);
  return { make, skip };
}

/** '6학년 1·2·4반' */
export const classNumsLabel = (grade: number, nums: readonly number[]) => `${grade}학년 ${nums.join('·')}반`;

/**
 * 교사 유형 '가르치는 반'을 그 학년도 학급으로 바꿀지 (④ 단계 줄). 바꾸면 빠지는 반(그 학년도 학급에 없는 것)이 있을 때만 -
 * 가르치는 반이 비었거나 새 학급이 다 들어 있으면 null(명렬표의 반은 원래 수업 칸 ▼에 저절로 나온다).
 */
export function teachingClassesOffer(current: readonly string[], yearClasses: readonly Pick<RosterClass, 'grade' | 'num'>[]): { next: string[]; dropped: string[] } | null {
  const next = [...new Set(yearClasses.map((c) => `${c.grade}-${c.num}`))].sort((a, b) => {
    const [ga, ca] = a.split('-').map(Number);
    const [gb, cb] = b.split('-').map(Number);
    return ga - gb || ca - cb;
  });
  if (!next.length) return null;
  const dropped = current.filter((c) => !next.includes(c));
  return dropped.length ? { next, dropped } : null;
}

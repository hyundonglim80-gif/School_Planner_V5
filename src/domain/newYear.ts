// 새 학년도 넘기기 (P9-2 - V5 새 기능, V4에는 없다) - 순수 함수. 화면은 features/newYear.
//   넘기는 것이 없다: 라벨·설정·교시·교사 유형은 그대로 쓰고, 지난 학년도 자료(일정·기록·학급·출석)는 그 자리에 남는다(보기만).
//   새로 하는 것만 고른다 - 새 학급(명렬표 붙여넣기) · 새 시간표(지난 것 베끼기) · 그 학년도 방학(나이스로 채우기) · 담임반.
//   띠는 2/15 ~ 3/31에, 지난 자료가 있는 계정에만, 할 것이 남았고 '준비 끝'을 누르지 않았을 때(common.newYearDone).
import { academicYearOf } from './dateUtils';
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
}

/** 그 학년도 기간에 걸친 시간표가 있나 */
export const timetableInYear = (list: readonly PeriodTimetable[], year: number) => {
  const span = schoolYearSpan(year);
  return list.some((t) => t.from && t.to && t.from <= span.end && t.to >= span.start);
};

/** 베낄 시간표 - 그 학년도 전에 시작한 것 중 가장 늦게 시작한 것(마지막에 쓰던 표) */
export function latestTimetableBefore(list: readonly PeriodTimetable[], year: number): PeriodTimetable | null {
  const start = schoolYearSpan(year).start;
  const before = list.filter((t) => t.from && t.from < start);
  return before.sort((a, b) => b.from.localeCompare(a.from))[0] ?? null;
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

// 년간 (V4 lib/yearSheet.ts·dateUtils.getAcademicMonths). 셈만 한다 - 그리는 것은 features/year.
//
//   학사력: 열두 달을 작은 달력으로 늘어놓고, 날짜 칸에는 공휴일·D-Day·학사일정·'달력' 일정을 점과 막대로만,
//   달 아래에는 그 달의 것을 날짜 차례로 한 줄씩 적는다. 수업은 그리지 않는다(그것은 '자세히').
//   공휴일·D-Day는 P5-3, 학사일정(나이스)은 P6-3이 넣는다 - 그 전에는 비어 있다.
import type { ShownPeriod } from './periodBars';

const pad = (n: number) => String(n).padStart(2, '0');

export interface AcademicMonth {
  year: number;
  month: number;
  /** 'YYYY-MM' */
  key: string;
  label: string;
  semester: 1 | 2;
}

/** 학년도의 열두 달: 1학기 3~8월, 2학기 9~12월과 이듬해 1~2월 (V4 그대로) */
export function academicMonths(academicYear: number): AcademicMonth[] {
  const out: AcademicMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const month = ((i + 2) % 12) + 1;
    const year = month >= 3 ? academicYear : academicYear + 1;
    out.push({ year, month, key: `${year}-${pad(month)}`, label: `${month}월`, semester: month >= 3 && month <= 8 ? 1 : 2 });
  }
  return out;
}

/**
 * 한 달을 주(일~토)로 나눈다. 칸 밖 날은 null.
 * 주말을 숨기면 월~금 다섯 칸으로, 그러고 나서 빈 주(1일이 토요일인 달의 첫 주 등)는 뺀다.
 */
export function monthWeeks(year: number, month: number, showWeekend: boolean): (string | null)[][] {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    const shown = showWeekend ? week : week.slice(1, 6);
    if (shown.some(Boolean)) weeks.push(shown);
  }
  return weeks;
}

export type SheetItemKind = 'holiday' | 'dday' | 'school' | 'period' | 'event';

export interface SheetItem<T> {
  date: string;
  kind: SheetItemKind;
  text: string;
  /** 기간 일정: 이 달에서 마지막 날 */
  endDate?: string;
  /** 일정·기간 일정 */
  item?: T;
  /** 끝낸 것 (기간은 이 달에 든 날을 모두 끝냈을 때) */
  done?: boolean;
  /** 기간이 앞 달에서 이어지나 / 다음 달로 이어지나 */
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}

const KIND_ORDER: Record<SheetItemKind, number> = { holiday: 0, dday: 1, school: 2, period: 3, event: 4 };

export interface SheetSources<T> {
  /** 그 달에서 보일 날짜 (주말을 숨기면 평일만) */
  dates: readonly string[];
  /** 그날 하루짜리 달력 일정 (차례대로) */
  eventsOn: (date: string) => readonly T[];
  /** 이 달에 걸친 기간 일정 (periodsInDates) */
  periods: readonly ShownPeriod<T>[];
  textOf: (item: T) => string;
  doneOn: (item: T, date: string) => boolean;
  /** 공휴일 이름 (P5-3) */
  holidayOf?: (date: string) => string | undefined;
  /** D-Day (P5-3) */
  ddays?: readonly { id: string; title: string; date: string }[];
  /** 학사일정 이름들 (P6-3) */
  schoolOf?: (date: string) => readonly string[] | undefined;
}

/** 달 아래 목록: 날짜 차례, 같은 날은 공휴일 → D-Day → 학사일정 → 기간 → 일정 */
export function monthSheetItems<T>(src: SheetSources<T>): SheetItem<T>[] {
  const shown = new Set(src.dates);
  const items: SheetItem<T>[] = [];
  for (const date of src.dates) {
    const holiday = src.holidayOf?.(date);
    if (holiday) items.push({ date, kind: 'holiday', text: holiday });
    const school = src.schoolOf?.(date);
    if (school?.length) items.push({ date, kind: 'school', text: school.join(' · ') });
    for (const item of src.eventsOn(date)) items.push({ date, kind: 'event', text: src.textOf(item), item, done: src.doneOn(item, date) });
  }
  for (const dd of src.ddays ?? []) if (shown.has(dd.date)) items.push({ date: dd.date, kind: 'dday', text: dd.title });
  for (const p of src.periods) {
    items.push({
      date: p.cells[0].date,
      kind: 'period',
      text: src.textOf(p.item),
      endDate: p.cells[p.cells.length - 1].date,
      item: p.item,
      done: p.cells.every((c) => src.doneOn(p.item, c.date)),
      continuesBefore: !p.startsPeriod,
      continuesAfter: !p.endsPeriod,
    });
  }
  // 정렬은 안정적이다 - 같은 날·같은 종류는 넣은 차례(그날 일정 차례) 그대로
  return items.sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** 날짜 칸에 걸 풍선 글 (그날 것을 줄마다 - 기간은 가운데 날에도) */
export function dayTooltip<T>(date: string, items: readonly SheetItem<T>[]): string {
  const lines = items
    .filter((it) => it.date === date || (it.kind === 'period' && it.endDate && it.date <= date && date <= it.endDate))
    .map((it) => {
      if (it.kind === 'holiday') return `🔴 ${it.text}`;
      if (it.kind === 'dday') return `🎯 ${it.text}`;
      if (it.kind === 'school') return `🏫 ${it.text}`;
      if (it.kind === 'period') return `📆 ${it.text}`;
      return `• ${it.text}`;
    });
  const md = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
  return lines.length ? `${md}\n${lines.join('\n')}` : md;
}

// 인쇄 창의 쪽 셈 (⋮ '🖨️ 이 화면 인쇄'·Ctrl+P - features/print). 화면(하루·주간·월간·년간)과 구간(시작 ~ 끝)에서 찍을 쪽들을 낸다.
//   - 쪽 하나 = 그 화면 한 판: 하루 = 그날, 주간 = 그 주(월요일), 월간 = 그 달(1일), 년간 = 그 학년도(3월 1일).
//   - 구간은 달력에서 날짜를 골라 정한다 - 고른 날이 든 주·달·학년도로 맞춘다.
//   - 쪽이 너무 많으면 앞에서 MAX_PRINT_PAGES쪽만(한 판마다 화면 하나를 그린다).
import { academicYearOf, addDays, addMonthsStr, DAY_NAMES, weekMonday, weekdayOf } from './dateUtils';

export type PrintPage = 'day' | 'week' | 'month' | 'year';

export const PRINT_PAGES: ReadonlyArray<{ id: PrintPage; label: string; unit: string }> = [
  { id: 'day', label: '하루', unit: '날' },
  { id: 'week', label: '주간', unit: '주' },
  { id: 'month', label: '월간', unit: '달' },
  { id: 'year', label: '년간', unit: '학년도' },
];

/** 한 번에 찍는 쪽 수의 끝 */
export const MAX_PRINT_PAGES = 31;

/** 처음 고른 용지 방향 - 하루는 세로(수업·일정·메모가 위아래로 길다), 나머지는 가로 */
export const DEFAULT_LANDSCAPE: Record<PrintPage, boolean> = { day: false, week: true, month: true, year: true };

/** 보는 화면 → 처음 고른 쪽 (메모·학급 화면은 하루) */
export function printPageOfScope(scope: string): PrintPage {
  return scope === 'week' || scope === 'month' || scope === 'year' ? scope : 'day';
}

/** 그 날이 든 쪽의 첫날 */
export function pageStart(page: PrintPage, date: string): string {
  if (page === 'week') return weekMonday(date);
  if (page === 'month') return `${date.slice(0, 7)}-01`;
  if (page === 'year') return `${academicYearOf(date)}-03-01`;
  return date;
}

/** 다음 쪽의 첫날 */
export function nextPageStart(page: PrintPage, start: string): string {
  if (page === 'week') return addDays(start, 7);
  if (page === 'month') return addMonthsStr(start, 1);
  if (page === 'year') return `${Number(start.slice(0, 4)) + 1}-03-01`;
  return addDays(start, 1);
}

/** 구간(고른 두 날 - 차례는 상관없다)의 쪽들 (첫날들). 넘치면 앞 MAX_PRINT_PAGES쪽과 모두 몇 쪽인지 */
export function printPageStarts(page: PrintPage, from: string, to: string, max = MAX_PRINT_PAGES): { starts: string[]; total: number } {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const last = pageStart(page, b);
  const starts: string[] = [];
  let total = 0;
  for (let d = pageStart(page, a); d <= last; d = nextPageStart(page, d)) {
    total++;
    if (starts.length < max) starts.push(d);
  }
  return { starts, total };
}

const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

/** 쪽 제목 - 주간은 보이는 요일(주말을 감추면 월 ~ 금)로 */
export function printPageTitle(page: PrintPage, start: string, showWeekend = true): string {
  const y = start.slice(0, 4);
  if (page === 'week') return `${y}년 ${md(start)} ~ ${md(addDays(start, showWeekend ? 6 : 4))} 주간`;
  if (page === 'month') return `${y}년 ${Number(start.slice(5, 7))}월`;
  if (page === 'year') return `${y}학년도 학사력`;
  return `${y}년 ${Number(start.slice(5, 7))}월 ${Number(start.slice(8, 10))}일 (${DAY_NAMES[weekdayOf(start)]})`;
}

/** 구간 단추에 적는 글 - 하루 '10/23(금)', 주간 '10.19 ~ 10.25', 월간 '2026년 10월', 년간 '2026학년도' */
export function printRangeLabel(page: PrintPage, date: string): string {
  const s = pageStart(page, date);
  if (page === 'week') return `${s.slice(0, 4)}. ${md(s)} ~ ${md(addDays(s, 6))}`;
  if (page === 'month') return `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월`;
  if (page === 'year') return `${s.slice(0, 4)}학년도`;
  return `${s.slice(0, 4)}. ${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}(${DAY_NAMES[weekdayOf(s)]})`;
}

/** A4 한 장의 찍히는 칸 (mm, 여백을 뺀) */
export function paperSizeMm(landscape: boolean, marginMm: number): { width: number; height: number } {
  const [w, h] = landscape ? [297, 210] : [210, 297];
  return { width: w - marginMm * 2, height: h - marginMm * 2 };
}

/** mm → CSS px (인쇄는 1in = 96px) */
export const mmToPx = (mm: number) => (mm * 96) / 25.4;

// 기간 일정 막대 (V4 lib/periodBars.ts의 V5판 - 셈만, 그리는 것은 월간·년간).
// V4는 날마다 따로 저장된 조각('기말고사 (2/5)')을 글과 groupId로 이어 붙였다. V5의 기간 일정은 문서 하나(date ~ endDate)라
// 그 날들을 그대로 막대로 놓는다(DESIGN 5-3) - 주말 빼기·뺀 날(skipDates)이 끼면 그 자리에서 막대가 끊긴다.
import { periodDays, type HolidayCheck, type PeriodItem } from './period';

export interface BarCell {
  date: string;
  /** 줄 안의 칸 (0부터) */
  col: number;
  /** 며칠째 (1부터) */
  index: number;
}

export interface WeekBar<T> {
  item: T;
  /** 시작 칸 (0부터) */
  start: number;
  /** 몇 칸 */
  len: number;
  /** 몇째 막대 줄 (0부터) */
  lane: number;
  cells: BarCell[];
  /** 모두 며칠 */
  total: number;
  /** 기간의 첫날에서 시작하나 (아니면 앞 주·앞 달에서 이어진다) */
  startsPeriod: boolean;
  /** 기간의 끝날에서 끝나나 */
  endsPeriod: boolean;
}

/**
 * 한 줄(달력 한 주 - 보이는 날들)의 기간 일정을 막대로.
 *   - 그 줄의 나란한 칸에 보이는 날이 이어지면 한 막대, 사이가 비면(뺀 날·주말) 두 막대.
 *   - 줄은 먼저 시작하는 것, 같으면 긴 것부터 비어 있는 가장 위 줄에 (V4 그대로).
 */
export function layoutWeekBars<T extends PeriodItem & { id: string }>(dates: readonly string[], periods: readonly T[], isHoliday?: HolidayCheck): { bars: WeekBar<T>[]; lanes: number } {
  const colOf = new Map(dates.map((d, i) => [d, i]));
  const runs: Omit<WeekBar<T>, 'lane'>[] = [];
  for (const item of periods) {
    const days = periodDays(item, isHoliday);
    if (days.length < 2) continue;
    const total = days.length;
    let run: BarCell[] = [];
    const flush = () => {
      if (run.length === 0) return;
      runs.push({ item, start: run[0].col, len: run.length, cells: run, total, startsPeriod: run[0].index === 1, endsPeriod: run[run.length - 1].index === total });
      run = [];
    };
    days.forEach((date, i) => {
      const col = colOf.get(date);
      if (col === undefined) {
        flush();
        return;
      }
      if (run.length > 0 && run[run.length - 1].col !== col - 1) flush();
      run.push({ date, col, index: i + 1 });
    });
    flush();
  }
  runs.sort((a, b) => a.start - b.start || b.len - a.len || a.item.id.localeCompare(b.item.id));
  const laneEnds: number[] = [];
  const bars = runs.map((run) => {
    let lane = laneEnds.findIndex((end) => end < run.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(-1);
    }
    laneEnds[lane] = run.start + run.len - 1;
    return { ...run, lane };
  });
  return { bars, lanes: laneEnds.length };
}

const md = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;

/** 막대에 붙일 범위 글: '10.5 ~ 10.9 · 5일' (하루면 '10.5') */
export function periodRangeLabel(cells: readonly { date: string }[]): string {
  if (cells.length === 0) return '';
  const first = cells[0].date;
  const last = cells[cells.length - 1].date;
  return first === last ? md(first) : `${md(first)} ~ ${md(last)} · ${cells.length}일`;
}

/** 며칠째 범위: '1~3/5' (하루면 '2/5') */
export function periodIndexLabel(cells: readonly { index: number }[], total: number): string {
  if (cells.length === 0) return '';
  const a = cells[0].index;
  const b = cells[cells.length - 1].index;
  return a === b ? `${a}/${total}` : `${a}~${b}/${total}`;
}

export interface ShownPeriod<T> {
  item: T;
  /** 보이는 날들 가운데 이 기간이 걸친 날 (차례대로) */
  cells: { date: string; index: number }[];
  /** 모두 며칠 */
  total: number;
  startsPeriod: boolean;
  endsPeriod: boolean;
}

/**
 * 보이는 날들(년간의 한 달 - 주말을 감추면 평일만)에 걸친 기간 일정을 하나씩 (V4 collapsePeriods).
 * 년간은 기간을 날마다 늘어놓지 않고 그 달에서 처음 보이는 날 한 번만 범위와 함께 보인다.
 */
export function periodsInDates<T extends PeriodItem>(dates: readonly string[], periods: readonly T[], isHoliday?: HolidayCheck): ShownPeriod<T>[] {
  const shown = new Set(dates);
  const out: ShownPeriod<T>[] = [];
  for (const item of periods) {
    const days = periodDays(item, isHoliday);
    if (days.length < 2) continue;
    const cells = days.flatMap((date, i) => (shown.has(date) ? [{ date, index: i + 1 }] : []));
    if (cells.length === 0) continue;
    out.push({ item, cells, total: days.length, startsPeriod: cells[0].index === 1, endsPeriod: cells[cells.length - 1].index === days.length });
  }
  return out;
}

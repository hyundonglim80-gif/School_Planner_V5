// 기간 일정 (DESIGN 5-3) - 한 항목(date ~ endDate)이 여러 날에 보인다. 날마다의 '(2/5)'·빠지는 날은 계산한다(원칙 4).
//
// V4는 기간을 날마다 한 일정씩 만들고 글 끝에 '(2/5)'를 붙여 적었다(PeriodModal). V5는 한 문서:
//   - workdays: 주말(토·일)과 공휴일은 빼고 센다(V4 '주말과 공휴일 제외하고 계산하기' - 기본 켬). 공휴일은 P5-3이 isHoliday로 넣는다(그 전에는 주말만).
//   - skipDates: '이 날만 지우기'로 뺀 날(한 문서를 그대로 두고 그날만 뺀다 - V4에서 가져온 기간의 빈 날도 이것으로, P3-4).
//   - doneDates: 날마다 완료. 모든 날을 끝내면 done도 켠다(이월·알림이 끝낸 것으로 본다).
import { addDays, daysBetween, weekdayOf } from './dateUtils';

export interface PeriodItem {
  date: string | null;
  endDate?: string;
  workdays?: boolean;
  skipDates?: readonly string[];
  doneDates?: readonly string[];
  done?: boolean;
}

/** 그날이 공휴일인가 (P5-3 공휴일 표가 준다 - 없으면 주말만 뺀다) */
export type HolidayCheck = (date: string) => boolean;
let current: HolidayCheck = () => false;
/**
 * 따로 넘기지 않으면 쓰는 공휴일 (data/holidays가 표를 받으면 넣는다 - 화면마다 넘기지 않아도 주말 빼기 기간이 공휴일을 건너뛴다).
 * 시험은 넘기지 않으면 공휴일 없이 센다(아무도 넣지 않았다).
 */
export function setDefaultHolidayCheck(check: HolidayCheck) {
  current = check;
}
const noHoliday: HolidayCheck = (date) => current(date);

/** 기간은 한 번에 이만큼까지 (V4 MAX_DAYS - 날마다 문서를 만들던 한도를 그대로 칸의 한도로) */
export const MAX_PERIOD_DAYS = 500;

export const isPeriod = (d: Pick<PeriodItem, 'date' | 'endDate'>): boolean => !!d.date && !!d.endDate && d.endDate > d.date;

export const isWeekend = (date: string) => {
  const w = weekdayOf(date);
  return w === 0 || w === 6;
};

/** 기간 안의 그날이 쉬는 날이라 빠지나 (workdays일 때 주말·공휴일) */
export const offDay = (date: string, isHoliday: HolidayCheck = noHoliday) => isWeekend(date) || isHoliday(date);

/** 그날 이 기간 일정이 보이나 (범위 안 · 뺀 날 아님 · workdays면 쉬는 날 아님) */
export function onPeriodDay(item: PeriodItem, date: string, isHoliday: HolidayCheck = noHoliday): boolean {
  if (!item.date || !item.endDate || date < item.date || date > item.endDate) return false;
  if (item.skipDates?.includes(date)) return false;
  return !(item.workdays && offDay(date, isHoliday));
}

/** 이 기간 일정이 보이는 날 (차례대로) */
export function periodDays(item: PeriodItem, isHoliday: HolidayCheck = noHoliday): string[] {
  if (!item.date) return [];
  if (!isPeriod(item)) return [item.date];
  const out: string[] = [];
  const n = Math.min(daysBetween(item.date, item.endDate!), MAX_PERIOD_DAYS * 2);
  for (let i = 0; i <= n; i++) {
    const d = addDays(item.date, i);
    if (onPeriodDay(item, d, isHoliday)) out.push(d);
  }
  return out;
}

/** 날짜 범위의 날 수 (끝 날을 고를 때 'N일 (주말 M일 빼고)') */
export function spanCount(start: string, end: string, workdays: boolean, isHoliday: HolidayCheck = noHoliday): { days: number; off: number } {
  if (!start || !end || end < start) return { days: 0, off: 0 };
  const total = daysBetween(start, end) + 1;
  let off = 0;
  if (workdays) for (let i = 0; i < total; i++) if (offDay(addDays(start, i), isHoliday)) off++;
  return { days: total - off, off };
}

/** 그날의 '(k/n)' - 그날 보이지 않으면 null, 하루짜리면 null */
export function periodPosition(item: PeriodItem, date: string, isHoliday: HolidayCheck = noHoliday): { k: number; n: number } | null {
  if (!isPeriod(item)) return null;
  const days = periodDays(item, isHoliday);
  const k = days.indexOf(date);
  return k < 0 || days.length < 2 ? null : { k: k + 1, n: days.length };
}

/** 그날 끝냈나 (모두 끝냈으면 날마다 끝낸 것) */
export const periodDoneOn = (item: PeriodItem, date: string) => !!item.done || !!item.doneDates?.includes(date);

type Fields = Record<string, unknown>;

/** 그날 완료·풀기에 바꿀 칸: doneDates (모든 날을 끝내면 done도) */
export function periodDoneChanges(item: PeriodItem, date: string, done: boolean, now = Date.now(), isHoliday: HolidayCheck = noHoliday): Fields {
  const days = periodDays(item, isHoliday);
  const set = new Set(item.done ? days : (item.doneDates ?? []));
  if (done) set.add(date);
  else set.delete(date);
  const list = days.filter((d) => set.has(d));
  const all = list.length === days.length;
  const out: Fields = { doneDates: list.length > 0 && !all ? list : undefined };
  if (all !== !!item.done) {
    out.done = all;
    out.doneAt = all ? now : undefined;
  }
  return out;
}

/** '이 날만 지우기' = 그날을 skipDates에 (남는 날이 없으면 null - 항목을 지운다) */
export function skipDayChanges(item: PeriodItem, date: string, isHoliday: HolidayCheck = noHoliday): Fields | null {
  const left = periodDays(item, isHoliday).filter((d) => d !== date);
  if (left.length === 0) return null;
  const skip = [...new Set([...(item.skipDates ?? []), date])].sort();
  const out: Fields = { skipDates: skip };
  if (item.doneDates?.includes(date)) out.doneDates = item.doneDates.filter((d) => d !== date);
  return out;
}

/**
 * '이 날부터 지우기' = 끝 날을 그 앞의 마지막 날로 당긴다 (앞에 남는 날이 없으면 null - 항목을 지운다).
 * 하루만 남으면 하루짜리 일정이 된다(끝 날·빼는 날 칸을 걷고, 그날 끝냈으면 done).
 */
export function cutFromChanges(item: PeriodItem, date: string, now = Date.now(), isHoliday: HolidayCheck = noHoliday): Fields | null {
  const before = periodDays(item, isHoliday).filter((d) => d < date);
  if (before.length === 0 || !item.date) return null;
  const end = before[before.length - 1];
  const out: Fields = {};
  if (end === item.date) {
    out.endDate = undefined;
    if (item.workdays) out.workdays = undefined;
    if (item.skipDates) out.skipDates = undefined;
    if (item.doneDates) out.doneDates = undefined;
    const doneThatDay = periodDoneOn(item, end);
    if (doneThatDay !== !!item.done) {
      out.done = doneThatDay;
      out.doneAt = doneThatDay ? now : undefined;
    }
    return out;
  }
  out.endDate = end;
  if (item.skipDates?.some((d) => d > end)) {
    const kept = item.skipDates.filter((d) => d <= end);
    out.skipDates = kept.length ? kept : undefined;
  }
  if (!item.done) {
    const kept = (item.doneDates ?? []).filter((d) => d <= end);
    // 남은 날을 모두 끝냈으면 done (doneDates는 걷는다)
    const all = before.every((d) => kept.includes(d));
    const next = kept.length && !all ? kept : undefined;
    if (JSON.stringify(next ?? null) !== JSON.stringify(item.doneDates ?? null)) out.doneDates = next;
    if (all) {
      out.done = true;
      out.doneAt = now;
    }
  }
  return out;
}

/** 기간을 통째로 days날 옮길 때 함께 옮기는 날 칸 (skipDates·doneDates) */
export function shiftDates(dates: readonly string[] | undefined, days: number): string[] | undefined {
  return dates?.length ? dates.map((d) => addDays(d, days)) : undefined;
}

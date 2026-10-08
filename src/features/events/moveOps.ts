// 일정을 다른 날로 끌어 옮기기 - '무엇을 적나' (순수 - 서버 없이 시험한다). 적는 것은 actions.ts `moveEventTo`, 끌기는 drag.ts.
//
// - 하루짜리(묶음 아님): date만 그 날로(그 날 맨 뒤 차례), 알림은 그 날 다시 울린다. 완료·라벨·속성·링크는 그대로(V4).
// - 기간(한 문서 - DESIGN 5-3): 이 날만 = 그날을 기간에서 빼고 그 날에 하루 일정으로(여러 개 고르기의 옮기기와 같다) ·
//   기간 통째로 = 같은 날 수만큼(끝 날·뺀 날·끝낸 날도 함께). '이 날부터'는 없다(기간이 두 문서로 갈라진다 - PLAN 5장 P5-3).
// - 반복(문서 여럿 - DESIGN 4-4): 이 날만 = 그 항목 · 이 날부터·전부 = 고른 항목을 같은 날 수만큼(V4 GroupMoveModal).
import { addDays, daysBetween } from '../../domain/dateUtils';
import { isPeriod, offDay, periodDays, shiftDates, type HolidayCheck } from '../../domain/period';
import { writeOp, type Changes, type WriteOp } from '../../data/repo/ops';
import type { LabelTree } from '../../data/select';
import { effectiveAttrs } from './eventForm';
import { doneOnDay, itemPath, type ItemDoc } from './eventOps';
import { multiMoveOps } from './multiOps';
import { editSeriesOps, scopeItems, type SeriesDoc } from './seriesOps';

export type MoveScope = 'only' | 'after' | 'all';

/** 이 일정 하나(기간이면 그 날 하나)만 to로 - 그 날 맨 뒤 차례. 이미 그 날이면 [] */
export function moveOnlyOps(sid: string, item: ItemDoc, day: string, to: string, order: string, newId: () => string): WriteOp[] {
  return multiMoveOps(sid, [{ item, days: [day] }], to, [order], newId).ops;
}

/** 기간을 통째로 days날 (끝 날·뺀 날·끝낸 날도 함께) */
export function shiftPeriodOps(sid: string, item: ItemDoc, days: number): WriteOp[] {
  if (!days || !item.date || !item.endDate) return [];
  const c: Record<string, unknown> = { date: addDays(item.date, days), endDate: addDays(item.endDate, days) };
  if (item.skipDates?.length) c.skipDates = shiftDates(item.skipDates, days);
  if (item.doneDates?.length) c.doneDates = shiftDates(item.doneDates, days);
  if (item.alarmDone && item.time) c.alarmDone = undefined;
  return [writeOp.patch(itemPath(sid, item.id), c as Changes<'items'>, item)];
}

/** 반복 묶음의 이 날부터·전부를 같은 날 수만큼 (item에서 to까지) */
export function shiftSeriesOps(sid: string, item: ItemDoc, to: string, scope: 'after' | 'all', list: readonly ItemDoc[], series: SeriesDoc | undefined): WriteOp[] {
  if (!item.date || item.date === to) return [];
  return editSeriesOps(sid, item, { date: to }, scopeItems(list, item, scope), series, false);
}

/** 범위 창에 미리 보일 것: 옮길 건수(기간은 날 수)·옮겨 갈 범위·쉬는 날(주말·공휴일)에 놓이는 수 */
export interface MovePreview {
  count: number;
  from: [string, string];
  to: [string, string];
  /** 쉬는 날에 놓이는 수 (기간의 주말 빼기는 다시 세므로 0) */
  offDays: number;
  /** 기간 통째로: 옮긴 뒤의 날 수 (주말 빼기면 달라질 수 있다) */
  daysAfter?: number;
}

export function periodMovePreview(item: ItemDoc, days: number, isHoliday?: HolidayCheck): MovePreview {
  const list = periodDays(item, isHoliday);
  const start = item.date!;
  const end = item.endDate ?? start;
  const to: [string, string] = [addDays(start, days), addDays(end, days)];
  const after = periodDays({ ...item, date: to[0], endDate: to[1], skipDates: shiftDates(item.skipDates, days) }, isHoliday);
  return {
    count: list.length,
    from: [start, end],
    to,
    offDays: item.workdays ? 0 : after.filter((d) => offDay(d, isHoliday)).length,
    daysAfter: after.length,
  };
}

export function seriesMovePreview(targets: readonly ItemDoc[], days: number, isHoliday?: HolidayCheck): MovePreview {
  const dates = targets.map((t) => t.date ?? '').filter(Boolean);
  const moved = dates.map((d) => addDays(d, days));
  return {
    count: targets.length,
    from: [dates[0] ?? '', dates[dates.length - 1] ?? ''],
    to: [moved[0] ?? '', moved[moved.length - 1] ?? ''],
    offDays: moved.filter((d) => offDay(d, isHoliday)).length,
  };
}

/** 며칠 옮기나 ('3일 뒤로' / '2일 앞으로') */
export const shiftLabel = (from: string, to: string) => {
  const n = daysBetween(from, to);
  return n > 0 ? `${n}일 뒤로` : `${-n}일 앞으로`;
};

/** 묶음이라 범위를 물어야 하나 */
export const needsMoveScope = (item: ItemDoc) => isPeriod(item) || !!item.seriesId;

/** 끝내지 않은 이월 일정을 지난 날로 옮기나 (오늘 칸에 다시 따라온다 - 안내에 덧붙인다, V4 movesForwardIntoPast) */
export const movesForwardIntoPast = (item: ItemDoc, day: string, to: string, today: string, tree: LabelTree) =>
  to < today && !doneOnDay(item, day) && effectiveAttrs({ labelIds: item.labelIds ?? [], props: item.props ?? {} }, tree).forward;

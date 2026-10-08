// 여러 개 고르기의 쓰기 - '무엇을 적나' (순수 - 서버 없이 시험한다). 적는 것은 actions.ts. 모두 한 묶음(되돌리기 하나).
//
// - 완료: 끝내지 않은 것만(이미 끝낸 것은 그대로 - V4). 기간 일정은 고른 날만(doneDates), 오늘 칸에 따라오던 일정은 오늘로 옮겨 적는다(이월 끝내기).
// - 라벨: 고른 일정의 라벨을 하나로 바꾸거나 뗀다(V4 그대로). 따로 정한 속성은 걷는다(일정 칸에서 라벨을 바꿀 때와 같다).
// - 옮기기: 모두 한 날로. 이미 그 날인 것은 그대로. 기간 일정은 고른 날만 - 그날을 기간에서 빼고 그 날에 하루 일정으로(V4 '고른 것만').
// - 지우기: 지운 표시. 기간 일정은 고른 날만(skipDates - 남는 날이 없으면 지운 표시).
// 한 일정을 여러 날 골랐으면(기간) 그 일정 문서에 한 번에 적는다(같은 묶음에서 같은 문서를 두 번 고치면 앞의 것이 덮인다).
import { doneChanges, carriedDoneChanges, itemPath, type ItemDoc } from './eventOps';
import { isPeriod, periodDoneChanges, periodDoneOn, skipDayChanges } from '../../domain/period';
import { writeOp, type Changes, type WriteOp } from '../../data/repo/ops';
import type { EventPick } from './multi';

export interface Picked {
  item: ItemDoc;
  days: string[];
}

/** 고른 것을 일정마다 모은다 (지웠거나 없는 일정은 뺀다) */
export function resolvePicks(picks: readonly EventPick[], items: Readonly<Record<string, ItemDoc>>): Picked[] {
  const out = new Map<string, Picked>();
  for (const p of picks) {
    const item = items[p.id];
    if (!item || item.deletedAt) continue;
    const got = out.get(p.id) ?? { item, days: [] };
    if (!got.days.includes(p.day)) got.days.push(p.day);
    out.set(p.id, got);
  }
  return [...out.values()];
}

/** 고른 수 (일정·날) */
export const pickedCount = (list: readonly Picked[]) => list.reduce((n, p) => n + (isPeriod(p.item) ? p.days.length : 1), 0);

type Fields = Record<string, unknown>;

/** 한 문서에 여러 날의 바꿈을 차례로 접는다 */
function fold(item: ItemDoc, days: readonly string[], step: (cur: ItemDoc, day: string) => Fields | null): Fields | null {
  let cur = item;
  let all: Fields = {};
  for (const day of days) {
    const c = step(cur, day);
    if (c === null) return null;
    all = { ...all, ...c };
    cur = { ...cur, ...c } as ItemDoc;
  }
  return all;
}

export function multiDoneOps(
  sid: string,
  list: readonly Picked[],
  opts: { today: string; carriedIds: ReadonlySet<string>; orderToday: () => string; now?: number },
): WriteOp[] {
  const now = opts.now ?? Date.now();
  const ops: WriteOp[] = [];
  for (const { item, days } of list) {
    let c: Fields | null;
    if (isPeriod(item)) {
      const open = days.filter((d) => !periodDoneOn(item, d));
      c = open.length ? fold(item, open, (cur, d) => periodDoneChanges(cur, d, true, now)) : null;
    } else if (item.done) c = null;
    else if (opts.carriedIds.has(item.id) && days.includes(opts.today)) c = carriedDoneChanges(item, opts.today, opts.orderToday(), now);
    else c = doneChanges(true, now);
    if (c && Object.keys(c).length) ops.push(writeOp.patch(itemPath(sid, item.id), c as Changes<'items'>, item));
  }
  return ops;
}

export function multiLabelOps(sid: string, list: readonly Picked[], labelId: string | null): WriteOp[] {
  const next = labelId ? [labelId] : [];
  const ops: WriteOp[] = [];
  for (const { item } of list) {
    const c: Fields = {};
    if (JSON.stringify(item.labelIds ?? []) !== JSON.stringify(next)) c.labelIds = next;
    if (item.props && c.labelIds) c.props = undefined;
    if (Object.keys(c).length) ops.push(writeOp.patch(itemPath(sid, item.id), c as Changes<'items'>, item));
  }
  return ops;
}

export interface MoveResult {
  ops: WriteOp[];
  moved: number;
  /** 이미 그 날인 것 */
  same: number;
}

/**
 * 모두 to로. orders = 그 날 목록의 맨 뒤부터 차례로 쓸 차례 값(옮기는 수만큼 넉넉히), newId = 기간에서 떼어 낸 하루 일정의 id.
 */
export function multiMoveOps(sid: string, list: readonly Picked[], to: string, orders: readonly string[], newId: () => string): MoveResult {
  const ops: WriteOp[] = [];
  let moved = 0;
  let same = 0;
  let k = 0;
  const nextOrder = () => orders[k++] ?? orders[orders.length - 1];
  for (const { item, days } of list) {
    if (!isPeriod(item)) {
      if (item.date === to) {
        same++;
        continue;
      }
      const c: Fields = { date: to, order: nextOrder() };
      if (item.alarmDone && item.time) c.alarmDone = undefined;
      ops.push(writeOp.patch(itemPath(sid, item.id), c as Changes<'items'>, item));
      moved++;
      continue;
    }
    // 기간: 고른 날을 빼고 그 날에 하루 일정으로 (to가 그 기간에서 보이는 날이어도 하루 일정을 따로 둔다 - 고른 것만 옮긴다)
    const away = days.filter((d) => d !== to);
    same += days.length - away.length;
    if (away.length === 0) continue;
    const skip = fold(item, away, (cur, d) => skipDayChanges(cur, d));
    if (skip) ops.push(writeOp.patch(itemPath(sid, item.id), skip as Changes<'items'>, item));
    else ops.push(writeOp.remove(itemPath(sid, item.id)));
    for (const d of away) {
      const done = periodDoneOn(item, d);
      ops.push(
        writeOp.create(itemPath(sid, newId()), {
          kind: 'event',
          date: to,
          text: item.text,
          labelIds: [...(item.labelIds ?? [])],
          order: nextOrder(),
          ...(item.props ? { props: item.props } : {}),
          ...(item.time && d === item.date ? { time: item.time } : {}),
          ...(item.due ? { due: item.due } : {}),
          ...(done ? { done: true } : {}),
        }),
      );
      moved++;
    }
  }
  return { ops, moved, same };
}

export function multiDeleteOps(sid: string, list: readonly Picked[]): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const { item, days } of list) {
    const skip = isPeriod(item) ? fold(item, days, (cur, d) => skipDayChanges(cur, d)) : null;
    ops.push(skip ? writeOp.patch(itemPath(sid, item.id), skip as Changes<'items'>, item) : writeOp.remove(itemPath(sid, item.id)));
  }
  return ops;
}

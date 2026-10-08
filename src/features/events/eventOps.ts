// 일정 쓰기에서 '무엇을 적나' (순수 - 서버 없이 시험한다). 적는 것은 actions.ts.
//
// - 쓰기마다 문서 하나(원칙 1): 완료 = 그 일정의 done·doneAt만, 순서 = 옮긴 것의 order만(대개 하나).
// - 새 일정은 그날 목록의 맨 뒤(order). 날짜를 바꾸면 date만(DESIGN 4-2 - 알림 시각은 date 기준이라 따라간다).
import { orderBetween, rekeyOrders } from '../../domain/order';
import { isPeriod } from '../../domain/period';
import { writeOp, type Changes, type WriteOp } from '../../data/repo/ops';
import type { DocPath, Stored } from '../../data/types';

export type ItemDoc = Stored<'items'>;

export const itemPath = (sid: string, id: string): DocPath<'items'> => ({ sid, coll: 'items', id });

/** 지울 때 어디까지 물어야 하나 (기간 일정·반복 묶음 - 이 날만·이 날부터·전부) */
export const isGrouped = (item: ItemDoc) => isPeriod(item) || !!item.seriesId;

/** 완료·완료 풀기에 바꿀 칸 (풀면 doneAt을 지운다) */
export function doneChanges(done: boolean, now = Date.now()): Changes<'items'> {
  return done ? { done: true, doneAt: now } : { done: false, doneAt: undefined };
}

/**
 * 오늘로 따라오던 일정을 오늘 칸에서 끝낼 때 (DESIGN 5-1 - 이월의 두 번째이자 마지막 쓰기): 그날(오늘)로 옮겨 적고 처음 날을 남긴다.
 * carrying은 지운다. order = 오늘 목록의 맨 뒤(따라오는 줄 바로 위 - 끝낸 자리에서 크게 튀지 않게). 문서 하나.
 */
export function carriedDoneChanges(item: ItemDoc, today: string, order: string, now = Date.now()): Changes<'items'> {
  const out: Changes<'items'> = { ...doneChanges(true, now), date: today, order };
  const since = item.carriedFrom ?? item.date;
  if (since && since !== item.carriedFrom) out.carriedFrom = since;
  if (item.carrying) out.carrying = undefined;
  return out;
}

/**
 * 보이는 목록에서 from번째를 to번째 자리로 옮길 때의 쓰기. 다시 세운 줄의 차례 값을 되도록 적게 고친다(domain/order rekeyOrders) -
 * 한 칸 옮기기는 문서 하나. 두 기기가 같은 차례 값을 만들어 둔 줄(값이 같다)도 그 자리에서 풀린다.
 */
export function reorderOps(sid: string, list: readonly ItemDoc[], from: number, to: number): WriteOp[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const keys = rekeyOrders(next.map((d) => d.order ?? null));
  const ops: WriteOp[] = [];
  next.forEach((d, i) => {
    if (keys[i] !== d.order) ops.push(writeOp.patch(itemPath(sid, d.id), { order: keys[i] }, d));
  });
  return ops;
}

/** 목록의 맨 뒤 차례 값 (새 일정) */
export function orderAfter(list: readonly { order?: string }[]): string {
  let last: string | null = null;
  for (const d of list) if (d.order && (last === null || d.order > last)) last = d.order;
  return orderBetween(last, null);
}

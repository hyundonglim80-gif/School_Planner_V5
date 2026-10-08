// 화면이 자료를 고르는 곳 (DESIGN 6-2, 원칙 7). 화면은 Firestore를 부르지 않고 기기 사본(화면 store)에서 이것으로만 고른다.
//
//   날짜로 itemsOn · 기간으로 itemsBetween · 라벨로 itemsWithLabels · 종류로 itemsOfKind · 메모만 memos · 휴지통 trashOf · 라벨 labelsOf
//   훅은 같은 이름에 use를 붙인다(지금 공간 - 주지 않으면 개인 공간).
//
// - 지운 표시가 있는 것은 휴지통(trashOf)에서만 보인다.
// - 목록은 차례(order, 같으면 id) 대로. 기간으로 고르면 날짜 다음 차례. 화면이 다른 차례가 필요하면 다시 줄 세운다.
// - 문서에는 자리 `id`가 붙어 있다 - 저장 도우미에 그대로 넘겨도 id는 적지 않는다(repo/ops).
// - 계산하는 것(이월·수업 칸·기간 일정의 '(2/5)')은 여기에 없다 - 그 기능을 옮기는 세션이 이 위에 짓는다(DESIGN 5장).
import { useMemo } from 'react';
import { compareOrder } from '../domain/order';
import { collKey, EMPTY_DOCS, useMirror, type MirrorStatus } from './mirror/store';
import { useCurrentSpaceId } from './session';
import type { ItemKind, SpaceCollection, Stored, YMD } from './types';

export type Docs<C extends SpaceCollection> = Readonly<Record<string, Stored<C>>>;
type ItemDoc = Stored<'items'>;
type LabelDoc = Stored<'labels'>;

export const isLive = (d: { deletedAt?: unknown }) => !d.deletedAt;

// ─────────────── 항목 찾아보기 (문서 표가 바뀔 때만 한 번 만든다) ───────────────

interface ItemIndex {
  live: ItemDoc[];
  /** 하루짜리 - 날짜 → 그날 것 (차례대로) */
  byDate: Map<YMD, ItemDoc[]>;
  /** 기간 일정 (date ~ endDate) */
  periods: ItemDoc[];
  memos: ItemDoc[];
}

const indexCache = new WeakMap<object, ItemIndex>();

const isPeriod = (d: ItemDoc) => !!d.date && !!d.endDate && d.endDate > d.date;
const byDateThenOrder = (a: ItemDoc, b: ItemDoc) => (a.date ?? '').localeCompare(b.date ?? '') || compareOrder(a, b);

function indexOf(items: Docs<'items'>): ItemIndex {
  let ix = indexCache.get(items);
  if (ix) return ix;
  const live = Object.values(items).filter(isLive).sort(compareOrder);
  const byDate = new Map<YMD, ItemDoc[]>();
  const periods: ItemDoc[] = [];
  const memos: ItemDoc[] = [];
  for (const d of live) {
    if (!d.date) {
      if (d.kind === 'note') memos.push(d);
    } else if (isPeriod(d)) {
      periods.push(d);
    } else {
      const day = byDate.get(d.date);
      if (day) day.push(d);
      else byDate.set(d.date, [d]);
    }
  }
  ix = { live, byDate, periods, memos };
  indexCache.set(items, ix);
  return ix;
}

const ofKind = (list: ItemDoc[], kind?: ItemKind) => (kind ? list.filter((d) => d.kind === kind) : list);

/** 그날 것 (하루짜리 + 그날이 든 기간 일정) */
export function itemsOn(items: Docs<'items'>, date: YMD, kind?: ItemKind): ItemDoc[] {
  const ix = indexOf(items);
  const day = ix.byDate.get(date) ?? [];
  const spans = ix.periods.filter((d) => d.date! <= date && date <= d.endDate!);
  const all = spans.length ? [...day, ...spans].sort(compareOrder) : day;
  return ofKind(all, kind);
}

/** 기간 [from, to]에 걸친 것 (날짜 다음 차례) */
export function itemsBetween(items: Docs<'items'>, from: YMD, to: YMD, kind?: ItemKind): ItemDoc[] {
  const ix = indexOf(items);
  const out: ItemDoc[] = [];
  for (const [date, list] of ix.byDate) if (from <= date && date <= to) out.push(...list);
  for (const d of ix.periods) if (d.date! <= to && from <= d.endDate!) out.push(d);
  return ofKind(out.sort(byDateThenOrder), kind);
}

/** 라벨 가운데 하나라도 붙은 것 (상위·하위 라벨 펼치기는 부르는 쪽 - P2-3) */
export function itemsWithLabels(items: Docs<'items'>, labelIds: readonly string[], kind?: ItemKind): ItemDoc[] {
  if (labelIds.length === 0) return [];
  const want = new Set(labelIds);
  return ofKind(
    indexOf(items).live.filter((d) => d.labelIds?.some((id) => want.has(id))),
    kind,
  );
}

export function itemsOfKind(items: Docs<'items'>, kind: ItemKind): ItemDoc[] {
  return ofKind(indexOf(items).live, kind);
}

/** 메모 (날짜 없는 메모·기록 - 날짜가 있으면 그날 기록) */
export function memos(items: Docs<'items'>): ItemDoc[] {
  return indexOf(items).memos;
}

/** 휴지통 - 지운 것, 늦게 지운 것부터 */
export function trashOf<T extends { deletedAt?: unknown; id: string }>(docs: Readonly<Record<string, T>>): T[] {
  const ms = (d: T) => (d.deletedAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
  return Object.values(docs)
    .filter((d) => !!d.deletedAt)
    .sort((a, b) => ms(b) - ms(a) || (a.id < b.id ? -1 : 1));
}

/** 라벨 (차례대로). 종류를 주면 그 종류만 */
export function labelsOf(labels: Docs<'labels'>, kind?: ItemKind): LabelDoc[] {
  return Object.values(labels)
    .filter((d) => isLive(d) && (!kind || d.kind === kind))
    .sort(compareOrder);
}

// ─────────────── 훅 ───────────────

/** 공간 하나의 컬렉션 하나 (지운 것까지 - 문서 표 그대로). sid를 주지 않으면 지금 공간 */
export function useDocs<C extends SpaceCollection>(coll: C, sid?: string | null): Docs<C> {
  const current = useCurrentSpaceId();
  const key = collKey(sid ?? current ?? '', coll);
  return useMirror((s) => s.colls[key]?.docs ?? EMPTY_DOCS) as Docs<C>;
}

/** 받기 상태 (사본으로 그림·받는 중·구독 중·연결 기다림) */
export function useMirrorStatus(coll: SpaceCollection, sid?: string | null): MirrorStatus {
  const current = useCurrentSpaceId();
  const key = collKey(sid ?? current ?? '', coll);
  return useMirror((s) => s.colls[key]?.status ?? 'idle');
}

export function useItemsOn(date: YMD, kind?: ItemKind, sid?: string | null): ItemDoc[] {
  const items = useDocs('items', sid);
  return useMemo(() => itemsOn(items, date, kind), [items, date, kind]);
}

export function useItemsBetween(from: YMD, to: YMD, kind?: ItemKind, sid?: string | null): ItemDoc[] {
  const items = useDocs('items', sid);
  return useMemo(() => itemsBetween(items, from, to, kind), [items, from, to, kind]);
}

export function useItemsWithLabels(labelIds: readonly string[], kind?: ItemKind, sid?: string | null): ItemDoc[] {
  const items = useDocs('items', sid);
  // 고른 라벨은 글자 열쇠로 견준다(배열은 그릴 때마다 새것일 수 있다)
  const key = labelIds.join('\u0000');
  return useMemo(() => itemsWithLabels(items, key ? key.split('\u0000') : [], kind), [items, key, kind]);
}

export function useItemsOfKind(kind: ItemKind, sid?: string | null): ItemDoc[] {
  const items = useDocs('items', sid);
  return useMemo(() => itemsOfKind(items, kind), [items, kind]);
}

export function useMemos(sid?: string | null): ItemDoc[] {
  const items = useDocs('items', sid);
  return useMemo(() => memos(items), [items]);
}

export function useLabels(kind?: ItemKind, sid?: string | null): LabelDoc[] {
  const labels = useDocs('labels', sid);
  return useMemo(() => labelsOf(labels, kind), [labels, kind]);
}

export function useTrash<C extends SpaceCollection>(coll: C, sid?: string | null): Stored<C>[] {
  const docs = useDocs(coll, sid);
  return useMemo(() => trashOf(docs as Readonly<Record<string, Stored<C> & { deletedAt?: unknown }>>), [docs]);
}

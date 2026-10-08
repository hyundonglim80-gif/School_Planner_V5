// 화면이 자료를 고르는 곳 (DESIGN 6-2, 원칙 7). 화면은 Firestore를 부르지 않고 기기 사본(화면 store)에서 이것으로만 고른다.
//
//   날짜로 itemsOn · 기간으로 itemsBetween · 라벨로 itemsWithLabels · 종류로 itemsOfKind · 메모만 memos · 휴지통 trashOf · 라벨 labelsOf
//   라벨 트리 labelTreeOf(상위/하위·트리 차례·기본 라벨) · 라벨로 보기 itemsMatching · 라벨마다 붙은 수 labelUsageOf
//   훅은 같은 이름에 use를 붙인다(지금 공간 - 주지 않으면 개인 공간).
//
// - 지운 표시가 있는 것은 휴지통(trashOf)에서만 보인다.
// - 목록은 차례(order, 같으면 id) 대로. 기간으로 고르면 날짜 다음 차례. 화면이 다른 차례가 필요하면 다시 줄 세운다.
// - 문서에는 자리 `id`가 붙어 있다 - 저장 도우미에 그대로 넘겨도 id는 적지 않는다(repo/ops).
// - 계산하는 것(이월·수업 칸·기간 일정의 '(2/5)')은 여기에 없다 - 그 기능을 옮기는 세션이 이 위에 짓는다(DESIGN 5장).
import { useMemo } from 'react';
import { compareOrder } from '../domain/order';
import { matchLabels, orderByTree, parentMapOf, type LabelFilter, type ParentMap, type TreeRow } from '../domain/labelTree';
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

/** 라벨 가운데 하나라도 붙은 것 (고른 id 그대로 - 상위를 고르면 하위도 함께는 itemsMatching) */
export function itemsWithLabels(items: Docs<'items'>, labelIds: readonly string[], kind?: ItemKind): ItemDoc[] {
  if (labelIds.length === 0) return [];
  const want = new Set(labelIds);
  return ofKind(
    indexOf(items).live.filter((d) => d.labelIds?.some((id) => want.has(id))),
    kind,
  );
}

/** 라벨로 보기 - 상위를 고르면 하위도 함께, '기타' = 하위 없이 상위만 (domain/labelTree matchLabels). 빈 거르개면 모두 */
export function itemsMatching(items: Docs<'items'>, filter: LabelFilter, parents: ParentMap, kind?: ItemKind): ItemDoc[] {
  return ofKind(
    indexOf(items).live.filter((d) => matchLabels(d.labelIds, filter, parents)),
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

/** 한 종류의 라벨 목록과 상위/하위 (라벨 관리 창·쓰는 칸·라벨로 보기가 함께 본다) */
export interface LabelTree {
  /** 살아 있는 라벨, 차례대로 */
  list: LabelDoc[];
  byId: ReadonlyMap<string, LabelDoc>;
  /** 하위 id → 상위 id (일정 라벨은 늘 비었다) */
  parents: ParentMap;
  /** 트리 차례 (상위 → 그 하위) */
  rows: TreeRow[];
  /** 새 항목의 기본 라벨 = 트리 차례의 맨 위 (없으면 null) */
  defaultId: string | null;
}

const treeCache = new WeakMap<object, Partial<Record<ItemKind, LabelTree>>>();

export function labelTreeOf(labels: Docs<'labels'>, kind: ItemKind): LabelTree {
  const cached = treeCache.get(labels)?.[kind];
  if (cached) return cached;
  const list = labelsOf(labels, kind);
  // 상위/하위는 메모·기록 라벨만 (DESIGN 4-3)
  const parents = kind === 'note' ? parentMapOf(list) : {};
  const rows = orderByTree(
    list.map((l) => l.id),
    parents,
  );
  const tree: LabelTree = { list, byId: new Map(list.map((l) => [l.id, l])), parents, rows, defaultId: rows[0]?.id ?? null };
  treeCache.set(labels, { ...treeCache.get(labels), [kind]: tree });
  return tree;
}

/** 항목에 붙은 라벨 (붙인 차례대로 - 첫 라벨이 카드의 색. 지웠거나 모르는 라벨은 뺀다) */
export function itemLabels(tree: LabelTree, labelIds: readonly string[] | undefined): LabelDoc[] {
  const out: LabelDoc[] = [];
  for (const id of labelIds ?? []) {
    const l = tree.byId.get(id);
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

/** 라벨마다 붙은 항목 수 - 메모·기록·일정·휴지통 (V4 '항목 수 세기' - 서버를 훑지 않고 사본에서 바로 센다) */
export interface LabelUsage {
  memo: number;
  record: number;
  event: number;
  trash: number;
}

export const usageTotal = (u: LabelUsage | undefined) => (u ? u.memo + u.record + u.event + u.trash : 0);

/**
 * 라벨 id → 붙은 항목 수. 상위 라벨은 하위가 붙은 항목도 센다(한 항목이 상위와 하위를 함께 달았으면 상위는 한 번).
 * 지운 항목은 휴지통으로 센다 - 휴지통의 항목을 되살리면 그 라벨이 필요하다.
 */
export function labelUsageOf(items: Docs<'items'>, parents: ParentMap = {}): Record<string, LabelUsage> {
  const out: Record<string, LabelUsage> = {};
  for (const d of Object.values(items)) {
    const key: keyof LabelUsage = d.deletedAt ? 'trash' : d.kind === 'event' ? 'event' : d.date ? 'record' : 'memo';
    const hit = new Set<string>();
    for (const id of d.labelIds ?? []) {
      hit.add(id);
      if (parents[id]) hit.add(parents[id]);
    }
    for (const id of hit) (out[id] ??= { memo: 0, record: 0, event: 0, trash: 0 })[key] += 1;
  }
  return out;
}

/**
 * 빈 라벨 정리 목록 (트리 차례): 어디에도 안 붙은 라벨과 처음에 체크할지. 하위가 있는 상위와 맨 위(기본) 라벨은 처음에 체크를 뺀다(V4 그대로).
 * 빈 라벨은 저절로 지우지 않는다 - 사용자가 고른 것만(V4 U10).
 */
export function emptyLabelsOf(rows: readonly TreeRow[], usage: Record<string, LabelUsage>): { id: string; checked: boolean }[] {
  return rows
    .filter((r) => usageTotal(usage[r.id]) === 0)
    .map((r) => ({ id: r.id, checked: !r.hasChildren && r.id !== rows[0]?.id }));
}

/** 지운 라벨 가운데 아직 살아 있는 항목에 붙어 있는 것 (라벨 관리 '삭제된 라벨 복구' - V4는 항목의 라벨 이름을 훑었다) */
export function missingLabelsOf(labels: Docs<'labels'>, items: Docs<'items'>): LabelDoc[] {
  const used = new Set<string>();
  for (const d of indexOf(items).live) for (const id of d.labelIds ?? []) used.add(id);
  return Object.values(labels)
    .filter((l) => !!l.deletedAt && used.has(l.id))
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

/** 한 종류의 라벨 트리 (labelTreeOf) */
export function useLabelTree(kind: ItemKind, sid?: string | null): LabelTree {
  const labels = useDocs('labels', sid);
  return useMemo(() => labelTreeOf(labels, kind), [labels, kind]);
}

export function useItemsMatching(filter: LabelFilter, parents: ParentMap, kind?: ItemKind, sid?: string | null): ItemDoc[] {
  const items = useDocs('items', sid);
  return useMemo(() => itemsMatching(items, filter, parents, kind), [items, filter, parents, kind]);
}

export function useTrash<C extends SpaceCollection>(coll: C, sid?: string | null): Stored<C>[] {
  const docs = useDocs(coll, sid);
  return useMemo(() => trashOf(docs as Readonly<Record<string, Stored<C> & { deletedAt?: unknown }>>), [docs]);
}

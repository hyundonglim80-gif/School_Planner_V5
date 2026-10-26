// 메모 화면 정렬 (사용자 요청 #49). 머리줄 옆 '정렬' 고르기 - 이 기기에 기억한다.
// 'manual'(기본) = 지금까지의 차례(즐겨찾기 → 날짜 없는 메모 ▲▼ → 날짜 링크 메모). 나머지는 그 기준으로 한 번에 줄 세운다(▲▼는 '내 차례'에서만).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { noteDates } from '../../domain/noteDates';
import { titleKey } from '../../domain/noteTitle';
import type { ItemDoc } from '../events/eventOps';
import { memoScreenOrder } from '../notes/noteOps';

export type MemoSortKey = 'manual' | 'modified' | 'created' | 'title' | 'label' | 'date' | 'size';
export type MemoSortDir = 'asc' | 'desc';

export const MEMO_SORT_OPTIONS: ReadonlyArray<{ key: MemoSortKey; text: string; /** 처음 방향 */ dir: MemoSortDir }> = [
  { key: 'manual', text: '내 차례', dir: 'asc' },
  { key: 'modified', text: '수정한 날', dir: 'desc' },
  { key: 'created', text: '만든 날', dir: 'desc' },
  { key: 'title', text: '제목', dir: 'asc' },
  { key: 'label', text: '라벨', dir: 'asc' },
  { key: 'date', text: '메모 날짜', dir: 'desc' },
  { key: 'size', text: '글 길이', dir: 'desc' },
];

interface MemoSortState {
  key: MemoSortKey;
  dir: MemoSortDir;
}

export const useMemoSort = create<MemoSortState>()(persist((): MemoSortState => ({ key: 'manual', dir: 'asc' }), { name: 'sp5-memo-sort' }));

/** 기준을 고른다 (처음 방향으로) */
export const setMemoSortKey = (key: MemoSortKey) => useMemoSort.setState({ key, dir: MEMO_SORT_OPTIONS.find((o) => o.key === key)?.dir ?? 'asc' });
export const toggleMemoSortDir = () => useMemoSort.setState((s) => ({ dir: s.dir === 'asc' ? 'desc' : 'asc' }));

/** 수정한 시각 (ms) - 서버 시각이 아직 없으면 만든 때 */
const modifiedMs = (d: ItemDoc): number => {
  const t = d.updatedAt as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : (d.createdAt ?? 0);
};

const collator = new Intl.Collator('ko');

/**
 * 메모 화면 차례. `labelRank`는 라벨 id → 트리 차례(작을수록 앞), 라벨이 없으면 맨 뒤.
 * 같은 값은 '내 차례'(memoScreenOrder)를 따른다. 방향 desc는 기준만 뒤집고 같은 값의 차례는 그대로.
 */
export function sortMemos(list: readonly ItemDoc[], key: MemoSortKey, dir: MemoSortDir, labelRank: (id: string) => number): ItemDoc[] {
  const base = memoScreenOrder(list);
  if (key === 'manual') return base;
  const labelOf = (d: ItemDoc) => Math.min(...(d.labelIds ?? []).map(labelRank).filter((n) => n >= 0), Number.MAX_SAFE_INTEGER);
  const value: Record<Exclude<MemoSortKey, 'manual'>, (d: ItemDoc) => number | string> = {
    modified: modifiedMs,
    created: (d) => d.createdAt ?? 0,
    // 제목이 없으면 첫 줄로 (10-26)
    title: (d) => titleKey(d),
    label: labelOf,
    date: (d) => noteDates(d).at(-1) ?? '',
    size: (d) => (d.text ?? '').length,
  };
  const get = value[key];
  const sign = dir === 'asc' ? 1 : -1;
  // 빈 값(제목·날짜 없음, 라벨 없음)은 방향과 상관없이 맨 뒤
  const empty = (v: number | string) => v === '' || v === Number.MAX_SAFE_INTEGER;
  // Array.sort는 안정 정렬 - 같은 값은 base 차례가 남는다
  return [...base].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (empty(x) !== empty(y)) return empty(x) ? 1 : -1;
    if (typeof x === 'string' && typeof y === 'string') return sign * collator.compare(x, y);
    return sign * ((x as number) - (y as number));
  });
}

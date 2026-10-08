// 라벨로 보기 - 고른 것을 기억한다 (V4 store memoFilter·journalFilter - 다른 화면에서 돌아와도 그대로). 이 기기에만(localStorage).
//
// 메모 화면: '⭐ 즐겨찾기'(fav) · '전체 메모'(all) · 라벨 여러 개(LabelFilter). 처음(기억한 것이 없을 때)은 즐겨찾기 - 화면이 즐겨찾기가 없으면 전체로 연다.
// 하루 기록 칸: 라벨 여러 개(비면 전체).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_FILTER, readLabelFilter, type LabelFilter } from '../../domain/labelTree';

export type MemoFilter = 'fav' | 'all' | LabelFilter;

interface FilterState {
  /** null = 아직 고른 적 없음 */
  memo: MemoFilter | null;
  journal: LabelFilter;
}

export const useLabelFilters = create<FilterState>()(
  persist(() => ({ memo: null, journal: EMPTY_FILTER }) as FilterState, {
    name: 'sp5-label-filters',
    // 옛 값·틀린 값은 믿을 수 있는 모양으로
    merge: (saved, cur) => {
      const s = (saved ?? {}) as Partial<FilterState>;
      const memo = s.memo === 'fav' || s.memo === 'all' ? s.memo : s.memo ? readLabelFilter(s.memo) : null;
      return { ...cur, memo, journal: readLabelFilter(s.journal) };
    },
  }),
);

export const setMemoFilter = (memo: MemoFilter) => useLabelFilters.setState({ memo });
export const setJournalFilter = (journal: LabelFilter) => useLabelFilters.setState({ journal });

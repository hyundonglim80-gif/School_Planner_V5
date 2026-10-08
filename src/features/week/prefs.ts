// 주간 화면 - 작년 이맘때 켜기·끄기 (이 기기에 남는다 - V4 그대로) · 단축키 '작년 이맘때 보이기 / 숨기기'.
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setShortcutAction } from '../../app/keys';

export const useShowLastYear = create<{ on: boolean }>()(persist((): { on: boolean } => ({ on: false }), { name: 'sp5-last-year' }));
export const toggleLastYear = () => useShowLastYear.setState((s) => ({ on: !s.on }));

/** 단축키 'lastYear' (Shell이 부른다 - 다른 화면에서 눌러도 켜 둔다) */
export function useWeekShortcuts() {
  useEffect(() => setShortcutAction('lastYear', toggleLastYear), []);
}

// 학급 화면 = 🏫 학급 도구 | 🧑‍🤝‍🧑 명렬표 (관리 · 검색 · 암기) - V4 store classView·rosterTab. 화면을 떠났다 와도 그대로(이 탭에서만).
// 단축키 '명렬표 (학급 화면)' = 학급 화면의 명렬표로 (V4 openClassRoster).
import { useEffect } from 'react';
import { create } from 'zustand';
import { setShortcutAction } from '../../app/keys';
import { setScope } from '../../app/nav';

export type ClassView = 'hub' | 'roster';
export type RosterTab = 'manage' | 'search' | 'memorize';

export const useClassView = create<{ view: ClassView; tab: RosterTab }>(() => ({ view: 'hub', tab: 'manage' }));

export const setClassView = (view: ClassView) => useClassView.setState({ view });

export function openClassRoster(tab: RosterTab = useClassView.getState().tab) {
  useClassView.setState({ view: 'roster', tab });
  setScope('class');
}

/** 껍데기에서 한 번 - 단축키 '명렬표' */
export function useClassShortcuts() {
  useEffect(() => setShortcutAction('roster', () => openClassRoster()), []);
}

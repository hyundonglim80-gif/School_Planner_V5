// 화면 여섯 (화면 탭·휴대폰 탭바·단축키 '화면 이동'이 이 목록을 읽는다). 화면은 처음 볼 때 싣는다(끊겨서 못 받으면 그 자리 안내 - OfflineScreen).
import { lazyWithReload } from './lazyWithReload';
import { OfflineScreen } from './OfflineChunk';
import type { Scope } from './route';

export interface ScreenDef {
  id: Scope;
  label: string;
  /** 휴대폰 탭바 그림 */
  icon: string;
  /** 단축키 id (V4 SHORTCUT_ACTIONS 그대로) */
  shortcut: 'scopeDay' | 'scopeWeek' | 'scopeMonth' | 'scopeYear' | 'scopeMemo' | 'scopeClass';
}

export const SCREENS: readonly ScreenDef[] = [
  { id: 'day', label: '하루', icon: '📋', shortcut: 'scopeDay' },
  { id: 'week', label: '주간', icon: '🗓️', shortcut: 'scopeWeek' },
  { id: 'month', label: '월간', icon: '📅', shortcut: 'scopeMonth' },
  { id: 'year', label: '년간', icon: '📊', shortcut: 'scopeYear' },
  { id: 'memo', label: '메모', icon: '📝', shortcut: 'scopeMemo' },
  // 탭이 여섯 - 390px에서 한 칸 65px, 이름이 두 글자라 들어간다 (V4 ROADMAP 16)
  { id: 'class', label: '학급', icon: '🏫', shortcut: 'scopeClass' },
];

export const SCREEN_COMPONENTS: Record<Scope, ReturnType<typeof lazyWithReload>> = {
  day: lazyWithReload(() => import('../features/day/DayScreen'), OfflineScreen),
  week: lazyWithReload(() => import('../features/week/WeekScreen'), OfflineScreen),
  month: lazyWithReload(() => import('../features/month/MonthScreen'), OfflineScreen),
  year: lazyWithReload(() => import('../features/year/YearScreen'), OfflineScreen),
  memo: lazyWithReload(() => import('../features/memo/MemoScreen'), OfflineScreen),
  class: lazyWithReload(() => import('../features/class/ClassScreen'), OfflineScreen),
};

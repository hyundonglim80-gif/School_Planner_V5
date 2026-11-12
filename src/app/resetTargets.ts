// '초기화'가 가는 값 (P33-2 - PLAN 5장 'P33' ⑧). 내 초기화 설정 → 관리자 기본값 → 앱 기본값을 겹친 값을 들고만 있다.
//   채우는 것은 app/settingsReset(로그인 동안 내 settings/reset을 받아 domain/settingsSnapshot resolveResetValues).
//   비어 있으면(로그인 전·받기 전) 앱 기본값 - 지금까지의 초기화와 같다.
// 이 파일은 store·domain만 부른다 - 글자 크기(layoutPrefs)·경계선(boardPrefs)·칸 폭(ColumnResizer)이 불러도 계정 설정(prefs)과 고리가 생기지 않게.
import { create } from 'zustand';
import { fontPercentOf, type FontSizes } from '../domain/fontScale';
import type { ResetValues } from '../domain/settingsSnapshot';

export const useResetTargets = create<{ values: ResetValues | null }>(() => ({ values: null }));

const values = () => useResetTargets.getState().values;

/** 그 화면 글자 크기의 초기화 값 (%) */
export function resetFontPercent(page: string): number {
  return fontPercentOf(values()?.device.fontSizes as FontSizes | undefined, page);
}

/** 한눈에 경계선의 초기화 값 (%, null = 앱 기본) */
export function resetBoardRatio(key: 'main' | 'day' | 'memo'): number | null {
  const local = values()?.local;
  if (!local) return null;
  return key === 'main' ? local.boardMain : key === 'day' ? local.boardDay : local.boardMemo;
}

/** 오른쪽 칸·왼쪽 클립보드 칸 폭의 초기화 값 (px, null = 앱 기본) */
export function resetPanelWidth(side: 'left' | 'right'): number | null {
  const local = values()?.local;
  if (!local) return null;
  return side === 'right' ? local.rightPanelWidth : local.leftPanelWidth;
}

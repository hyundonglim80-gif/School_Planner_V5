// 화면 보기 설정 (V4 useAppStore의 popupStyle·rightPanelWidth·leftPanelWidth·fontScale).
//   popupStyle: 환경설정 '창 위치' - 오른쪽 칸(side) / 가운데 창(center). P1-4에서 계정 설정(PC·휴대폰 따로)과 맞춘다.
//   fontScale: 글자 크기 다섯 단계. P1-4에서 계정 설정과 맞춘다.
//   rightPanelWidth·leftPanelWidth: 경계선을 끌어 바꾼 폭(px), null이면 기본 폭. 이 기기에만.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyFontScale, DEFAULT_FONT_SCALE, type FontScale } from '../domain/fontScale';

export type PopupStyle = 'side' | 'center';

interface LayoutPrefs {
  popupStyle: PopupStyle;
  fontScale: FontScale;
  rightPanelWidth: number | null;
  leftPanelWidth: number | null;
}

export const useLayoutPrefs = create<LayoutPrefs>()(
  persist((): LayoutPrefs => ({ popupStyle: 'side', fontScale: DEFAULT_FONT_SCALE, rightPanelWidth: null, leftPanelWidth: null }), {
    name: 'sp5-layout',
    // 저장해 둔 글자 크기는 화면이 그려지기 전에 입힌다 - 나중에 입히면 기본 크기로 한 번 그려졌다가 바뀌어 열 때마다 글자가 튄다(V4)
    onRehydrateStorage: () => (state) => applyFontScale(state?.fontScale || DEFAULT_FONT_SCALE),
  }),
);

/** 고르는 그 순간 화면이 바뀐다 (크기는 눈으로 보고 정하는 것이라) */
export function setFontScale(fontScale: FontScale) {
  applyFontScale(fontScale);
  useLayoutPrefs.setState({ fontScale });
}

export const setPopupStyle = (popupStyle: PopupStyle) => useLayoutPrefs.setState({ popupStyle });
export const setRightPanelWidth = (rightPanelWidth: number | null) => useLayoutPrefs.setState({ rightPanelWidth });
export const setLeftPanelWidth = (leftPanelWidth: number | null) => useLayoutPrefs.setState({ leftPanelWidth });

// 화면 보기 설정 (V4 useAppStore의 popupStyle·rightPanelWidth·leftPanelWidth·fontScale).
//   popupStyle: 환경설정 '창 위치' - 오른쪽 칸(side) / 팝업창(popup - PC만, 11-09) / 가운데 창(center - 휴대폰만).
//     PC의 옛 '가운데 창'은 팝업창으로 본다(11-09 사용자 요청 - PC 고르기에서 가운데 창을 팝업창으로 바꿨다). 실제로 쓰는 값은 windowMode().
//   fontScale: 글자 크기 다섯 단계.
//   이 둘은 계정 설정(PC·휴대폰 따로)과 맞춘다 - app/prefs.ts. 여기 값은 이 기기 사본(열자마자 그리기용).
//   rightPanelWidth·leftPanelWidth: 경계선을 끌어 바꾼 폭(px), null이면 기본 폭. 이 기기에만.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyFontScale, DEFAULT_FONT_SCALE, type FontScale } from '../domain/fontScale';
import { detectDeviceKind } from './deviceKind';

export type PopupStyle = 'side' | 'center' | 'popup';

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

/**
 * 이 기기에서 실제로 쓰는 창 위치. PC는 오른쪽 칸 / 팝업창(옛 가운데 창도 팝업창), 휴대폰은 오른쪽 칸 / 가운데 창
 * (휴대폰에는 브라우저 새 창이 없다 - 11-09 사용자 '휴대폰은 지금 그대로').
 */
export function windowMode(style: PopupStyle, device = detectDeviceKind()): PopupStyle {
  if (style === 'side') return 'side';
  return device === 'pc' ? 'popup' : 'center';
}

/** 지금 창을 브라우저 팝업창으로 띄우는가 (PC + '팝업창') */
export const popupWindowsOn = () => windowMode(useLayoutPrefs.getState().popupStyle) === 'popup';

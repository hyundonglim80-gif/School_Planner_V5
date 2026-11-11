// 화면 보기 설정 (V4 useAppStore의 popupStyle·rightPanelWidth·leftPanelWidth·fontScale).
//   popupStyle: 환경설정 '창 위치' - 오른쪽 칸(side) / 팝업창(popup - PC만, 11-09) / 가운데 창(center - 휴대폰만).
//     PC의 옛 '가운데 창'은 팝업창으로 본다(11-09 사용자 요청 - PC 고르기에서 가운데 창을 팝업창으로 바꿨다). 실제로 쓰는 값은 windowMode().
//   fontSizes: 글자 크기 - 화면마다 %(메모 요청 #145 - 옛 다섯 단계 fontScale을 바꿨다). 팝업창은 'popout' 하나.
//   이 둘은 계정 설정(PC·휴대폰 따로)과 맞춘다 - app/prefs.ts. 여기 값은 이 기기 사본(열자마자 그리기용).
//   rightPanelWidth·leftPanelWidth: 경계선을 끌어 바꾼 폭(px), null이면 기본 폭. 이 기기에만.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyFontPercent,
  fontPercentOf,
  legacyFontSizes,
  POPOUT_FONT_PAGE,
  readFontSizes,
  steppedFontPercent,
  withFontPercent,
  type FontSizes,
} from '../domain/fontScale';
import { POPOUT } from '../ui/popout';
import { detectDeviceKind } from './deviceKind';
import { useNav } from './nav';
import { SCOPES } from './route';

export type PopupStyle = 'side' | 'center' | 'popup';

interface LayoutPrefs {
  popupStyle: PopupStyle;
  fontSizes: FontSizes;
  rightPanelWidth: number | null;
  leftPanelWidth: number | null;
}

/** 글자 크기를 따로 기억하는 곳 - 화면 일곱 + 팝업창 */
export const FONT_PAGES: readonly string[] = [...SCOPES, POPOUT_FONT_PAGE];

/** 이 창의 글자 크기 자리 - 큰 창은 지금 보는 화면, 팝업창은 화면이 없어 '팝업창' */
export const currentFontPage = (): string => (POPOUT ? POPOUT_FONT_PAGE : useNav.getState().scope);

/** 옛 다섯 단계(fontScale)를 화면마다 %로 (11-11 전 이 기기 저장소·계정 문서) */
export const legacyFontPages = (scale: unknown): FontSizes | undefined => legacyFontSizes(scale, FONT_PAGES);

export const useLayoutPrefs = create<LayoutPrefs>()(
  persist((): LayoutPrefs => ({ popupStyle: 'side', fontSizes: {}, rightPanelWidth: null, leftPanelWidth: null }), {
    name: 'sp5-layout',
    // 1 = 글자 크기가 화면마다 % (메모 요청 #145). 옛 저장(0)의 단계 하나는 모든 화면에 같은 %로 옮긴다
    version: 1,
    migrate: (old) => {
      const o = old && typeof old === 'object' ? (old as Record<string, unknown>) : {};
      const { fontScale, ...rest } = o;
      return { ...rest, fontSizes: readFontSizes(o.fontSizes) ?? legacyFontPages(fontScale) ?? {} } as unknown as LayoutPrefs;
    },
    // 저장해 둔 글자 크기는 화면이 그려지기 전에 입힌다 - 나중에 입히면 기본 크기로 한 번 그려졌다가 바뀌어 열 때마다 글자가 튄다(V4)
    onRehydrateStorage: () => (state) => applyFontPercent(fontPercentOf(state?.fontSizes, currentFontPage())),
  }),
);

/** 이 창이 보는 화면의 글자 크기를 html에 입힌다 */
function applyCurrentFont() {
  applyFontPercent(fontPercentOf(useLayoutPrefs.getState().fontSizes, currentFontPage()));
}

// 화면을 옮기면 그 화면이 기억한 크기로 - 화면 값이 바뀌는 그 자리에서(그리기 전에, app/nav의 한눈에 바탕과 같은 때)
if (!POPOUT) {
  useNav.subscribe((s, prev) => {
    if (s.scope !== prev.scope) applyCurrentFont();
  });
}

/** 받은 목록(계정 문서)을 그대로 - 지금 화면에도 입힌다 */
export function setFontSizes(fontSizes: FontSizes) {
  useLayoutPrefs.setState({ fontSizes });
  applyCurrentFont();
}

/** 그 화면의 글자 크기 % (고르는 그 순간 화면이 바뀐다 - 크기는 눈으로 보고 정하는 것이라) */
export function setFontPercent(page: string, percent: number) {
  setFontSizes(withFontPercent(useLayoutPrefs.getState().fontSizes, page, percent));
}

/** 그 화면을 한 칸 작게(-1)·크게(+1)·초기화(0, 100%) - 바뀐 %를 돌려준다. 누를 때마다 쌓인다(단축키를 여러 번 누르면 계속 작게) */
export function stepFontSize(step: -1 | 0 | 1, page = currentFontPage()): number {
  const next = steppedFontPercent(fontPercentOf(useLayoutPrefs.getState().fontSizes, page), step);
  setFontPercent(page, next);
  return next;
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

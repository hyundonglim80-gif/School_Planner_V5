// 창 자리 설정 (V4 useAppStore의 popupStyle·rightPanelWidth·leftPanelWidth).
//   popupStyle: 환경설정 '창 위치' - 오른쪽 칸(side) / 가운데 창(center). P1-4에서 계정 설정(PC·휴대폰 따로)과 맞춘다.
//   rightPanelWidth·leftPanelWidth: 경계선을 끌어 바꾼 폭(px), null이면 기본 폭. 이 기기에만.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PopupStyle = 'side' | 'center';

interface LayoutPrefs {
  popupStyle: PopupStyle;
  rightPanelWidth: number | null;
  leftPanelWidth: number | null;
}

export const useLayoutPrefs = create<LayoutPrefs>()(
  persist((): LayoutPrefs => ({ popupStyle: 'side', rightPanelWidth: null, leftPanelWidth: null }), { name: 'sp5-layout' }),
);

export const setPopupStyle = (popupStyle: PopupStyle) => useLayoutPrefs.setState({ popupStyle });
export const setRightPanelWidth = (rightPanelWidth: number | null) => useLayoutPrefs.setState({ rightPanelWidth });
export const setLeftPanelWidth = (leftPanelWidth: number | null) => useLayoutPrefs.setState({ leftPanelWidth });

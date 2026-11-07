// 한눈에 화면(P24)의 칸 크기 - 경계선 셋의 비율(%). 이 기기에만(sp5-board) - 기기마다 화면이 달라 계정에 올리지 않는다
// (오른쪽 칸 폭 sp5-layout과 같다, 5장 'P24 칸 크기'). null이면 기본 - 경계선을 두 번 누르면 기본으로.
//   main = 왼쪽 무리(달력·요일 칸) 몫 · day = 오른쪽 위 수업 몫(일정이 나머지) · memo = 오른쪽 위(수업·일정) 몫(메모가 나머지)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoardSplit = 'main' | 'day' | 'memo';

/** 기본 비율 - 사용자 그림(왼쪽 58 : 오른쪽 42 · 위 60 : 메모 40), 수업 7 : 일정 5는 하루 화면 */
export const BOARD_SPLIT_DEFAULTS: Record<BoardSplit, number> = { main: 58, day: (7 / 12) * 100, memo: 60 };

type BoardPrefs = Record<BoardSplit, number | null>;

export const useBoardPrefs = create<BoardPrefs>()(
  persist((): BoardPrefs => ({ main: null, day: null, memo: null }), {
    name: 'sp5-board',
    // 옛 값·손댄 값이 이상하면 기본으로 (5 ~ 95%만)
    merge: (persisted, current) => {
      const p = (persisted ?? {}) as Partial<BoardPrefs>;
      const ok = (v: unknown) => (typeof v === 'number' && v >= 5 && v <= 95 ? v : null);
      return { ...current, main: ok(p.main), day: ok(p.day), memo: ok(p.memo) };
    },
  }),
);

/** 놓았을 때·키로 바꿨을 때 한 번 (끄는 동안은 SplitPane이 CSS 변수만 바꾼다) */
export function setBoardSplit(key: BoardSplit, ratio: number | null) {
  useBoardPrefs.setState({ [key]: ratio === null ? null : Math.round(ratio * 10) / 10 });
}

/** 지금 비율 (기본 포함) */
export const useBoardSplit = (key: BoardSplit) => useBoardPrefs((s) => s[key] ?? BOARD_SPLIT_DEFAULTS[key]);

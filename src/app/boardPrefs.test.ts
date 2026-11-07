import { describe, it, expect, beforeEach } from 'vitest';
import { BOARD_SPLIT_DEFAULTS, setBoardSplit, useBoardPrefs } from './boardPrefs';

beforeEach(() => {
  localStorage.clear();
  useBoardPrefs.setState({ main: null, day: null, memo: null });
});

describe('한눈에 칸 크기 (이 기기에만 - sp5-board)', () => {
  it('처음은 기본(null) - 사용자 그림 58 : 42 · 위 60 : 메모 40 · 수업 7 : 일정 5', () => {
    expect(useBoardPrefs.getState()).toMatchObject({ main: null, day: null, memo: null });
    expect(BOARD_SPLIT_DEFAULTS.main).toBe(58);
    expect(BOARD_SPLIT_DEFAULTS.memo).toBe(60);
    expect(Math.round(BOARD_SPLIT_DEFAULTS.day)).toBe(58);
  });

  it('바꾼 비율은 이 기기에 남고, null이면 기본으로', () => {
    setBoardSplit('main', 63.456);
    expect(useBoardPrefs.getState().main).toBe(63.5);
    expect(JSON.parse(localStorage.getItem('sp5-board')!).state.main).toBe(63.5);
    setBoardSplit('main', null);
    expect(useBoardPrefs.getState().main).toBeNull();
  });

  it('남은 값이 이상하면 기본으로 읽는다', async () => {
    localStorage.setItem('sp5-board', JSON.stringify({ state: { main: 120, day: 'x', memo: 40 }, version: 0 }));
    await useBoardPrefs.persist.rehydrate();
    expect(useBoardPrefs.getState()).toMatchObject({ main: null, day: null, memo: 40 });
  });
});

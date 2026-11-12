// 내 '초기화 설정' 저장·초기화 (P33-2) - 서버 없이: 저장은 흉내로 받고, 받은 문서는 receiveMyReset으로 넣는다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
const saved: Array<{ uid: string; data: Record<string, unknown> }> = [];
let watchCb: ((data: unknown) => void) | null = null;
vi.mock('../data/settingsReset', () => ({
  RESET_DOC_ID: 'reset',
  saveMyReset: async (uid: string, data: Record<string, unknown>) => {
    saved.push({ uid, data });
  },
  watchMyReset: (_uid: string, cb: (data: unknown) => void) => {
    watchCb = cb;
    return () => {
      watchCb = null;
    };
  },
}));

import { RESET_COMMON_KEYS, RESET_DEVICE_KEYS, MEMO_SORT_KEYS } from '../domain/settingsSnapshot';
import { DEFAULT_PALETTE } from '../domain/palette';
import { COMMON_SETTINGS, DEVICE_PREFS, useCommonSettings } from './prefs';
import { receiveMyReset, useResetSnapshots, useResetSync } from './settingsReset';
import { resetToInitial, saveMyResetSnapshot } from './settingsSnapshot';
import { resetBoardRatio, resetFontPercent, resetPanelWidth, useResetTargets } from './resetTargets';
import { stepFontSize, useLayoutPrefs } from './layoutPrefs';
import { useNav } from './nav';
import { useShortcutOverrides } from './keys';
import { useBoardPrefs } from './boardPrefs';
import { readThemeMode } from './theme';
import { useMemoView } from '../features/memo/memoView';
import { MEMO_SORT_OPTIONS, useMemoSort } from '../features/memo/memoSort';

const K = { ctrl: true, alt: true, shift: false, key: 'K' };

function clearAll() {
  saved.length = 0;
  localStorage.clear();
  useLayoutPrefs.setState({ fontSizes: {}, popupStyle: 'side', rightPanelWidth: null, leftPanelWidth: null });
  useNav.setState({ showWeekend: true, showEvents: true, showClass: true, semesterFilter: 'all', semesterFilterAt: '', enableScrollNav: false, startupScope: 'last' });
  useShortcutOverrides.setState({ overrides: {}, tabs: {}, custom: {} });
  useCommonSettings.setState({ forwardDays: 14, palette: DEFAULT_PALETTE, teaching: null, newYearDone: 0 });
  useBoardPrefs.setState({ main: null, day: null, memo: null });
  useMemoView.setState({ view: 'card' });
  useMemoSort.setState({ key: 'manual', dir: 'asc' });
  act(() => useResetSnapshots.setState({ mine: null, admin: null, loaded: false }));
}

beforeEach(clearAll);

/** 사용자가 바꿔 둔 설정 (묶음에 드는 것 + 빠지는 것) */
function customize() {
  useLayoutPrefs.setState({ fontSizes: { day: 120 }, popupStyle: 'popup', rightPanelWidth: 600 });
  useNav.setState({ showWeekend: false, semesterFilter: 2 });
  useShortcutOverrides.setState({ overrides: { scopeMemo: K } });
  useCommonSettings.setState({ forwardDays: 30, newYearDone: 2027 });
  useBoardPrefs.setState({ main: 40 });
  localStorage.setItem('sp5_theme', 'light');
  useMemoView.setState({ view: 'list' });
}

describe('묶음 칸 표', () => {
  it('묶음에 드는 칸은 모두 계정 설정 표에 있다 · 메모 정렬 기준은 메모 화면과 같다', () => {
    for (const k of RESET_DEVICE_KEYS) expect(DEVICE_PREFS).toHaveProperty(k);
    for (const k of RESET_COMMON_KEYS) expect(COMMON_SETTINGS).toHaveProperty(k);
    expect([...MEMO_SORT_KEYS]).toEqual(MEMO_SORT_OPTIONS.map((o) => o.key));
  });
});

describe('💾 초기화 설정', () => {
  it('지금 값을 이 기기 종류(pc) 몫 + 계정 몫에 - 학기 칩·새 학년도 같은 자료는 빠진다', async () => {
    customize();
    await saveMyResetSnapshot('u1', 1000);
    expect(saved).toHaveLength(1);
    expect(saved[0].uid).toBe('u1');
    expect(saved[0].data).toEqual({
      common: { forwardDays: 30 },
      at: 1000,
      pc: {
        prefs: { fontSizes: { day: 120 }, popupStyle: 'popup', showWeekend: false, shortcutOverrides: { scopeMemo: K } },
        local: { boardMain: 40, rightPanelWidth: 600, theme: 'light', memoView: 'list' },
        at: 1000,
      },
    });
  });

  it('휴대폰 몫이 있으면 그대로 두고 PC 몫만 바꾼다', async () => {
    act(() => receiveMyReset({ common: { forwardDays: 7 }, at: 1, mobile: { prefs: { popupStyle: 'center' }, local: {}, at: 1 } }));
    await saveMyResetSnapshot('u1', 2);
    expect(saved[0].data.mobile).toEqual({ prefs: { popupStyle: 'center' }, local: {}, at: 1 });
    expect(saved[0].data.pc).toEqual({ prefs: {}, local: {}, at: 2 });
    expect(saved[0].data.common).toEqual({});
  });
});

describe('↩️ 초기화 · 글자 크기 초기화 · 경계선 두 번 누르기', () => {
  it('저장한 값으로 - 묶음에 없는 칸(학기 칩·새 학년도)은 그대로 · 되돌리기', async () => {
    customize();
    await saveMyResetSnapshot('u1', 1000);
    act(() => receiveMyReset(saved[0].data));
    // 다른 값으로 바꾼 뒤
    useLayoutPrefs.setState({ fontSizes: { day: 80 }, popupStyle: 'side', rightPanelWidth: null });
    useNav.setState({ showWeekend: true, semesterFilter: 1 });
    useShortcutOverrides.setState({ overrides: {} });
    useCommonSettings.setState({ forwardDays: 5, newYearDone: 2028 });
    useBoardPrefs.setState({ main: 70 });
    localStorage.setItem('sp5_theme', 'dark');
    useMemoView.setState({ view: 'card' });

    let undo = () => {};
    act(() => {
      undo = resetToInitial();
    });
    expect(useLayoutPrefs.getState()).toMatchObject({ fontSizes: { day: 120 }, popupStyle: 'popup', rightPanelWidth: 600 });
    expect(useNav.getState()).toMatchObject({ showWeekend: false, semesterFilter: 1 });
    expect(useShortcutOverrides.getState().overrides).toEqual({ scopeMemo: K });
    expect(useCommonSettings.getState()).toMatchObject({ forwardDays: 30, newYearDone: 2028 });
    expect(useBoardPrefs.getState().main).toBe(40);
    expect(readThemeMode()).toBe('light');
    expect(useMemoView.getState().view).toBe('list');

    act(() => undo());
    expect(useLayoutPrefs.getState()).toMatchObject({ fontSizes: { day: 80 }, popupStyle: 'side', rightPanelWidth: null });
    expect(useCommonSettings.getState().forwardDays).toBe(5);
    expect(useBoardPrefs.getState().main).toBe(70);
    expect(readThemeMode()).toBe('dark');
  });

  it('글자 크기 초기화·경계선·칸 폭의 초기화 값 = 저장한 값', () => {
    act(() =>
      receiveMyReset({
        common: {},
        at: 1,
        pc: { prefs: { fontSizes: { day: 115, week: 90 } }, local: { boardDay: 45, leftPanelWidth: 400 }, at: 1 },
      }),
    );
    expect(resetFontPercent('day')).toBe(115);
    expect(resetFontPercent('month')).toBe(100);
    useLayoutPrefs.setState({ fontSizes: { week: 130 } });
    expect(stepFontSize(0, 'week')).toBe(90);
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ week: 90 });
    expect(resetBoardRatio('day')).toBe(45);
    expect(resetBoardRatio('main')).toBeNull();
    expect(resetPanelWidth('left')).toBe(400);
    expect(resetPanelWidth('right')).toBeNull();
  });

  it('초기화 설정이 없으면 앱 기본값 (지금까지와 같다)', () => {
    customize();
    expect(useResetTargets.getState().values).toBeNull();
    expect(stepFontSize(0, 'day')).toBe(100);
    act(() => {
      resetToInitial();
    });
    expect(useLayoutPrefs.getState()).toMatchObject({ fontSizes: {}, popupStyle: 'side', rightPanelWidth: null });
    expect(useNav.getState()).toMatchObject({ showWeekend: true, semesterFilter: 2 });
    expect(useCommonSettings.getState()).toMatchObject({ forwardDays: 14, newYearDone: 2027 });
    expect(readThemeMode()).toBe('dark');
  });
});

describe('받기 (로그인한 동안)', () => {
  it('듣다가 로그아웃하면 비운다 · 틀린 문서는 없음으로', () => {
    const { rerender } = renderHook(({ uid }: { uid?: string }) => useResetSync(uid), { initialProps: { uid: 'u1' as string | undefined } });
    act(() => watchCb?.({ common: { forwardDays: 9 }, at: 3 }));
    expect(useResetSnapshots.getState()).toMatchObject({ loaded: true, mine: { common: { forwardDays: 9 }, at: 3 } });
    expect(useResetTargets.getState().values?.common.forwardDays).toBe(9);
    act(() => watchCb?.('broken'));
    expect(useResetSnapshots.getState().mine).toBeNull();
    act(() => watchCb?.({ common: {}, at: 4 }));
    rerender({ uid: undefined });
    expect(useResetSnapshots.getState()).toMatchObject({ mine: null, loaded: false });
    expect(useResetTargets.getState().values).toBeNull();
    expect(watchCb).toBeNull();
  });
});

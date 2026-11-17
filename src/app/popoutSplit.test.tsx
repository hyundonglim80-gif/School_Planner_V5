import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, renderHook, fireEvent } from '@testing-library/react';

// 이 탭이 새 창(?popout=)인 척 - 처음 칸(창 가득)은 setPopoutRoot로 건 key (ui/popout의 함수는 제 모듈의 POPOUT을 보므로 함께 바꾼다)
vi.mock('../ui/popout', async (orig) => {
  const real = await orig<typeof import('../ui/popout')>();
  let root: number | null = null;
  return {
    ...real,
    POPOUT: { id: 'devPanel', params: { n: 1 } },
    setPopoutRoot: (k: number | null) => {
      root = k;
    },
    isPopoutRoot: (k: number) => k === root,
  };
});

import { resetHistoryForTest } from './history';
import { useAppKeys } from './keys';
import { setPopupStyle } from './layoutPrefs';
import WindowHost from './WindowHost';
import SideTabs from '../ui/SideTabs';
import { closeSplitWindows, openWindow, registerWindow, resetWindowsForTest, useShownWindowPick, useWindows } from './windows';
import { popOutWindow } from './popout';
import { useSplitWindowSize } from './popoutSplit';
import { setPopoutRoot, splitGrowth } from '../ui/popout';
import { useSidePopups } from '../ui/sideColumn';

// P43 11-17 사용자 요청: 새 창(↗) 안에서 연 창은 가운데가 아니라 새 창 오른쪽 분할 칸 · 분할 칸 ↗ = 또 새 창 · ESC = 분할 칸만

function Host() {
  useAppKeys();
  return (
    <>
      <WindowHost />
      <SideTabs />
    </>
  );
}

/** 새 창은 좁아도(528px) 붙는다 - matchMedia는 '좁다'로 둔다 */
function narrowScreen() {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
}

const column = () => document.getElementById('side-column')!;

let rootKey = 0;
async function openRoot() {
  render(<Host />);
  act(() => {
    rootKey = openWindow('devPanel', { n: 1 }, { here: true });
    setPopoutRoot(rootKey);
  });
  await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
}

beforeEach(() => {
  resetHistoryForTest();
  resetWindowsForTest();
  setPopupStyle('side');
  narrowScreen();
  registerWindow({ id: 'devWindow', title: '시험 창', icon: '🧪', kind: 'side', dev: true, load: () => import('../features/dev/TestWindow') });
  registerWindow({ id: 'devPanel', title: '시험 쓰는 칸', icon: '🧪', kind: 'panel', dev: true, load: () => import('../features/dev/TestPanel') });
});
afterEach(() => {
  act(() => {
    useWindows.setState({ windows: [] });
  });
  setPopoutRoot(null);
  vi.restoreAllMocks();
});

describe('새 창 넓히기 셈 (splitGrowth)', () => {
  const screen1 = { left: 0, width: 1920 };
  it('두 배 폭까지 - 화면 안이면 그 자리에서 오른쪽으로', () => {
    expect(splitGrowth({ x: 100, width: 528 }, screen1)).toEqual({ dx: 0, dw: 528 });
  });
  it('오른쪽이 넘치면 왼쪽으로 옮긴다', () => {
    expect(splitGrowth({ x: 1380, width: 528 }, screen1)).toEqual({ dx: -516, dw: 528 });
  });
  it('화면보다 넓게는 아니다 - 화면 왼쪽 끝까지만 옮기고 화면 폭만큼', () => {
    expect(splitGrowth({ x: 200, width: 700 }, { left: 0, width: 1366 })).toEqual({ dx: -200, dw: 666 });
  });
  it('이미 화면만큼 넓으면(최대화) 그대로', () => {
    expect(splitGrowth({ x: 0, width: 1920 }, screen1)).toEqual({ dx: 0, dw: 0 });
    expect(splitGrowth({ x: 0, width: 1880 }, screen1)).toEqual({ dx: 0, dw: 0 });
  });
  it('둘째 모니터(왼쪽 끝이 0이 아닌 화면)', () => {
    expect(splitGrowth({ x: 3000, width: 600 }, { left: 1920, width: 1920 })).toEqual({ dx: -360, dw: 600 });
  });
});

describe('새 창 안 분할 칸 (P43)', () => {
  it('처음 칸은 창 가득 - 그 안에서 연 창은 가운데가 아니라 오른쪽 분할 칸에 서고, 처음 칸은 그 폭만큼 비킨다', async () => {
    await openRoot();
    const fill = document.querySelector<HTMLElement>('[data-panel-frame="window"]')!;
    expect(fill).not.toBeNull();
    expect(fill.style.right).toBe('');
    expect(column().children).toHaveLength(0);

    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    expect(document.querySelector('[data-popup-frame="center"]')).toBeNull();
    expect(column().querySelector('[data-popup-frame="side"]')).not.toBeNull();
    // 처음 칸은 오른쪽 줄에 서지 않는다
    expect(useSidePopups.getState().order).toHaveLength(1);
    expect(fill.style.right).not.toBe('');
  });

  it('↗는 분할 칸에만 - 처음 칸에는 없다', async () => {
    await openRoot();
    expect(document.querySelectorAll('[data-popout-open]')).toHaveLength(0);
    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    const btns = document.querySelectorAll('[data-popout-open]');
    expect(btns).toHaveLength(1);
    expect(column().contains(btns[0])).toBe(true);
  });

  it('분할 칸 ↗ = 그 칸을 또 새 창으로 (처음 칸은 옮기지 않는다)', async () => {
    await openRoot();
    let k = 0;
    act(() => void (k = openWindow('devWindow')));
    await screen.findByRole('heading', { name: '시험 창' });
    const replace = vi.fn();
    const popup = { closed: false, close: vi.fn(), focus: vi.fn(), location: { replace }, document: { title: '', body: { style: {}, textContent: '' } } };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    await act(() => popOutWindow(rootKey));
    expect(open).not.toHaveBeenCalled();
    await act(() => popOutWindow(k));
    expect(open).toHaveBeenCalledTimes(1);
    expect(JSON.parse(new URL(replace.mock.calls[0][0] as string).searchParams.get('popout')!)).toEqual({ id: 'devWindow' });
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([rootKey]);
  });

  it('ESC = 분할 칸만 닫고 처음 칸은 둔다 · 분할 칸이 없으면 모두 (새 창도 닫힌다)', async () => {
    await openRoot();
    act(() => {
      openWindow('devWindow');
      openWindow('devPanel', { n: 2 });
    });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    await screen.findByRole('heading', { name: '시험 창' });
    expect(useSidePopups.getState().order).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([rootKey]);
    expect(useSidePopups.getState().order).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useWindows.getState().windows).toHaveLength(0);
  });

  it('분할 칸에 저장 안 한 글이 있으면 한 번 묻는다 - 아니오면 그대로', async () => {
    await openRoot();
    act(() => void openWindow('devPanel', { n: 2 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    const ta = column().querySelector('textarea')!;
    fireEvent.change(ta, { target: { value: '적던 글' } });
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => void closeSplitWindows());
    expect(ask).toHaveBeenCalledTimes(1);
    expect(useWindows.getState().windows).toHaveLength(2);
    ask.mockReturnValue(true);
    act(() => void closeSplitWindows());
    expect(ask).toHaveBeenCalledTimes(2);
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([rootKey]);
  });

  it('처음 칸에만 저장 안 한 글이 있으면 묻지 않고 분할 칸을 닫는다', async () => {
    await openRoot();
    fireEvent.change(document.querySelector('[data-panel-frame="window"] textarea')!, { target: { value: '처음 칸 글' } });
    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => void closeSplitWindows());
    expect(ask).not.toHaveBeenCalled();
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([rootKey]);
  });

  it('보이는 창 셈 - 분할 칸이 열려도 처음 칸이 보인다', async () => {
    await openRoot();
    const seen = renderHook(() => useShownWindowPick((w) => (w.id === 'devPanel' ? 'root' : null)));
    expect(seen.result.current).toBe('root');
    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    seen.rerender();
    expect(seen.result.current).toBe('root');
  });
});

describe('분할 칸이 서면 새 창을 넓히고 닫히면 되돌린다 (useSplitWindowSize)', () => {
  let win: { x: number; w: number };
  beforeEach(() => {
    vi.useFakeTimers();
    win = { x: 100, w: 528 };
    Object.defineProperty(window, 'screenX', { configurable: true, get: () => win.x });
    Object.defineProperty(window, 'outerWidth', { configurable: true, get: () => win.w });
    Object.defineProperty(window, 'screen', { configurable: true, value: { availLeft: 0, availWidth: 1920 } });
    vi.spyOn(window, 'resizeTo').mockImplementation((w) => void (win.w = w));
    vi.spyOn(window, 'moveTo').mockImplementation((x) => void (win.x = x));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('두 배로 넓히고, 닫히면 처음 폭으로 · 넓힌 동안만 true', () => {
    const h = renderHook(({ open }) => useSplitWindowSize(open), { initialProps: { open: false } });
    expect(window.resizeTo).not.toHaveBeenCalled();
    h.rerender({ open: true });
    expect(win.w).toBe(1056);
    expect(h.result.current()).toBe(true);
    h.rerender({ open: false });
    vi.advanceTimersByTime(200);
    expect(win.w).toBe(528);
    expect(h.result.current()).toBe(false);
  });

  it('곧바로 다시 서면(탭 바꿔 열기) 되돌리지 않는다 · 두 번 불러도 더 넓히지 않는다', () => {
    const h = renderHook(({ open }) => useSplitWindowSize(open), { initialProps: { open: true } });
    expect(win.w).toBe(1056);
    h.rerender({ open: false });
    h.rerender({ open: true });
    vi.advanceTimersByTime(200);
    expect(win.w).toBe(1056);
    expect(window.resizeTo).toHaveBeenCalledTimes(1);
  });

  it('그 사이 사용자가 크기를 바꿨으면 그대로 둔다', () => {
    const h = renderHook(({ open }) => useSplitWindowSize(open), { initialProps: { open: true } });
    win.w = 1300;
    h.rerender({ open: false });
    vi.advanceTimersByTime(200);
    expect(win.w).toBe(1300);
  });

  it('왼쪽으로 옮겨 넓혔으면 되돌릴 때 제자리로', () => {
    win.x = 1380;
    const h = renderHook(({ open }) => useSplitWindowSize(open), { initialProps: { open: true } });
    expect(win).toEqual({ x: 864, w: 1056 });
    h.rerender({ open: false });
    vi.advanceTimersByTime(200);
    expect(win).toEqual({ x: 1380, w: 528 });
  });

  it('최대화(이미 화면만큼)면 건드리지 않는다', () => {
    win = { x: 0, w: 1920 };
    const h = renderHook(({ open }) => useSplitWindowSize(open), { initialProps: { open: true } });
    expect(window.resizeTo).not.toHaveBeenCalled();
    expect(h.result.current()).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { beginPendingWrite, resetPendingWritesForTest } from '../data/pendingWrites';
import PendingWritesBanner, { PENDING_NOTICE_MS } from './PendingWritesBanner';
import { usePendingWritesGuard } from './pendingWritesGuard';
import { showToast } from './toast';

vi.mock('./toast', () => ({ showToast: vi.fn() }));

const setOnline = (v: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v });
const banner = () => document.querySelector('[data-pending-writes]');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  resetPendingWritesForTest();
  vi.mocked(showToast).mockClear();
});

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('끊겨 저장을 기다림 - 머리줄 안내 (P14-6 ■1)', () => {
  it('인터넷이 끊겼으면 곧바로 "앱을 닫지 마세요 (n개)" → 다 받으면 거두고 한 번 알린다', () => {
    setOnline(false);
    render(<PendingWritesBanner />);
    expect(banner()).toBeNull();
    let a!: () => void;
    let b!: () => void;
    act(() => {
      a = beginPendingWrite();
      b = beginPendingWrite();
    });
    expect(banner()?.getAttribute('data-pending-writes')).toBe('2');
    expect(banner()?.hasAttribute('data-pending-offline')).toBe(true);
    expect(banner()?.textContent).toContain('📴 인터넷이 끊겨 저장을 기다립니다 - 앱을 닫지 마세요 (2개)');
    act(() => a());
    expect(banner()?.textContent).toContain('(1개)');
    expect(showToast).not.toHaveBeenCalled();
    act(() => b());
    expect(banner()).toBeNull();
    expect(showToast).toHaveBeenCalledWith('✅ 기다리던 저장을 마쳤습니다.');
  });

  it('이어져 있으면 3초 넘게 기다릴 때만 - 짧은 저장은 띠도 알림도 없다', () => {
    render(<PendingWritesBanner />);
    let quick!: () => void;
    act(() => {
      quick = beginPendingWrite();
    });
    expect(banner()).toBeNull();
    act(() => quick());
    act(() => vi.advanceTimersByTime(PENDING_NOTICE_MS + 100));
    expect(banner()).toBeNull();
    expect(showToast).not.toHaveBeenCalled();

    let slow!: () => void;
    act(() => {
      slow = beginPendingWrite();
    });
    act(() => vi.advanceTimersByTime(PENDING_NOTICE_MS - 100));
    expect(banner()).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(banner()?.textContent).toContain('⏳ 저장을 기다립니다 - 앱을 닫지 마세요 (1개)');
    expect(banner()?.hasAttribute('data-pending-offline')).toBe(false);
    act(() => slow());
    expect(banner()).toBeNull();
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('끊김 이벤트(offline)를 받으면 기다리던 것이 곧바로 띠가 된다', () => {
    render(<PendingWritesBanner />);
    act(() => {
      beginPendingWrite();
    });
    expect(banner()).toBeNull();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(banner()?.hasAttribute('data-pending-offline')).toBe(true);
  });
});

describe('창 위에 뜨기 (휴대폰에서 창이 화면을 덮을 때·새 창)', () => {
  it('floating이면 body로 portal - 누르기는 아래 창으로 지나간다', () => {
    setOnline(false);
    const { container } = render(<PendingWritesBanner floating />);
    act(() => {
      beginPendingWrite();
    });
    const bar = banner();
    expect(bar?.hasAttribute('data-pending-floating')).toBe(true);
    expect(container.contains(bar)).toBe(false);
    expect(bar?.parentElement?.className).toContain('pointer-events-none');
  });
});

describe('닫기 전에 묻기 (beforeunload)', () => {
  const leave = () => {
    const e = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(e);
    return e.defaultPrevented;
  };

  it('기다리는 저장이 있을 때만 묻는다', () => {
    renderHook(() => usePendingWritesGuard());
    expect(leave()).toBe(false);
    let end!: () => void;
    act(() => {
      end = beginPendingWrite();
    });
    expect(leave()).toBe(true);
    act(() => end());
    expect(leave()).toBe(false);
  });

  it('새 창은 저장 안 한 칸도 묻는다 (more)', () => {
    let unsaved = true;
    renderHook(() => usePendingWritesGuard(() => unsaved));
    expect(leave()).toBe(true);
    unsaved = false;
    expect(leave()).toBe(false);
  });
});

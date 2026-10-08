import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetHistoryForTest } from './history';
import { useAppKeys } from './keys';
import { setPopupStyle } from './layoutPrefs';
import WindowHost from './WindowHost';
import SideTabs from '../ui/SideTabs';
import { closeAllWindows, openWindow, registerWindow, resetWindowsForTest, useWindows } from './windows';
import { useSidePopups } from '../ui/sideColumn';

// 오른쪽 줄 (V4 CLAUDE.md 5장): 한 줄에 탭, 숨은 탭도 적던 글째 살아 있다, 탭 ×는 그 칸 닫기,
// ESC는 줄 전체(저장 안 한 글은 먼저 묻는다), Ctrl+S는 커서가 든 칸만(없으면 보이는 탭).

/** 넓은 화면(옆에 붙는다)인 척 - jsdom에는 matchMedia가 없다 */
function wideScreen(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function Host() {
  useAppKeys();
  return (
    <>
      <WindowHost />
      <SideTabs />
    </>
  );
}

const column = () => document.getElementById('side-column')!;
const panels = () => [...document.querySelectorAll<HTMLElement>('[data-test-panel]')];
const shownPanel = () => panels().find((p) => p.closest<HTMLElement>('[data-side-slot]')!.style.display !== 'none');

beforeEach(() => {
  resetHistoryForTest();
  resetWindowsForTest();
  setPopupStyle('side');
  wideScreen(true);
  registerWindow({ id: 'devWindow', title: '시험 창', icon: '🧪', kind: 'side', dev: true, load: () => import('../features/dev/TestWindow') });
  registerWindow({ id: 'devPanel', title: '시험 쓰는 칸', icon: '🧪', kind: 'panel', dev: true, load: () => import('../features/dev/TestPanel') });
});
afterEach(() => {
  act(() => {
    useWindows.setState({ windows: [] });
  });
  vi.restoreAllMocks();
});

describe('창 목록', () => {
  it('등록하지 않은 창은 열 수 없다', () => {
    expect(() => openWindow('nope')).toThrow();
  });

  it('창(side)은 하나만 - 다시 열면 새로 만들지 않고 그 탭을 보인다', () => {
    const a = openWindow('devWindow');
    const b = openWindow('devWindow');
    expect(b).toBe(a);
    expect(useWindows.getState().windows).toHaveLength(1);
  });

  it('쓰는 칸은 항목(params)마다 하나', () => {
    openWindow('devPanel', { n: 1 });
    openWindow('devPanel', { n: 2 });
    openWindow('devPanel', { n: 1 });
    expect(useWindows.getState().windows.map((w) => w.params)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('id가 겹치면 등록하지 않는다', () => {
    expect(() => registerWindow({ id: 'devPanel', title: 'x', icon: 'x', kind: 'panel', load: () => import('../features/dev/TestPanel') })).toThrow();
  });
});

describe('오른쪽 줄', () => {
  it('둘 이상이면 위에 탭, 새 칸이 보이고 숨은 칸도 적던 글째 남는다', async () => {
    const user = userEvent.setup();
    render(<Host />);
    act(() => void openWindow('devPanel', { n: 1 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    await user.type(panels()[0].querySelector('textarea')!, '첫 칸 글');

    act(() => void openWindow('devPanel', { n: 2 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    expect(column().querySelectorAll('[data-side-tab]')).toHaveLength(2);
    expect(shownPanel()?.dataset.testPanel).toBe('2');
    // 숨은 첫 칸의 글은 그대로
    expect(panels()[0].querySelector('textarea')!.value).toBe('첫 칸 글');

    // 첫 칸을 다시 열면 그 탭이 보인다
    act(() => void openWindow('devPanel', { n: 1 }));
    expect(shownPanel()?.dataset.testPanel).toBe('1');
    expect(panels()[0].querySelector('textarea')!.value).toBe('첫 칸 글');
  });

  it('탭 ×는 그 칸 하나만 닫는다', async () => {
    render(<Host />);
    act(() => {
      openWindow('devPanel', { n: 1 });
      openWindow('devWindow');
    });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    await screen.findByRole('heading', { name: '시험 창' });
    const tabs = column().querySelectorAll('[data-side-tab-close]');
    expect(tabs).toHaveLength(2);
    act(() => (tabs[1] as HTMLButtonElement).click());
    expect(useWindows.getState().windows.map((w) => w.id)).toEqual(['devPanel']);
  });

  it('Ctrl+S는 커서가 든 칸만 저장한다', async () => {
    render(<Host />);
    act(() => {
      openWindow('devPanel', { n: 1 });
      openWindow('devPanel', { n: 2 });
    });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    const [p1, p2] = panels();
    fireEvent.change(p1.querySelector('textarea')!, { target: { value: '하나' } });
    fireEvent.change(p2.querySelector('textarea')!, { target: { value: '둘' } });
    p2.querySelector('textarea')!.focus();
    fireEvent.keyDown(document.activeElement!, { key: 's', code: 'KeyS', ctrlKey: true });
    expect(p2.dataset.saved).toBe('둘');
    expect(p1.dataset.saved).toBe('');
  });

  it('커서가 아무 데도 없으면 Ctrl+S는 보이는 탭이 받는다', async () => {
    render(<Host />);
    act(() => {
      openWindow('devPanel', { n: 1 });
      openWindow('devPanel', { n: 2 });
    });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    const [p1, p2] = panels();
    fireEvent.change(p1.querySelector('textarea')!, { target: { value: '하나' } });
    fireEvent.change(p2.querySelector('textarea')!, { target: { value: '둘' } });
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: 's', code: 'KeyS', ctrlKey: true });
    expect(p2.dataset.saved).toBe('둘');
    expect(p1.dataset.saved).toBe('');
  });

  it('ESC는 줄 전체 - 저장 안 한 글이 있으면 먼저 묻고, 아니라면 그대로 둔다', async () => {
    render(<Host />);
    act(() => {
      openWindow('devWindow');
      openWindow('devPanel', { n: 1 });
    });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    fireEvent.change(panels()[0].querySelector('textarea')!, { target: { value: '적던 글' } });

    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(useWindows.getState().windows).toHaveLength(2);

    ask.mockReturnValue(true);
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(useWindows.getState().windows).toHaveLength(0);
    expect(useSidePopups.getState().order).toHaveLength(0);
  });

  it('저장 안 한 글이 없으면 묻지 않고 닫는다', async () => {
    render(<Host />);
    act(() => void openWindow('devPanel', { n: 1 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    const ask = vi.spyOn(window, 'confirm');
    act(() => void closeAllWindows());
    expect(ask).not.toHaveBeenCalled();
    expect(useWindows.getState().windows).toHaveLength(0);
  });
});

describe('창 위치', () => {
  it('가운데 창이면 창은 가운데, 쓰는 칸은 그래도 오른쪽에 붙는다', async () => {
    setPopupStyle('center');
    render(<Host />);
    act(() => {
      openWindow('devWindow');
      openWindow('devPanel', { n: 1 });
    });
    await screen.findByRole('heading', { name: '시험 창' });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    expect(document.querySelector('[data-popup-frame="center"]')).not.toBeNull();
    expect(document.querySelector('[data-panel-frame="side"]')).not.toBeNull();
  });

  it('좁은 화면(휴대폰)에서는 오른쪽에서 덮는 배너', async () => {
    wideScreen(false);
    render(<Host />);
    act(() => void openWindow('devPanel', { n: 1 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    expect(document.querySelector('[data-panel-frame="banner"]')).not.toBeNull();
  });
});

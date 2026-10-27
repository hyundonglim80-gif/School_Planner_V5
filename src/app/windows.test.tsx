import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetHistoryForTest } from './history';
import { useAppKeys } from './keys';
import { setPopupStyle } from './layoutPrefs';
import WindowHost from './WindowHost';
import SideTabs from '../ui/SideTabs';
import { closeAllWindows, closeWindow, openWindow, registerWindow, resetWindowsForTest, useShownWindowPick, useWindows, windowUnsaved } from './windows';
import { popOutWindow } from './popout';
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

  // 10-21 사용자: 메모 A를 연 뒤 B를 열면 A의 테두리는 빠져야 한다 - 카드는 보이는 탭의 항목 하나만 짚는다
  it('보이는 창(useShownWindowPick)은 보이는 탭 하나 - 탭을 바꾸면 따라가고, 다른 창이 보이면 없다', async () => {
    function Shown() {
      const n = useShownWindowPick((w) => (w.id === 'devPanel' ? String((w.params as { n: number }).n) : null));
      return <output data-shown={n ?? ''} />;
    }
    const shown = () => document.querySelector<HTMLElement>('[data-shown]')!.dataset.shown;
    render(
      <>
        <Host />
        <Shown />
      </>,
    );
    act(() => void openWindow('devPanel', { n: 1 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    expect(shown()).toBe('1');
    act(() => void openWindow('devPanel', { n: 2 }));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    expect(shown()).toBe('2');

    // 탭을 눌러 첫 칸을 보이면 그것만
    const tab1 = [...column().querySelectorAll<HTMLElement>('[data-side-tab]')][0];
    act(() => tab1.querySelector('button')!.click());
    expect(shownPanel()?.dataset.testPanel).toBe('1');
    expect(shown()).toBe('1');
    // 목록에서 둘째를 다시 열면 그것만
    act(() => void openWindow('devPanel', { n: 2 }));
    expect(shown()).toBe('2');
    // 다른 창의 탭이 보이면 아무것도 짚지 않는다
    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    expect(shown()).toBe('');
    // 보이던 칸을 닫으면 남은 탭(맨 나중에 연 것)
    act(() => void closeWindow(useWindows.getState().windows.find((w) => w.id === 'devWindow')!.key));
    expect(shown()).toBe('2');
  });

  it('좁은 화면(덮는 배너)은 맨 나중에 연 창이 보이는 창', async () => {
    wideScreen(false);
    function Shown() {
      const n = useShownWindowPick((w) => (w.id === 'devPanel' ? String((w.params as { n: number }).n) : null));
      return <output data-shown={n ?? ''} />;
    }
    const shown = () => document.querySelector<HTMLElement>('[data-shown]')!.dataset.shown;
    render(
      <>
        <Host />
        <Shown />
      </>,
    );
    act(() => {
      openWindow('devPanel', { n: 1 });
      openWindow('devPanel', { n: 2 });
    });
    expect(shown()).toBe('2');
    act(() => void openWindow('devPanel', { n: 1 }));
    expect(shown()).toBe('1');
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

describe('새 창으로 옮기기 (10-28)', () => {
  it('↗는 오른쪽 줄에 붙은 창에만 - 가운데 창·휴대폰 배너에는 없다', async () => {
    const { unmount } = render(<Host />);
    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    expect(document.querySelectorAll('[data-popout-open]')).toHaveLength(1);
    unmount();
    act(() => useWindows.setState({ windows: [] }));
    setPopupStyle('center');
    render(<Host />);
    act(() => void openWindow('devWindow'));
    await screen.findByRole('heading', { name: '시험 창' });
    expect(document.querySelector('[data-popout-open]')).toBeNull();
  });

  it('저장 안 한 것은 그 창 것만 세고, 옮기기 전에 그 창을 저장한 뒤 새 창 주소로 보내고 탭을 닫는다', async () => {
    const user = userEvent.setup();
    render(<Host />);
    let k1 = 0;
    let k2 = 0;
    act(() => {
      k1 = openWindow('devPanel', { n: 1 });
      k2 = openWindow('devPanel', { n: 2 });
    });
    await screen.findByRole('heading', { name: '시험 쓰는 칸 2' });
    // 탭 1로 가서 적는다
    await user.click(screen.getAllByRole('tab')[0].querySelector('button')!);
    await user.type(panels()[0].querySelector('textarea')!, '옮길 글');
    expect(windowUnsaved(k1)).toBe(true);
    expect(windowUnsaved(k2)).toBe(false);

    const replace = vi.fn();
    const popup = { closed: false, close: vi.fn(), focus: vi.fn(), location: { replace }, document: { title: '', body: { style: {}, textContent: '' } } };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    // 누른 그때 새 창을 열고 저장한다 - 저장이 칸에 들어간 뒤(다음 그리기) 옮긴다
    let moving: Promise<void> = Promise.resolve();
    act(() => void (moving = popOutWindow(k1)));
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    await act(() => moving);
    expect(open).toHaveBeenCalledTimes(1);
    // (옮긴 것 = 저장이 들어가 탭 1에 저장 안 한 것이 없어진 뒤 - 아니면 8초 기다리다 그만둔다)
    expect(open.mock.calls[0][2]).toMatch(/^popup=yes,width=\d+,height=\d+/);
    const url = new URL(replace.mock.calls[0][0] as string);
    expect(JSON.parse(url.searchParams.get('popout')!)).toEqual({ id: 'devPanel', params: { n: 1 } });
    expect(popup.close).not.toHaveBeenCalled();
    // 탭 1은 닫히고 2만 남는다
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([k2]);
  });

  it('브라우저가 새 창을 막으면 그대로 둔다', async () => {
    render(<Host />);
    let k = 0;
    act(() => void (k = openWindow('devPanel', { n: 1 })));
    await screen.findByRole('heading', { name: '시험 쓰는 칸 1' });
    vi.spyOn(window, 'open').mockReturnValue(null);
    await act(() => popOutWindow(k));
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([k]);
  });
});

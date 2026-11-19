// 📋 클립보드 탭 (P47-1 - 옛 왼쪽 칸을 창 칸의 탭 하나로): 📋·단축키로 열기 / 숨은 탭 보이기 / 닫기 · 열린 채 새로고침하면 다시 선다(넓은 화면만) ·
// Ctrl+C 한 글자를 모은다(비밀번호 칸은 빼고) · 누르면 글 쓰던 칸의 커서 자리에 · 받을 칸이 없으면 클립보드에 · ✕ = 휴지통 · 휴대폰은 위에 덮는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { resetHistoryForTest } from '../../app/history';
import { runShortcut } from '../../app/keys';
import { setPopupStyle } from '../../app/layoutPrefs';
import WindowHost from '../../app/WindowHost';
import { openWindow, registerWindow, resetWindowsForTest, useWindows } from '../../app/windows';
import { addClipText, loadClipboard, resetClipboardForTest, useClipboard, wipeClipboard } from '../../data/clipboard';
import { useSession } from '../../data/session';
import SideTabs from '../../ui/SideTabs';
import { CLIPBOARD_WINDOW, setClipboardOpen, useClipboardCapture, useClipboardPanel } from './capture';
import ClipboardToggle from './ClipboardToggle';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const q = (s: string) => document.querySelector<HTMLElement>(s);
const clipOpen = () => useWindows.getState().windows.some((w) => w.id === CLIPBOARD_WINDOW);

function Host() {
  useClipboardCapture();
  const [text, setText] = useState('앞뒤');
  return (
    <>
      <textarea data-target value={text} onChange={(e) => setText(e.target.value)} />
      <input data-password type="password" defaultValue="비밀" />
      <ClipboardToggle />
      <WindowHost />
      <SideTabs />
    </>
  );
}

/** 넓은 화면 (칸이 화면 옆에 붙는다) - jsdom에는 matchMedia가 없다 */
function wide(on: boolean) {
  window.matchMedia = ((query: string) => ({ matches: on, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

beforeEach(async () => {
  wide(true);
  resetHistoryForTest();
  resetWindowsForTest();
  setPopupStyle('side');
  registerWindow({ id: CLIPBOARD_WINDOW, title: '클립보드', icon: '📋', kind: 'side', help: 'clipboard', load: () => import('./ClipboardWindow') });
  registerWindow({ id: 'devPanel', title: '시험 쓰는 칸', icon: '🧪', kind: 'panel', dev: true, load: () => import('../dev/TestPanel') });
  resetClipboardForTest();
  await wipeClipboard('me');
  setClipboardOpen(false);
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  await loadClipboard('me');
});

afterEach(() => {
  act(() => useWindows.setState({ windows: [] }));
  vi.restoreAllMocks();
});

describe('클립보드 탭', () => {
  it('📋 = 창 칸에 탭으로 열기, 다시 누르면 닫기, 단축키로도 - 열림은 이 기기에 적는다', async () => {
    render(<Host />);
    expect(q('[data-clipboard-toggle="closed"]')?.textContent).toBe('📋');
    fireEvent.click(q('[data-clipboard-toggle]')!);
    await waitFor(() => expect(q('#side-column [data-clipboard-panel]')).not.toBeNull());
    expect(q('[data-clipboard-empty]')).not.toBeNull();
    expect(q('[data-popup-frame="side"]')?.getAttribute('aria-label')).toBe('📋 클립보드');
    expect(q('[data-clipboard-toggle]')?.getAttribute('data-clipboard-toggle')).toBe('open');
    expect(useClipboardPanel.getState().open).toBe(true);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(clipOpen()).toBe(false);
    await waitFor(() => expect(useClipboardPanel.getState().open).toBe(false));
    act(() => void runShortcut('clipboard'));
    expect(clipOpen()).toBe(true);
    // 창의 ✕ = 그 탭 닫기 (다른 탭과 같다)
    await waitFor(() => expect(q('#side-column [data-close]')).not.toBeNull());
    fireEvent.click(q('#side-column [data-close]')!);
    expect(clipOpen()).toBe(false);
  });

  it('다른 탭 뒤에 숨어 있으면 📋 = 그 탭 보이기 (닫지 않는다)', async () => {
    render(<Host />);
    act(() => void openWindow(CLIPBOARD_WINDOW));
    await waitFor(() => expect(q('[data-clipboard-panel]')).not.toBeNull());
    act(() => void openWindow('devPanel', { n: 1 }));
    await waitFor(() => expect(q('[data-side-tabs]')).not.toBeNull());
    const clipSlot = () => q('[data-clipboard-panel]')!.closest<HTMLElement>('[data-side-slot]')!;
    expect(clipSlot().style.display).toBe('none');
    expect(q('[data-clipboard-toggle]')?.getAttribute('data-clipboard-toggle')).toBe('closed');
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(clipOpen()).toBe(true);
    await waitFor(() => expect(clipSlot().style.display).not.toBe('none'));
    expect(q('[data-clipboard-toggle]')?.getAttribute('data-clipboard-toggle')).toBe('open');
  });

  it('열어 둔 채 새로고침하면 다시 선다 (넓은 화면)', async () => {
    setClipboardOpen(true);
    render(<Host />);
    await waitFor(() => expect(q('#side-column [data-clipboard-panel]')).not.toBeNull());
    expect(useClipboardPanel.getState().open).toBe(true);
  });

  it('휴대폰: 열어 둔 채 다시 열면 닫고 시작한다 (화면을 덮지 않게), 열면 다른 창처럼 덮는다', async () => {
    wide(false);
    setClipboardOpen(true);
    render(<Host />);
    await waitFor(() => expect(useClipboardPanel.getState().open).toBe(false));
    expect(clipOpen()).toBe(false);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    await waitFor(() => expect(q('[data-clipboard-panel]')).not.toBeNull());
    expect(q('[data-clipboard-panel]')!.closest('[data-popup-frame]')?.getAttribute('data-popup-frame')).toBe('banner');
  });

  it('앱 안에서 Ctrl+C 한 글자를 모은다 - 비밀번호 칸은 빼고', async () => {
    render(<Host />);
    const ta = q('[data-target]') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(0, 1);
    fireEvent.copy(ta);
    await waitFor(() => expect(useClipboard.getState().items.map((i) => i.text)).toEqual(['앞']));
    const pw = q('[data-password]') as HTMLInputElement;
    pw.focus();
    pw.setSelectionRange(0, 2);
    fireEvent.copy(pw);
    await new Promise((r) => setTimeout(r, 20));
    expect(useClipboard.getState().items).toHaveLength(1);
  });

  it('항목을 누르면 글 쓰던 칸의 커서 자리에 넣는다, ✕ = 휴지통', async () => {
    await addClipText('가운데');
    render(<Host />);
    act(() => void openWindow(CLIPBOARD_WINDOW));
    const id = useClipboard.getState().items[0].id;
    await waitFor(() => expect(q(`[data-clip-paste="${id}"]`)).not.toBeNull());
    const ta = q('[data-target]') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(1, 1);
    await act(async () => fireEvent.click(q(`[data-clip-paste="${id}"]`)!));
    expect(ta.value).toBe('앞가운데뒤');
    await act(async () => fireEvent.click(q(`[data-clip-remove="${id}"]`)!));
    expect(useClipboard.getState().items).toEqual([]);
    expect(useClipboard.getState().trash.map((t) => t.text)).toEqual(['가운데']);
  });

  it('받을 칸이 없으면 시스템 클립보드에 담고 알린다', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await addClipText('담기');
    render(
      <>
        <WindowHost />
      </>,
    );
    act(() => void openWindow(CLIPBOARD_WINDOW));
    const id = useClipboard.getState().items[0].id;
    await waitFor(() => expect(q(`[data-clip-paste="${id}"]`)).not.toBeNull());
    (document.activeElement as HTMLElement | null)?.blur();
    await act(async () => fireEvent.click(q(`[data-clip-paste="${id}"]`)!));
    expect(writeText).toHaveBeenCalledWith('담기');
    expect(q('[data-toast]')?.textContent).toContain('클립보드에 담았습니다');
  });
});

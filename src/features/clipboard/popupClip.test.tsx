// 창 위치 '팝업창'이면 📋 = 클립보드 팝업창 (#140) - 못 띄우면 큰 창 가운데 (P47-1 - 클립보드는 창 목록의 창) · 글 칸을 누른 창 = 마지막으로 글을 쓰던 창 ·
// 그 창이 부탁을 받으면 커서 자리에 넣는다 · 받을 창이 없으면 팝업창이 시스템 클립보드에 담는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle } from '../../app/layoutPrefs';
import { resetPopupWindowsForTest } from '../../app/popupWindows';
import WindowHost from '../../app/WindowHost';
import { registerWindow, resetWindowsForTest, useWindows } from '../../app/windows';
import { loadClipboard, resetClipboardForTest, wipeClipboard, type ClipItem } from '../../data/clipboard';
import { useSession } from '../../data/session';
import { CLIPBOARD_WINDOW, setClipboardOpen, useClipboardCapture } from './capture';
import ClipboardToggle from './ClipboardToggle';
import { handleClipMessage, pasteFromPopup, WIN_ID } from './popupClip';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const q = (s: string) => document.querySelector<HTMLElement>(s);
const LAST_EDITOR_KEY = 'sp5-clip-last-editor';

function Host() {
  useClipboardCapture();
  const [text, setText] = useState('앞뒤');
  return (
    <>
      <textarea data-target value={text} onChange={(e) => setText(e.target.value)} />
      <ClipboardToggle />
      <WindowHost />
    </>
  );
}

/** PC 넓은 화면 (손가락 아님) */
function pc() {
  window.matchMedia = ((query: string) => ({
    matches: !query.includes('coarse'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

/** 누른 때인 척 + 브라우저 새 창 흉내. blocked면 막힌다(null) */
function fakeOpen(blocked = false) {
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true, hasBeenActive: true } });
  const urls: string[] = [];
  const spy = vi.spyOn(window, 'open').mockImplementation(() => {
    if (blocked) return null;
    const w = {
      closed: false,
      document: document.implementation.createHTMLDocument(''),
      focus: vi.fn(),
      postMessage: vi.fn(),
      location: {
        href: 'about:blank',
        replace(u: string) {
          urls.push(u);
        },
      },
    };
    return w as unknown as Window;
  });
  return { urls, spy };
}

const textClip = (text: string): ClipItem => ({ id: 'c1', kind: 'text', text, key: `t:${text}`, createdAt: 1 });

const clipOpen = () => useWindows.getState().windows.some((w) => w.id === CLIPBOARD_WINDOW);

beforeEach(async () => {
  pc();
  resetPopupWindowsForTest();
  resetHistoryForTest();
  resetWindowsForTest();
  registerWindow({ id: CLIPBOARD_WINDOW, title: '클립보드', icon: '📋', kind: 'side', help: 'clipboard', load: () => import('./ClipboardWindow') });
  resetClipboardForTest();
  await wipeClipboard('me');
  setClipboardOpen(false);
  localStorage.removeItem(LAST_EDITOR_KEY);
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  await loadClipboard('me');
});

afterEach(() => {
  act(() => useWindows.setState({ windows: [] }));
  setPopupStyle('side');
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false, hasBeenActive: false } });
});

describe('클립보드 팝업창 (#140)', () => {
  it('창 위치가 팝업창이면 📋 = 클립보드 팝업창 (큰 창에는 탭을 열지 않는다)', () => {
    setPopupStyle('popup');
    const { urls } = fakeOpen();
    const r = render(<Host />);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(urls).toHaveLength(1);
    expect(JSON.parse(new URL(urls[0]).searchParams.get('popout')!)).toMatchObject({ id: 'clipboard' });
    expect(clipOpen()).toBe(false);
    // 열려 있으면 새로 띄우지 않고 앞으로
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(urls).toHaveLength(1);
    r.unmount();
  });

  it('브라우저가 팝업창을 막으면 큰 창 가운데에 연다 (다른 창과 같다)', async () => {
    setPopupStyle('popup');
    fakeOpen(true);
    const r = render(<Host />);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(clipOpen()).toBe(true);
    await waitFor(() => expect(q('[data-clipboard-panel]')).not.toBeNull());
    expect(q('[data-clipboard-panel]')!.closest('[data-popup-frame]')?.getAttribute('data-popup-frame')).toBe('center');
    r.unmount();
  });

  it('오른쪽 칸 모드는 창 칸의 탭 (팝업창을 띄우지 않는다)', async () => {
    const { spy } = fakeOpen();
    const r = render(<Host />);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => expect(q('#side-column [data-clipboard-panel]')).not.toBeNull());
    r.unmount();
  });

  it('글 칸을 누른 창이 마지막으로 글을 쓰던 창 - 부탁을 받으면 그 커서 자리에 넣는다', () => {
    setPopupStyle('popup');
    // 붙인 창을 앞으로 (jsdom에는 없다)
    const raise = vi.spyOn(window, 'focus').mockImplementation(() => {});
    const r = render(<Host />);
    const ta = q('[data-target]') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(1, 1);
    expect(localStorage.getItem(LAST_EDITOR_KEY)).toBe(WIN_ID);
    act(() => handleClipMessage({ t: 'paste', to: WIN_ID, req: 'r1', item: textClip('가운데') }, 'me'));
    expect(ta.value).toBe('앞가운데뒤');
    expect(raise).toHaveBeenCalled();
    // 다른 창에 온 부탁은 넣지 않는다
    act(() => handleClipMessage({ t: 'paste', to: 'other', req: 'r2', item: textClip('딴곳') }, 'me'));
    expect(ta.value).toBe('앞가운데뒤');
    r.unmount();
  });

  it('오른쪽 칸 모드에서도 글 칸을 누른 창을 적는다 - 클립보드 탭을 ↗로 옮긴 팝업창이 이 창에 붙인다 (P47-1)', () => {
    vi.spyOn(window, 'focus').mockImplementation(() => {});
    const r = render(<Host />);
    const ta = q('[data-target]') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(2, 2);
    expect(localStorage.getItem(LAST_EDITOR_KEY)).toBe(WIN_ID);
    act(() => handleClipMessage({ t: 'paste', to: WIN_ID, req: 'r3', item: textClip('끝') }, 'me'));
    expect(ta.value).toBe('앞뒤끝');
    r.unmount();
  });

  it('받을 창이 없으면(닫았다) 팝업창이 시스템 클립보드에 담는다', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    expect(await pasteFromPopup(textClip('담기'))).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('담기');
  });
});

// 창 위치 '팝업창'이면 📋 = 클립보드 팝업창 (#140) - 못 띄우면 왼쪽 칸 · 글 칸을 누른 창 = 마지막으로 글을 쓰던 창 ·
// 그 창이 부탁을 받으면 커서 자리에 넣는다 · 받을 창이 없으면 팝업창이 시스템 클립보드에 담는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { setPopupStyle } from '../../app/layoutPrefs';
import { resetPopupWindowsForTest } from '../../app/popupWindows';
import { loadClipboard, resetClipboardForTest, wipeClipboard, type ClipItem } from '../../data/clipboard';
import { useSession } from '../../data/session';
import { setClipboardOpen, useClipboardCapture, useClipboardPanel } from './capture';
import ClipboardColumn from './ClipboardColumn';
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
      <ClipboardColumn />
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

beforeEach(async () => {
  pc();
  resetPopupWindowsForTest();
  resetClipboardForTest();
  await wipeClipboard('me');
  setClipboardOpen(false);
  localStorage.removeItem(LAST_EDITOR_KEY);
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  await loadClipboard('me');
});

afterEach(() => {
  setPopupStyle('side');
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false, hasBeenActive: false } });
});

describe('클립보드 팝업창 (#140)', () => {
  it('창 위치가 팝업창이면 📋 = 클립보드 팝업창 (왼쪽 칸은 열지 않는다)', () => {
    setPopupStyle('popup');
    const { urls } = fakeOpen();
    const r = render(<Host />);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(urls).toHaveLength(1);
    expect(JSON.parse(new URL(urls[0]).searchParams.get('popout')!)).toMatchObject({ id: 'clipboard' });
    expect(useClipboardPanel.getState().open).toBe(false);
    expect(q('[data-clipboard-panel]')).toBeNull();
    r.unmount();
  });

  it('브라우저가 팝업창을 막으면 왼쪽 칸을 연다', () => {
    setPopupStyle('popup');
    fakeOpen(true);
    const r = render(<Host />);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(useClipboardPanel.getState().open).toBe(true);
    expect(q('[data-clipboard-panel]')).not.toBeNull();
    r.unmount();
  });

  it('오른쪽 칸 모드는 예전처럼 왼쪽 칸 (팝업창을 띄우지 않는다)', () => {
    const { spy } = fakeOpen();
    const r = render(<Host />);
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(spy).not.toHaveBeenCalled();
    expect(useClipboardPanel.getState().open).toBe(true);
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

  it('받을 창이 없으면(닫았다) 팝업창이 시스템 클립보드에 담는다', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    expect(await pasteFromPopup(textClip('담기'))).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('담기');
  });
});

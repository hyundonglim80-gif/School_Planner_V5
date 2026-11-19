// 클립보드 = 창 칸의 탭 (P47-1) - 📋로 열고 닫기·단축키·열어 둔 채 다시 열면 다시 선다(휴대폰은 닫고 시작)·Ctrl+C 한 글자를 모은다(비밀번호 칸은 빼고)·누르면 글 쓰던 칸의 커서 자리에·받을 칸이 없으면 클립보드에·✕ = 휴지통
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { runShortcut } from '../../app/keys';
import '../../app/windowList';
import { useWindows } from '../../app/windows';
import { addClipText, loadClipboard, resetClipboardForTest, useClipboard, wipeClipboard } from '../../data/clipboard';
import { useSession } from '../../data/session';
import { setClipboardOpen, useClipboardCapture, useClipboardPanel } from './capture';
import ClipboardColumn from './ClipboardColumn';
import ClipboardWindow from './ClipboardWindow';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const q = (s: string) => document.querySelector<HTMLElement>(s);
const tabs = () => useWindows.getState().windows.filter((w) => w.id === 'clipboard');

function Host() {
  useClipboardCapture();
  const [text, setText] = useState('앞뒤');
  return (
    <>
      <textarea data-target value={text} onChange={(e) => setText(e.target.value)} />
      <input data-password type="password" defaultValue="비밀" />
      <ClipboardColumn />
    </>
  );
}

/** 넓은 화면 (칸이 화면 옆에 붙는다) - jsdom에는 matchMedia가 없다 */
function wide(on: boolean) {
  window.matchMedia = ((query: string) => ({ matches: on, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

beforeEach(async () => {
  wide(true);
  resetClipboardForTest();
  await wipeClipboard('me');
  setClipboardOpen(false);
  useWindows.setState({ windows: [] });
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  await loadClipboard('me');
});

describe('클립보드 칸', () => {
  it('📋 = 창 칸에 클립보드 탭, 보이는 탭이면 📋·단축키 = 닫기', async () => {
    render(<Host />);
    expect(q('[data-clipboard-toggle="closed"]')?.textContent).toBe('📋');
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(tabs()).toHaveLength(1);
    await waitFor(() => expect(q('[data-clipboard-toggle="open"]')?.textContent).toBe('📋'));
    fireEvent.click(q('[data-clipboard-toggle]')!);
    expect(tabs()).toHaveLength(0);
    act(() => void runShortcut('clipboard'));
    expect(tabs()).toHaveLength(1);
    act(() => void runShortcut('clipboard'));
    expect(tabs()).toHaveLength(0);
  });

  it('탭이 서 있는 동안 열림을 이 기기에 적는다 (닫으면 지운다)', () => {
    const { unmount } = render(<ClipboardWindow params={undefined} close={() => {}} raise={0} setParams={() => {}} />);
    expect(useClipboardPanel.getState().open).toBe(true);
    unmount();
    expect(useClipboardPanel.getState().open).toBe(false);
  });

  it('넓은 화면: 열어 둔 채 다시 열면 탭이 다시 선다', () => {
    setClipboardOpen(true);
    render(<ClipboardColumn />);
    expect(tabs()).toHaveLength(1);
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
    render(
      <>
        <Host />
        <ClipboardWindow params={undefined} close={() => {}} raise={0} setParams={() => {}} />
      </>,
    );
    const ta = q('[data-target]') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(1, 1);
    const id = useClipboard.getState().items[0].id;
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
    render(<ClipboardWindow params={undefined} close={() => {}} raise={0} setParams={() => {}} />);
    (document.activeElement as HTMLElement | null)?.blur();
    const id = useClipboard.getState().items[0].id;
    await act(async () => fireEvent.click(q(`[data-clip-paste="${id}"]`)!));
    expect(writeText).toHaveBeenCalledWith('담기');
    expect(q('[data-toast]')?.textContent).toContain('클립보드에 담았습니다');
  });

  it('휴대폰: 열어 둔 채 다시 열면 닫고 시작한다 (화면을 덮지 않게 - 탭을 세우지 않는다)', () => {
    wide(false);
    setClipboardOpen(true);
    render(<ClipboardColumn />);
    expect(useClipboardPanel.getState().open).toBe(false);
    expect(tabs()).toHaveLength(0);
  });
});

// 💬 대화 글 칸 (P19-2 ■2) - Enter 보내기 · Shift+Enter 줄 바꿈 · 한글 짜는 중 Enter · 휴대폰 자판 Enter · 보내지 못하면 글 그대로 · 쓰던 글 채우기
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readDraft, resetDraftsForTest, wipeDrafts, writeDraft } from '../../data/drafts';
import { useSession } from '../../data/session';
import { showToast } from '../../app/toast';
import { extractImageFiles, uploadAttachments } from '../notes/attach';
import ChatComposer, { type ChatComposerHandle } from './ChatComposer';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../notes/attach', () => ({ uploadAttachments: vi.fn(async () => []), extractImageFiles: vi.fn(() => []), pastedTable: () => false }));
vi.mock('../../app/toast', async (orig) => ({ ...(await orig<typeof import('../../app/toast')>()), showToast: vi.fn() }));

const UID = 'me';
const KEY = 'g_G~all';
const input = () => document.querySelector<HTMLTextAreaElement>('[data-chat-input]')!;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const enter = (init: Partial<KeyboardEventInit> & { keyCode?: number } = {}) => fireEvent.keyDown(input(), { key: 'Enter', ...init });
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });

let coarse = false;
beforeEach(async () => {
  resetDraftsForTest();
  await wipeDrafts(UID);
  coarse = false;
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') && coarse, media: q, addEventListener() {}, removeEventListener() {} }));
  useSession.setState({ loading: false, user: { uid: UID, email: '', displayName: '', photoURL: '' } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
afterAll(async () => {
  await wipeDrafts(UID);
});

describe('대화 글 칸', () => {
  it('방에 놓은 파일 = 📎와 같이 올린다 - 올리는 동안 또 놓으면 올리지 않는다', async () => {
    let finish: (added: []) => void = () => {};
    vi.mocked(uploadAttachments).mockClear();
    vi.mocked(uploadAttachments).mockImplementationOnce(() => new Promise((r) => (finish = r)));
    const ref = createRef<ChatComposerHandle>();
    render(<ChatComposer ref={ref} roomKey={KEY} onSend={vi.fn(async () => true)} />);
    const file = new File(['a'], 'a.txt');
    act(() => ref.current!.attach([file]));
    expect(document.querySelector('[data-chat-uploading="files"]')).not.toBeNull();
    act(() => ref.current!.attach([file]));
    expect(uploadAttachments).toHaveBeenCalledTimes(1);
    expect(uploadAttachments).toHaveBeenCalledWith([file], false);
    await act(async () => finish([]));
    expect(document.querySelector('[data-chat-uploading]')).toBeNull();
  });

  it('Enter = 보내기(칸을 곧바로 비운다) · Shift+Enter·빈 글은 보내지 않는다', async () => {
    const onSend = vi.fn(async () => true);
    render(<ChatComposer roomKey={KEY} onSend={onSend} />);
    enter();
    expect(onSend).not.toHaveBeenCalled();
    type('첫 줄');
    enter({ shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    type('첫 줄\n둘째 줄');
    enter();
    expect(onSend).toHaveBeenCalledWith('첫 줄\n둘째 줄', []);
    expect(input().value).toBe('');
    await settle();
  });

  it('한글을 짜는 중의 Enter는 보내지 않는다', async () => {
    const onSend = vi.fn(async () => true);
    render(<ChatComposer roomKey={KEY} onSend={onSend} />);
    type('안녕');
    enter({ isComposing: true });
    enter({ keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
    enter();
    expect(onSend).toHaveBeenCalledTimes(1);
    await settle();
  });

  it('휴대폰 화면 자판의 Enter = 줄 바꿈, Ctrl+Enter·➤ = 보내기', async () => {
    coarse = true;
    const onSend = vi.fn(async () => true);
    render(<ChatComposer roomKey={KEY} onSend={onSend} />);
    type('글');
    enter();
    expect(onSend).not.toHaveBeenCalled();
    enter({ ctrlKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
    type('또');
    fireEvent.click(document.querySelector('[data-chat-send]')!);
    expect(onSend).toHaveBeenCalledTimes(2);
    await settle();
  });

  it('보내지 못하면 글을 칸에 되돌린다', async () => {
    const onSend = vi.fn(async () => false);
    render(<ChatComposer roomKey={KEY} onSend={onSend} />);
    type('못 간 글');
    enter();
    await waitFor(() => expect(input().value).toBe('못 간 글'));
  });

  it('쓰던 글이 남아 있으면 묻지 않고 칸에 채운다 · 손으로 다 지우면 보관도 지운다', async () => {
    await writeDraft(UID, `chat:${KEY}`, { text: '쓰던 글', attachments: [] });
    render(<ChatComposer roomKey={KEY} onSend={vi.fn(async () => true)} />);
    await waitFor(() => expect(input().value).toBe('쓰던 글'));
    type('');
    await waitFor(async () => expect(await readDraft(UID, `chat:${KEY}`)).toBeNull());
  });
});

describe('메모 요청 글 칸 (P23 - 같은 칸에 몇 가지만 다르다)', () => {
  const paste = () => fireEvent.paste(input(), { clipboardData: {} });

  it('hold = 쓰기는 되고 보내기만 막는다 - Enter는 까닭만 알리고 글은 칸에 남는다', async () => {
    const onSend = vi.fn(async () => true);
    const { rerender } = render(<ChatComposer roomKey={KEY} onSend={onSend} hold="앞 요청이 끝나면 보낼 수 있습니다" />);
    expect(input().disabled).toBe(false);
    type('다음에 보낼 글');
    enter();
    expect(onSend).not.toHaveBeenCalled();
    expect(input().value).toBe('다음에 보낼 글');
    expect(document.querySelector<HTMLButtonElement>('[data-chat-send]')!.disabled).toBe(true);
    expect(showToast).toHaveBeenCalledWith('앞 요청이 끝나면 보낼 수 있습니다');
    expect(document.querySelector('[data-chat-hold]')?.textContent).toContain('앞 요청이 끝나면');
    rerender(<ChatComposer roomKey={KEY} onSend={onSend} />);
    expect(document.querySelector('[data-chat-hold]')).toBeNull();
    enter();
    expect(onSend).toHaveBeenCalledTimes(1);
    await settle();
  });

  it('noAttach = 📎가 없고 캡처를 올리지 않는다 (공개 이슈로 올라간다)', () => {
    vi.mocked(uploadAttachments).mockClear();
    vi.mocked(extractImageFiles).mockReturnValueOnce([new File(['a'], 'a.png')]);
    render(<ChatComposer roomKey={KEY} onSend={vi.fn(async () => true)} noAttach />);
    expect(document.querySelector('[data-chat-attach]')).toBeNull();
    paste();
    expect(uploadAttachments).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('그림'), 4000);
  });

  it('maxText = 그 길이로 막고 세어 보인다', () => {
    const onSend = vi.fn(async () => true);
    render(<ChatComposer roomKey={KEY} onSend={onSend} maxText={300} />);
    type('가'.repeat(301));
    enter();
    expect(onSend).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('300자'), 4000);
    expect(document.querySelector('[data-chat-count]')?.textContent).toContain('301 / 300자');
  });

  it('draftKey = 그 열쇠로 남기고 찾는다', async () => {
    await writeDraft(UID, 'claude:item1', { text: '쓰던 요청', attachments: [] });
    render(<ChatComposer roomKey={KEY} draftKey="claude:item1" onSend={vi.fn(async () => true)} />);
    await waitFor(() => expect(input().value).toBe('쓰던 요청'));
  });

  it('fill = 글 칸에 넣는다 - 쓰던 글이 있으면 뒤에 잇는다', () => {
    const ref = createRef<ChatComposerHandle>();
    render(<ChatComposer ref={ref} roomKey={KEY} onSend={vi.fn(async () => true)} />);
    act(() => ref.current!.fill('다시 보낼 글'));
    expect(input().value).toBe('다시 보낼 글');
    expect(document.activeElement).toBe(input());
    act(() => ref.current!.fill('또'));
    expect(input().value).toBe('다시 보낼 글\n또');
  });

  it('label = 칸 안내의 앞말 · hint = 칸 아래 안내', () => {
    render(<ChatComposer roomKey={KEY} onSend={vi.fn(async () => true)} label="이어서 요청" hint="공개 이슈로 올라갑니다" />);
    expect(input().placeholder).toContain('이어서 요청 (Enter');
    expect(document.querySelector('[data-chat-hint]')?.textContent).toBe('공개 이슈로 올라갑니다');
  });
});

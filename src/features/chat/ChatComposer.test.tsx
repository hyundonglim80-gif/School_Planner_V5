// 💬 대화 글 칸 (P19-2 ■2) - Enter 보내기 · Shift+Enter 줄 바꿈 · 한글 짜는 중 Enter · 휴대폰 자판 Enter · 보내지 못하면 글 그대로 · 쓰던 글 채우기
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readDraft, resetDraftsForTest, wipeDrafts, writeDraft } from '../../data/drafts';
import { useSession } from '../../data/session';
import ChatComposer from './ChatComposer';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../notes/attach', () => ({ uploadAttachments: vi.fn(async () => []), extractImageFiles: () => [], pastedTable: () => false }));

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

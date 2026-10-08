// 쓰던 글 보관 - 적기·읽기·지우기·로그아웃 지우기, 훅: 손댄 동안 2초 뒤 적기·다시 열면 묻기·같으면 묻지 않고 지우기·저장하면 지우기·열쇠가 바뀌면 옮기기
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { deleteDraft, DRAFT_DELAY_MS, readDraft, resetDraftsForTest, useDraft, wipeDrafts, writeDraft } from './drafts';
import { useSession } from './session';

vi.mock('./firebase', () => ({ auth: {}, db: {} }));

const UID = 'me';

beforeEach(async () => {
  resetDraftsForTest();
  await wipeDrafts(UID);
  useSession.setState({ loading: false, user: { uid: UID, email: '', displayName: '', photoURL: '' } });
});
afterEach(() => vi.useRealTimers());

describe('보관 저장소', () => {
  it('적고 읽고 지운다, 로그아웃(wipe)하면 모두 없다', async () => {
    await writeDraft(UID, 'note:a', { text: '글' }, 5);
    expect(await readDraft(UID, 'note:a')).toEqual({ value: { text: '글' }, savedAt: 5 });
    await deleteDraft(UID, 'note:a');
    expect(await readDraft(UID, 'note:a')).toBeNull();
    await writeDraft(UID, 'note:b', { text: '또' });
    await wipeDrafts(UID);
    expect(await readDraft(UID, 'note:b')).toBeNull();
  });

  it('계정마다 따로', async () => {
    await writeDraft(UID, 'k', 1);
    expect(await readDraft('other', 'k')).toBeNull();
  });
});

describe('useDraft', () => {
  const later = async () => {
    await act(async () => {
      vi.advanceTimersByTime(DRAFT_DELAY_MS + 10);
    });
    vi.useRealTimers();
  };

  it('손댄 동안만 2초 뒤 적는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { rerender } = renderHook(({ v, touched }) => useDraft('note:x', v, touched), { initialProps: { v: { text: '' }, touched: false } });
    await act(async () => {
      vi.advanceTimersByTime(DRAFT_DELAY_MS + 10);
    });
    expect(await readDraft(UID, 'note:x')).toBeNull();
    rerender({ v: { text: '적는 중' }, touched: true });
    await act(async () => {
      vi.advanceTimersByTime(DRAFT_DELAY_MS - 100);
    });
    expect(await readDraft(UID, 'note:x')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    // IndexedDB 적기가 끝나기를 기다린다 (fake-indexeddb는 setImmediate로 돈다 - 가짜 시계 밖)
    let got: unknown = null;
    for (let i = 0; i < 20 && !got; i++) {
      await new Promise((r) => setImmediate(r));
      got = (await readDraft<{ text: string }>(UID, 'note:x'))?.value ?? null;
    }
    expect(got).toEqual({ text: '적는 중' });
  });

  it('다시 열면 남은 글을 묻고(지금과 다를 때), 되살리기 = 그 글, 버리기 = 지운다', async () => {
    await writeDraft(UID, 'note:y', { text: '남은 글' }, 1);
    const { result } = renderHook(() => useDraft('note:y', { text: '' }, false));
    await waitFor(() => expect(result.current.offer?.value).toEqual({ text: '남은 글' }));
    let taken: unknown;
    act(() => {
      taken = result.current.take();
    });
    expect(taken).toEqual({ text: '남은 글' });
    expect(result.current.offer).toBeNull();
    // 되살린 것은 보관에 남는다 (저장하면 지운다)
    expect(await readDraft(UID, 'note:y')).not.toBeNull();

    const second = renderHook(() => useDraft('note:y', { text: '' }, false));
    await waitFor(() => expect(second.result.current.offer).not.toBeNull());
    act(() => second.result.current.discard());
    await waitFor(async () => expect(await readDraft(UID, 'note:y')).toBeNull());
  });

  it('남은 글이 지금 칸과 같으면(이미 저장된 것) 묻지 않고 지운다', async () => {
    await writeDraft(UID, 'note:z', { text: '같은 글' });
    const { result } = renderHook(() => useDraft('note:z', { text: '같은 글' }, false));
    await waitFor(async () => expect(await readDraft(UID, 'note:z')).toBeNull());
    expect(result.current.offer).toBeNull();
  });

  it('저장하면(clear) 기다리던 것을 거두고 지운다, 열쇠가 바뀌면 앞 열쇠의 보관을 옮긴다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result, rerender } = renderHook(({ k, v }) => useDraft(k, v, true), { initialProps: { k: 'note:new:a', v: { text: '1' } } });
    await later();
    await waitFor(async () => expect(await readDraft(UID, 'note:new:a')).not.toBeNull());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    rerender({ k: 'note:new:b', v: { text: '2' } });
    await later();
    await waitFor(async () => expect(await readDraft(UID, 'note:new:b')).not.toBeNull());
    expect(await readDraft(UID, 'note:new:a')).toBeNull();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    rerender({ k: 'note:new:b', v: { text: '3' } });
    act(() => result.current.clear());
    await later();
    await waitFor(async () => expect(await readDraft(UID, 'note:new:b')).toBeNull());
  });

  it('칸이 닫히면 기다리던 것을 곧바로 적는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { rerender, unmount } = renderHook(({ v }) => useDraft('note:close', v, true), { initialProps: { v: { text: 'a' } } });
    rerender({ v: { text: '닫기 직전' } });
    vi.useRealTimers();
    unmount();
    await waitFor(async () => expect((await readDraft<{ text: string }>(UID, 'note:close'))?.value).toEqual({ text: '닫기 직전' }));
  });
});

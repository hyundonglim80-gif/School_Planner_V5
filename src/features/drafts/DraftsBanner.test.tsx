// 앱을 열 때 '📝 저장하지 않은 글 n개 - 보기' (P14-6 ■1b)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { deleteDraft, resetDraftsForTest, wipeDrafts, writeDraft } from '../../data/drafts';
import { useSession } from '../../data/session';
import DraftsBanner from './DraftsBanner';
import { openDraftsWindow } from './open';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
vi.mock('./open', () => ({ openDraftsWindow: vi.fn() }));

const UID = 'me';
const banner = () => document.querySelector('[data-drafts-banner]');
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

beforeEach(async () => {
  resetDraftsForTest();
  await wipeDrafts(UID);
  localStorage.clear();
  vi.mocked(openDraftsWindow).mockClear();
  useSession.setState({ loading: false, user: { uid: UID, email: '', displayName: '', photoURL: '' } });
});
afterEach(async () => {
  cleanup();
  await wipeDrafts(UID);
});

describe('앱을 열 때 남은 쓰던 글 띠', () => {
  it('남은 것이 없으면 띠가 없다', async () => {
    render(<DraftsBanner />);
    await settle();
    expect(banner()).toBeNull();
  });

  it('연 때 남은 글만 센다 - 되살려 저장하면(지우면) 줄고, 지금 쓰는 칸의 새 글은 세지 않는다', async () => {
    await writeDraft(UID, 'note:u_me:new:2026-10-30', { text: '오프라인 시험 1' }, 100);
    await writeDraft(UID, 'event:u_me:new:2026-10-30', { text: '일정', date: '2026-10-30' }, 200);
    render(<DraftsBanner />);
    await waitFor(() => expect(banner()?.getAttribute('data-drafts-banner')).toBe('2'));
    expect(banner()?.textContent).toContain('저장하지 않은 글 2개');
    await act(async () => {
      await writeDraft(UID, 'note:u_me:new:memo', { text: '지금 쓰는 칸' }, 300);
    });
    await settle();
    expect(banner()?.getAttribute('data-drafts-banner')).toBe('2');
    await act(async () => {
      await deleteDraft(UID, 'note:u_me:new:2026-10-30');
    });
    await waitFor(() => expect(banner()?.getAttribute('data-drafts-banner')).toBe('1'));
    await act(async () => {
      await deleteDraft(UID, 'event:u_me:new:2026-10-30');
    });
    await waitFor(() => expect(banner()).toBeNull());
  });

  it('보기 = 창을 연다 · 나중에 = 그때까지 남은 것은 다시 알리지 않고, 새로 남은 글이 생기면 다음에 연 때 다시', async () => {
    await writeDraft(UID, 'note:u_me:a', { text: '남은 글' }, 100);
    const first = render(<DraftsBanner />);
    await waitFor(() => expect(banner()).not.toBeNull());
    fireEvent.click(document.querySelector('[data-drafts-banner-open]')!);
    expect(openDraftsWindow).toHaveBeenCalledTimes(1);
    expect(banner()).toBeNull();
    first.unmount();

    // 다시 열기 - 같은 글뿐이면 알리지 않는다
    const second = render(<DraftsBanner />);
    await settle();
    expect(banner()).toBeNull();
    second.unmount();

    // 새로 남은 글 → 다시 (센 수는 남은 것 모두)
    await writeDraft(UID, 'note:u_me:new:memo', { text: '새로 남음' }, 500);
    render(<DraftsBanner />);
    await waitFor(() => expect(banner()?.getAttribute('data-drafts-banner')).toBe('2'));
    fireEvent.click(document.querySelector('[data-drafts-banner-later]')!);
    expect(banner()).toBeNull();
    expect(openDraftsWindow).toHaveBeenCalledTimes(1);
  });
});

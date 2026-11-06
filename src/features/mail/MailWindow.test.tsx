// ✉ 쪽지 목록 (P22-5 ■2) - '더 보기'를 받는 동안 새 쪽지가 와도 둘 다 들어오고 '불러오는 중'에 멈추지 않는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { loadInbox } from '../../data/mail';
import { useMailStore } from '../../data/mailStore';
import { useSession } from '../../data/session';
import type { MailIn } from '../../domain/mail';
import { MailList } from './MailWindow';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../../data/mail', async (orig) => ({ ...(await orig<typeof import('../../data/mail')>()), loadInbox: vi.fn(), loadSent: vi.fn(), markRead: vi.fn() }));

const mail = (id: string): MailIn => ({ id, from: 'b', fromName: '이점검', sid: 'G', groupName: '협의회', to: ['me'], toNames: '', text: id, at: 1000, readAt: null, replyTo: null, attachments: [] });
const page = (ids: string[], cursor: unknown = null) => ({ items: ids.map(mail), cursor: cursor as QueryDocumentSnapshot | null, offline: false });
const row = (id: string) => document.querySelector(`[data-mail-row="${id}"]`);
const more = () => document.querySelector<HTMLButtonElement>('[data-mail-more="in"]');

beforeEach(() => {
  vi.mocked(loadInbox).mockReset();
  useMailStore.setState({ unread: 0 });
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});
afterEach(cleanup);

describe('쪽지 목록', () => {
  it("'더 보기'를 받는 동안 새 쪽지가 오면 - 지난 쪽지도 새 쪽지도 들어오고 단추가 풀린다", async () => {
    vi.mocked(loadInbox).mockResolvedValueOnce(page(['m1'], 'cursor1'));
    render(<MailList box="in" active />);
    await waitFor(() => expect(row('m1')).not.toBeNull());

    let finishMore: (p: ReturnType<typeof page>) => void = () => {};
    vi.mocked(loadInbox).mockImplementationOnce(() => new Promise((r) => (finishMore = r)));
    fireEvent.click(more()!);
    expect(more()!.disabled).toBe(true);

    vi.mocked(loadInbox).mockResolvedValueOnce(page(['new', 'm1'], 'cursor1'));
    act(() => useMailStore.setState({ unread: 1 }));
    await waitFor(() => expect(row('new')).not.toBeNull());

    await act(async () => finishMore(page(['m0'], 'cursor0')));
    await waitFor(() => expect(row('m0')).not.toBeNull());
    expect(row('new')).not.toBeNull();
    expect(more()!.disabled).toBe(false);
  });
});

// 로그아웃 전에 묻기 (P22-2) - 저장 안 한 칸·서버 대기 쓰기·쓰던 글 보관은 로그아웃하면 이 기기에서 사라진다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anyWindowUnsaved } from '../../app/windows';
import { listDrafts } from '../../data/drafts';
import { beginPendingWrite, resetPendingWritesForTest } from '../../data/pendingWrites';
import { useSession } from '../../data/session';
import { askLogout, logoutLosses } from './askLogout';
import { logout } from './login';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock('./login', () => ({ logout: vi.fn() }));
vi.mock('../../app/windows', () => ({ anyWindowUnsaved: vi.fn(() => false) }));
vi.mock('../../data/drafts', () => ({ listDrafts: vi.fn(async () => []) }));

const drafts = (n: number) => vi.mocked(listDrafts).mockResolvedValue(Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: '', savedAt: 0 })));

beforeEach(() => {
  resetPendingWritesForTest();
  vi.mocked(logout).mockReset();
  vi.mocked(anyWindowUnsaved).mockReturnValue(false);
  drafts(0);
  useSession.setState({ loading: false, user: { uid: 'me', email: 'me@x', displayName: '', photoURL: '' } });
});
afterEach(() => vi.restoreAllMocks());

describe('사라지는 것', () => {
  it('없으면 빈 목록', () => {
    expect(logoutLosses({ unsaved: false, pending: 0, drafts: 0 })).toEqual([]);
  });

  it('있는 것만 수와 함께 적는다', () => {
    expect(logoutLosses({ unsaved: true, pending: 2, drafts: 3 })).toEqual(['저장하지 않은 칸', '서버에 아직 올라가지 않은 저장 2개', '쓰던 글 보관 3개']);
    expect(logoutLosses({ unsaved: false, pending: 0, drafts: 1 })).toEqual(['쓰던 글 보관 1개']);
  });
});

describe('로그아웃 단추', () => {
  it('사라질 것이 없으면 묻지 않고 로그아웃', async () => {
    const ask = vi.spyOn(window, 'confirm');
    await askLogout();
    expect(ask).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("저장 안 한 칸이 있으면 묻고, '아니오'면 로그아웃하지 않는다", async () => {
    vi.mocked(anyWindowUnsaved).mockReturnValue(true);
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await askLogout();
    expect(ask.mock.calls[0][0]).toContain('저장하지 않은 칸');
    expect(logout).not.toHaveBeenCalled();
  });

  it('서버 대기 쓰기·쓰던 글 보관도 묻고, 예면 로그아웃', async () => {
    const done = beginPendingWrite();
    drafts(2);
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await askLogout();
    expect(ask.mock.calls[0][0]).toContain('서버에 아직 올라가지 않은 저장 1개');
    expect(ask.mock.calls[0][0]).toContain('쓰던 글 보관 2개');
    expect(logout).toHaveBeenCalledTimes(1);
    done();
  });

  it('보관을 읽지 못해도 로그아웃을 막지 않는다', async () => {
    vi.mocked(listDrafts).mockRejectedValue(new Error('IndexedDB 고장'));
    await askLogout();
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

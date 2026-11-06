import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWindows } from '../../app/windows';
import { keepGoogleToken, GOOGLE_TOKEN_KEY } from '../../data/google/token';
import { useSession } from '../../data/session';
import { useRosterDraft } from '../class/rosterDraft';
import { watchAccountChange } from './accountChange';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {}, GOOGLE_SCOPES: [] }));

const user = (uid: string, displayName = '') => ({ uid, email: `${uid}@example.com`, displayName, photoURL: '' });
const plant = () => {
  keepGoogleToken('tok');
  useRosterDraft.setState({ drafts: [{ year: 2026, grade: 5, num: 2, students: [] }], index: 1 });
  useWindows.setState({ windows: [{ key: 1, id: 'seating', params: undefined, openedAt: 1, raisedAt: 1 }] });
};
const planted = () => ({
  token: sessionStorage.getItem(GOOGLE_TOKEN_KEY),
  drafts: useRosterDraft.getState().drafts?.length ?? 0,
  index: useRosterDraft.getState().index,
  windows: useWindows.getState().windows.length,
});
const EMPTY = { token: null, drafts: 0, index: 0, windows: 0 };
const KEPT = { token: 'tok', drafts: 1, index: 1, windows: 1 };

describe('로그인한 사람이 바뀌면 앞 사람 것을 이 탭에서 비운다 (P22-4 - 공용 PC)', () => {
  let stop: () => void;
  beforeEach(() => {
    useSession.setState({ loading: false, user: user('a') });
    stop = watchAccountChange();
    plant();
  });
  afterEach(() => {
    stop();
    useSession.setState({ loading: true, user: null });
    sessionStorage.clear();
  });

  it('로그아웃 - 다른 탭에서 나갔어도 이 탭의 구글 토큰·명렬표 임시본·창 목록이 비워진다', () => {
    useSession.setState({ user: null });
    expect(planted()).toEqual(EMPTY);
  });

  it('곧바로 다른 계정이 되어도', () => {
    useSession.setState({ user: user('b') });
    expect(planted()).toEqual(EMPTY);
  });

  it('같은 사람이면 그대로 (이름만 바뀜)', () => {
    useSession.setState({ user: user('a', '새 이름') });
    expect(planted()).toEqual(KEPT);
  });

  it('없던 사람이 들어올 때는 건드리지 않는다 - 막 받은 토큰을 지우면 안 된다', () => {
    useSession.setState({ user: null });
    plant();
    useSession.setState({ user: user('b') });
    expect(planted()).toEqual(KEPT);
  });
});

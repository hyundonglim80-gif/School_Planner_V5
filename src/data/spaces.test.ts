// 내 그룹 목록 구독 - 끊긴 채 시작해도 기억한 그룹이 남는다 (P22-3)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ next: null as ((snap: unknown) => void) | null, options: null as unknown }));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./repo', () => ({ batch: vi.fn() }));
vi.mock('./labels', () => ({ defaultLabelOps: () => [] }));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  onSnapshot: (_q: unknown, options: unknown, next: (snap: unknown) => void) => {
    fs.options = options;
    fs.next = next;
    return () => {};
  },
}));

import { watchMySpaces } from './spaces';
import { chooseSpace, knownGroupsOf, rememberGroups, setSpaceChoice, useMySpaces, useSpaceChoice } from './spaceChoice';

const snap = (fromCache: boolean, ...groups: { id: string; name: string }[]) => ({
  metadata: { fromCache },
  docs: groups.map((g) => ({ id: g.id, data: () => ({ kind: 'group', name: g.name, ownerId: 'me', members: { me: 'owner' } }) })),
});

describe('watchMySpaces', () => {
  beforeEach(() => {
    setSpaceChoice('me', 'g_a');
    rememberGroups('me', [{ id: 'g_a', name: '학년 모임' }]);
  });
  afterEach(() => {
    useSpaceChoice.setState({ uid: null, sid: null, known: [], names: {} });
    useMySpaces.setState({ groups: [], loaded: false, offline: false });
  });

  it('서버 답이 오기 전에는 기억한 그룹을 이름째 보인다 (구성원은 모른다, loaded는 아니다)', () => {
    watchMySpaces('me');
    expect(useMySpaces.getState()).toMatchObject({ loaded: false, groups: [{ id: 'g_a', name: '학년 모임', members: {} }] });
  });

  it('끊긴 때 온 빈 결과는 믿지 않는다 - 목록·기억·고른 공간이 그대로이고 끊겼다고만 적는다', () => {
    watchMySpaces('me');
    fs.next?.(snap(true));
    expect(useMySpaces.getState()).toMatchObject({ loaded: false, offline: true, groups: [{ id: 'g_a' }] });
    expect(knownGroupsOf('me')).toEqual(['g_a']);
    expect(chooseSpace('me', useSpaceChoice.getState(), useMySpaces.getState())).toBe('g_a');
  });

  it("'서버가 확인함'만 바뀌는 소식도 받아 끊김을 푼다", () => {
    watchMySpaces('me');
    expect(fs.options).toEqual({ includeMetadataChanges: true });
    fs.next?.(snap(true));
    fs.next?.(snap(false, { id: 'g_a', name: '학년 모임' }));
    expect(useMySpaces.getState()).toMatchObject({ loaded: true, offline: false, groups: [{ id: 'g_a', ownerId: 'me', members: { me: 'owner' } }] });
  });

  it('서버가 그룹 없음을 확인하면 그제야 비우고 개인 공간으로', () => {
    watchMySpaces('me');
    fs.next?.(snap(false));
    expect(useMySpaces.getState()).toMatchObject({ loaded: true, groups: [] });
    expect(knownGroupsOf('me')).toEqual([]);
    expect(chooseSpace('me', useSpaceChoice.getState(), useMySpaces.getState())).toBe('u_me');
  });

  it('받은 뒤에 끊겨도 받은 목록을 둔다', () => {
    watchMySpaces('me');
    fs.next?.(snap(false, { id: 'g_a', name: '새 이름' }));
    fs.next?.(snap(true));
    expect(useMySpaces.getState()).toMatchObject({ loaded: true, offline: false, groups: [{ id: 'g_a', name: '새 이름' }] });
    expect(useSpaceChoice.getState().names).toEqual({ g_a: '새 이름' });
  });
});

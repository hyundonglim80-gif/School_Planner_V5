import { afterEach, describe, expect, it } from 'vitest';
import { chooseSpace, cleanInviteCode, inviteCodeOf, knownGroupsOf, rememberGroups, setSpaceChoice, useSpaceChoice } from './spaceChoice';

const g = (id: string) => ({ id, name: id, ownerId: 'o', members: {} });

describe('지금 공간 고르기 (P8-4)', () => {
  afterEach(() => useSpaceChoice.setState({ uid: null, sid: null, known: [] }));

  it('고른 그룹이 내 목록에 있으면 그 그룹, 없거나 다른 계정 것이면 개인', () => {
    const mine = { groups: [g('g_a')], loaded: true };
    expect(chooseSpace('u1', { uid: 'u1', sid: 'g_a' }, mine)).toBe('g_a');
    expect(chooseSpace('u1', { uid: 'u1', sid: 'g_b' }, mine)).toBe('u_u1');
    expect(chooseSpace('u1', { uid: 'u2', sid: 'g_a' }, mine)).toBe('u_u1');
    expect(chooseSpace('u1', { uid: 'u1', sid: null }, mine)).toBe('u_u1');
  });
  it('목록을 받기 전에는 고른 것을 믿는다 (새로고침 때 개인으로 번쩍이지 않게)', () => {
    expect(chooseSpace('u1', { uid: 'u1', sid: 'g_b' }, { groups: [], loaded: false })).toBe('g_b');
  });
  it('받은 그룹을 기억하고, 다른 계정이면 고른 것을 비운다', () => {
    setSpaceChoice('u1', 'g_a');
    rememberGroups('u1', ['g_a', 'g_b']);
    expect(knownGroupsOf('u1')).toEqual(['g_a', 'g_b']);
    expect(useSpaceChoice.getState().sid).toBe('g_a');
    rememberGroups('u2', ['g_c']);
    expect(useSpaceChoice.getState()).toMatchObject({ uid: 'u2', sid: null, known: ['g_c'] });
    expect(knownGroupsOf('u1')).toEqual([]);
    setSpaceChoice('u2', 'u_u2');
    expect(useSpaceChoice.getState().sid).toBeNull();
  });
  it('초대 코드 = 헷갈리는 글자 없는 6자리 · 넣은 코드는 띄어쓰기를 빼고 대문자로', () => {
    let i = 0;
    const code = inviteCodeOf(() => (i++ % 10) / 10);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(cleanInviteCode(' ab c12 ')).toBe('ABC12');
  });
});

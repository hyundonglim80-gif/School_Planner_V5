import { afterEach, describe, expect, it } from 'vitest';
import {
  chooseSpace,
  cleanInviteCode,
  clearOverlay,
  inviteCodeOf,
  isInviteCode,
  knownGroupsOf,
  overlaySpaces,
  rememberGroups,
  setSpaceChoice,
  toggleOverlay,
  useSpaceChoice,
  useSpaceOverlay,
} from './spaceChoice';

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
  it('초대 코드 = 헷갈리는 글자 없는 8자리 · 넣은 코드는 띄어쓰기를 빼고 대문자로', () => {
    expect(inviteCodeOf()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(new Set(Array.from({ length: 50 }, () => inviteCodeOf())).size).toBe(50);
    expect(inviteCodeOf(new Uint8Array([0, 31, 32, 255]))).toBe('A9A9');
    expect(cleanInviteCode(' ab c12 ')).toBe('ABC12');
  });

  it('초대 코드 모양 - 옛 6자리·V4 코드는 받고, 붙여 넣은 주소는 받지 않는다', () => {
    expect(isInviteCode('ABC123')).toBe(true);
    expect(isInviteCode('V4GEMU12')).toBe(true);
    expect(isInviteCode('ABC')).toBe(false);
    expect(isInviteCode('HTTPS://SCHO')).toBe(false);
    expect(isInviteCode('A/B123')).toBe(false);
  });
});

describe('겹쳐 보는 공간 (P17-2)', () => {
  afterEach(() => {
    useSpaceChoice.setState({ uid: null, sid: null, known: [] });
    useSpaceOverlay.setState({ uid: null, sids: [] });
  });
  const mine = { groups: [g('g_a'), g('g_b')], loaded: true };

  it('주 공간·나간 그룹·다른 계정 것은 빼고, 칩 차례(개인 → 그룹 목록 차례)로', () => {
    const o = { uid: 'u1', sids: ['g_b', 'g_gone', 'u_u1', 'g_a', 'g_b'] };
    expect(overlaySpaces('u1', o, mine, 'g_a')).toEqual(['u_u1', 'g_b']);
    expect(overlaySpaces('u1', o, mine, 'u_u1')).toEqual(['g_a', 'g_b']);
    expect(overlaySpaces('u2', o, mine, 'u_u2')).toEqual([]);
  });
  it('목록을 받기 전에는 적어 둔 그룹을 믿는다 (모르는 그룹은 뒤로)', () => {
    const o = { uid: 'u1', sids: ['g_x', 'g_b'] };
    expect(overlaySpaces('u1', o, { groups: [g('g_b')], loaded: false }, 'u_u1')).toEqual(['g_b', 'g_x']);
  });
  it('더하기·빼기 · 다른 계정이었으면 새로 · 모두 끄기', () => {
    toggleOverlay('u1', 'g_a');
    toggleOverlay('u1', 'g_b');
    expect(useSpaceOverlay.getState()).toMatchObject({ uid: 'u1', sids: ['g_a', 'g_b'] });
    toggleOverlay('u1', 'g_a');
    expect(useSpaceOverlay.getState().sids).toEqual(['g_b']);
    toggleOverlay('u2', 'g_c');
    expect(useSpaceOverlay.getState()).toMatchObject({ uid: 'u2', sids: ['g_c'] });
    clearOverlay('u2');
    expect(useSpaceOverlay.getState().sids).toEqual([]);
  });
  it('주 공간으로 고르면 겹친 것에서 빠진다 (📂로 골라도)', () => {
    toggleOverlay('u1', 'g_a');
    toggleOverlay('u1', 'u_u1');
    setSpaceChoice('u1', 'g_a');
    expect(useSpaceOverlay.getState().sids).toEqual(['u_u1']);
    setSpaceChoice('u1', null);
    expect(useSpaceOverlay.getState().sids).toEqual([]);
  });
});

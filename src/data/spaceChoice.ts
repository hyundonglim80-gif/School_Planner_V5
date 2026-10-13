// 내 공간 목록과 지금 공간 고르기 (P8-4 - DESIGN 4-1). Firebase를 끌어오지 않는 store만 - session·기기 사본·화면이 함께 본다.
// 목록 구독·만들기·참여·나가기는 data/spaces.ts.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SpaceRole = 'owner' | 'member';

export interface GroupSpace {
  id: string;
  name: string;
  ownerId: string;
  members: Record<string, SpaceRole>;
  /** 있으면 초대가 열려 있다 */
  inviteCode?: string;
}

/** 내가 든 그룹 공간 (서버 구독 - 받기 전에는 loaded false) */
export const useMySpaces = create<{ groups: GroupSpace[]; loaded: boolean }>(() => ({ groups: [], loaded: false }));

/** 이 기기에서 고른 공간 (계정마다) - 계정에 올리지 않는다(기기마다 보는 공간이 다를 수 있다, V4도 이 기기) */
interface SpaceChoice {
  uid: string | null;
  sid: string | null;
  /** 지난번에 받은 내 그룹 id - 기기 사본이 목록을 받기 전에(오프라인에도) 그룹 공간을 곧바로 펼친다 */
  known?: string[];
}
export const useSpaceChoice = create<SpaceChoice>()(persist((): SpaceChoice => ({ uid: null, sid: null }), { name: 'sp5-space' }));

/** 지난번에 받은 내 그룹 (이 계정 것만) */
export const knownGroupsOf = (uid: string): string[] => {
  const c = useSpaceChoice.getState();
  return c.uid === uid ? (c.known ?? []) : [];
};

/**
 * 지금 공간: 고른 그룹이 내 목록에 있으면 그 그룹, 아니면 개인 공간.
 * 목록을 받기 전에는 고른 것을 믿는다(새로고침 때 잠깐 개인 공간으로 그렸다가 바뀌지 않게) - 받아 보고 없으면 개인으로.
 */
export function chooseSpace(uid: string, choice: SpaceChoice, mine: { groups: GroupSpace[]; loaded: boolean }): string {
  const personal = `u_${uid}`;
  const sid = choice.uid === uid ? choice.sid : null;
  if (!sid || !sid.startsWith('g_')) return personal;
  if (!mine.loaded) return sid;
  return mine.groups.some((g) => g.id === sid) ? sid : personal;
}

export function setSpaceChoice(uid: string, sid: string | null) {
  const c = useSpaceChoice.getState();
  useSpaceChoice.setState({ uid, sid: sid && sid.startsWith('g_') ? sid : null, known: c.uid === uid ? c.known : [] });
}

/** 받은 그룹 목록을 기억한다 (다른 계정이었으면 고른 것도 비운다) */
export function rememberGroups(uid: string, ids: string[]) {
  const c = useSpaceChoice.getState();
  useSpaceChoice.setState(c.uid === uid ? { known: ids } : { uid, sid: null, known: ids });
}

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 6자리 초대 코드 (헷갈리는 0·O·1·I는 뺀다 - V4 그대로) */
export function inviteCodeOf(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += INVITE_CHARS.charAt(Math.floor(rand() * INVITE_CHARS.length));
  return code;
}

export const cleanInviteCode = (s: string) => s.replace(/\s+/g, '').toUpperCase();

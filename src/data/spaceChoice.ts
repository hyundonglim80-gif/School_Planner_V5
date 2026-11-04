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
  // 주 공간이 된 공간은 겹쳐 보기에서 빠진다 (메모·학급 화면 📂로 골라도)
  const o = useSpaceOverlay.getState();
  const main = sid && sid.startsWith('g_') ? sid : `u_${uid}`;
  if (o.uid === uid && o.sids.includes(main)) useSpaceOverlay.setState({ sids: o.sids.filter((s) => s !== main) });
}

/**
 * 겹쳐 보는 공간 (P17-2 - 둘째 줄 공간 칩 Ctrl·길게 누르기). 일정만, 하루·주간·월간·년간에 주 공간 것 뒤에 그린다.
 * 이 기기에, 계정마다(고른 공간 sp5-space와 같다 - 기기마다 보는 공간이 다를 수 있다). 개인 공간은 `u_…` 그대로 적는다.
 */
interface SpaceOverlay {
  uid: string | null;
  sids: string[];
}
export const useSpaceOverlay = create<SpaceOverlay>()(persist((): SpaceOverlay => ({ uid: null, sids: [] }), { name: 'sp5-space-overlay' }));

/**
 * 지금 겹쳐 보는 공간 - 주 공간·나간(지운) 그룹·다른 계정 것은 뺀다. 차례는 칩 차례(개인 → 내 그룹 목록 차례).
 * 목록을 받기 전에는 적어 둔 그룹을 믿는다(chooseSpace와 같다 - 사본에 없으면 그릴 것도 없다).
 */
export function overlaySpaces(uid: string, overlay: SpaceOverlay, mine: { groups: GroupSpace[]; loaded: boolean }, main: string | null): string[] {
  if (overlay.uid !== uid) return [];
  const personal = `u_${uid}`;
  const groupAt = (sid: string) => mine.groups.findIndex((g) => g.id === sid);
  const ok = (sid: string) => sid !== main && (sid === personal || (sid.startsWith('g_') && (!mine.loaded || groupAt(sid) >= 0)));
  // 목록에 아직 없는 그룹(받기 전)은 뒤로
  const rank = (sid: string) => (sid === personal ? -1 : groupAt(sid) >= 0 ? groupAt(sid) : mine.groups.length);
  return overlay.sids.filter((sid, i, all) => ok(sid) && all.indexOf(sid) === i).sort((a, b) => rank(a) - rank(b));
}

/** 겹쳐 보기 더하기·빼기 (Ctrl·Shift·길게 누르기 - 주 공간은 화면이 막는다) */
export function toggleOverlay(uid: string, sid: string) {
  const o = useSpaceOverlay.getState();
  const sids = o.uid === uid ? o.sids : [];
  useSpaceOverlay.setState({ uid, sids: sids.includes(sid) ? sids.filter((s) => s !== sid) : [...sids, sid] });
}

/** 겹쳐 보기를 모두 끈다 (칩 그냥 누르기 = 그 공간 하나 - 라벨 칩 탐색기식) */
export function clearOverlay(uid: string) {
  const o = useSpaceOverlay.getState();
  if (o.uid !== uid || o.sids.length > 0) useSpaceOverlay.setState({ uid, sids: [] });
}

/** 받은 그룹 목록을 기억한다 (다른 계정이었으면 고른 것도 비운다) */
export function rememberGroups(uid: string, ids: string[]) {
  const c = useSpaceChoice.getState();
  useSpaceChoice.setState(c.uid === uid ? { known: ids } : { uid, sid: null, known: ids });
}

// 32글자라 바이트 나머지가 치우치지 않는다
const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 8자리 초대 코드 (헷갈리는 0·O·1·I는 뺀다 - V4 그대로). 옛 6자리 코드는 그대로 쓴다 */
export function inviteCodeOf(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(8))): string {
  return Array.from(bytes, (b) => INVITE_CHARS.charAt(b % INVITE_CHARS.length)).join('');
}

export const cleanInviteCode = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** 초대 코드 모양 (V4 코드 포함) - 아니면 문서 id로 쓰지 않는다. 주소를 붙여 넣으면 '/'가 경로가 되어 Firestore가 던졌다 */
export const isInviteCode = (s: string) => /^[A-Z0-9]{4,12}$/.test(s);

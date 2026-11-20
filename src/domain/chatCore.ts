// 대화 셈 가운데 껍데기가 늘 부르는 것 (P49-3 - domain/chat에서 나눔): 방 읽기·방 키·안 읽은 수·새 글 안내·?chat= 주소.
//   대화 창·보내기만 쓰는 셈(글 줄·보내기 문서·방 목록 묶음)은 domain/chat - 창을 열 때 받는다. domain/chat이 이 파일을 다시 내보내
//   대화 창 쪽은 domain/chat 하나만 부른다. 껍데기 쪽(머리줄 💬·받기·안 읽은 수)은 이 파일을 부른다.

/** 안 읽은 글 수는 여기까지만 보인다 - 넘으면 '99+' */
export const CHAT_COUNT_MAX = 99;

export type ChatKind = 'all' | 'room' | 'dm';

/** 방을 가리키는 것 - 그룹 방은 그룹 sid + roomId('all' | 'r_…'), 1:1은 pairId */
export type ChatRoomRef = { kind: 'all' | 'room'; sid: string; roomId: string } | { kind: 'dm'; pairId: string };

const ID = '[A-Za-z0-9]+';
const GROUP_KEY = new RegExp(`^(g_${ID})~(all|r_${ID})$`);
/** 1:1 방 id 모양 (dmOtherOf - domain/chat도 쓴다) */
export const DM_PAIR = new RegExp(`^d_(${ID})_(${ID})$`);

/** 방 키 - 그룹 방 '<sid>~<roomId>', 1:1 = pairId */
export function roomKey(ref: ChatRoomRef): string {
  return ref.kind === 'dm' ? ref.pairId : `${ref.sid}~${ref.roomId}`;
}

/** 방 키 → 방 (모양이 아니면 null) */
export function parseRoomKey(key: string): ChatRoomRef | null {
  const g = GROUP_KEY.exec(key);
  if (g) return { kind: g[2] === 'all' ? 'all' : 'room', sid: g[1], roomId: g[2] };
  const d = DM_PAIR.exec(key);
  return d && d[1] < d[2] ? { kind: 'dm', pairId: key } : null;
}

/** 방 (방 문서 → 앱 모양) */
export interface ChatRoom {
  key: string;
  kind: ChatKind;
  /** 그룹 방 = 경로의 그룹, 1:1 = 방이 든 함께 든 그룹(그 그룹을 나가면 보낼 때 함께 든 다른 그룹으로 옮긴다) */
  sid: string;
  /** 고른 사람 방 이름 (그룹 전체·1:1은 빈 글 - 화면이 붙인다) */
  name: string;
  /** 고른 사람 방·1:1 사람 (그룹 전체는 빈 목록 - 지금 그룹 구성원 모두) */
  members: string[];
  /** 1:1 - 저마다 적은 제 이름 (함께 든 그룹이 없을 때 상대 이름) */
  names: Record<string, string>;
  lastId: string | null;
  /** 마지막 글 시각(ms) - 내가 막 보내 서버가 아직 받지 않았으면 null */
  lastAt: number | null;
  lastFrom: string;
  lastFromName: string;
  lastText: string;
  /** 🔕 알림을 끈 사람 */
  muted: string[];
  /** 1:1 읽음 - uid → 서버 시각(ms) */
  reads: Record<string, number>;
}

// 서버 문서 → 앱 모양. Timestamp는 toMillis로(이 파일은 Firebase를 import하지 않는다).
export const docMillis = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : typeof v === 'number' ? v : null;
export const docStr = (v: unknown) => (typeof v === 'string' ? v : '');
export const docTrueKeys = (v: unknown) =>
  v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === true).map(([k]) => k) : [];

export function readChatRoom(ref: ChatRoomRef, d: Record<string, unknown>): ChatRoom {
  const names: Record<string, string> = {};
  const reads: Record<string, number> = {};
  if (ref.kind === 'dm') {
    for (const [uid, n] of Object.entries((d.names as Record<string, unknown>) ?? {})) if (typeof n === 'string' && n) names[uid] = n;
    for (const [uid, t] of Object.entries((d.reads as Record<string, unknown>) ?? {})) {
      const ms = docMillis(t);
      if (ms !== null) reads[uid] = ms;
    }
  }
  return {
    key: roomKey(ref),
    kind: ref.kind,
    sid: ref.kind === 'dm' ? docStr(d.sid) : ref.sid,
    name: ref.kind === 'room' ? docStr(d.name) : '',
    members: ref.kind === 'all' ? [] : docTrueKeys(d.members),
    names,
    lastId: docStr(d.lastId) || null,
    lastAt: docMillis(d.lastAt),
    lastFrom: docStr(d.lastFrom),
    lastFromName: docStr(d.lastFromName) || '이름 없음',
    lastText: docStr(d.lastText),
    muted: docTrueKeys(d.muted),
    reads,
  };
}

/** 방 문서 경로 */
export function roomPath(ref: ChatRoomRef): string[] {
  return ref.kind === 'dm' ? ['v5Dm', ref.pairId] : ['v5Chat', ref.sid, 'chatRooms', ref.roomId];
}

/** 내 읽음 시각 - 1:1은 방 reads, 그룹 방은 내 읽음 문서(v5ChatReads rooms) */
export function myReadOf(room: ChatRoom, me: string, groupReads: Readonly<Record<string, number>>): number | null {
  return (room.kind === 'dm' ? room.reads[me] : groupReads[room.key]) ?? null;
}

/** 안 읽은 방인가 - 마지막 글이 남의 것이고 내 읽음 뒤(읽음 칸이 없으면 안 읽음) */
export function isRoomUnread(room: ChatRoom, me: string, readAt: number | null): boolean {
  if (room.lastAt === null || !room.lastFrom || room.lastFrom === me) return false;
  return readAt === null || room.lastAt > readAt;
}

/** 안 읽은 방 키 - 머리줄 💬 n */
export function unreadRoomKeys(rooms: readonly ChatRoom[], me: string, groupReads: Readonly<Record<string, number>>): string[] {
  return rooms.filter((r) => isRoomUnread(r, me, myReadOf(r, me, groupReads))).map((r) => r.key);
}

/** 머리줄 💬 n - 안 읽은 방 수. 그룹 방은 지금 든 그룹 것만(나간 그룹의 방은 듣기가 끊길 때까지 store에 남는다), 1:1은 모두. 🔕 방도 센다 */
export function unreadRoomCount(rooms: readonly ChatRoom[], me: string, groupReads: Readonly<Record<string, number>>, groupIds: readonly string[]): number {
  return unreadRoomKeys(
    rooms.filter((r) => r.kind === 'dm' || groupIds.includes(r.sid)),
    me,
    groupReads,
  ).length;
}

/** 새 글 안내 - '💬 이점검: 안녕' · 그룹 방은 '💬 이점검 (4학년 협의회): 안녕' · 고른 사람 방은 방 이름 */
export function chatNotice(room: ChatRoom, groupName: string): string {
  const where = room.kind === 'all' ? groupName : room.kind === 'room' ? room.name || groupName : '';
  return `💬 ${room.lastFromName}${where ? ` (${where})` : ''}: ${room.lastText || '지운 글'}`;
}

/** 안 읽은 글 수 표시 */
export const chatCountLabel = (n: number) => (n > CHAT_COUNT_MAX ? `${CHAT_COUNT_MAX}+` : String(n));

// 푸시 알림을 눌러 앱을 열 때 주소 ?chat=<방 키> (public/sw.js notificationclick)

/** 주소의 ?chat= 값 - 없거나 방 키 모양이 아니면 null */
export function chatParamOf(search: string): string | null {
  const key = new URLSearchParams(search).get('chat');
  return key && key.length <= 120 && parseRoomKey(key) ? key : null;
}

/** 주소에서 ?chat=을 지운다 (새로고침해도 다시 열리지 않게). 다른 값과 # 뒤는 둔다 */
export function stripChatParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('chat');
  return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '') + u.hash;
}

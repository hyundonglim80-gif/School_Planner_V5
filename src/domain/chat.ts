// 대화 셈 (P19-1 ■2). 같은 그룹 구성원끼리 방 하나 + 그 아래 글을 함께 읽는다 - 쓰기·받기는 data/chat, 규칙은 firestore.rules v5Chat·v5Dm·v5ChatReads.
//   - 방 셋: 그룹 전체 v5Chat/{sid}/chatRooms/all · 고른 사람 방 v5Chat/{sid}/chatRooms/r_… · 1:1 v5Dm/d_{작은 uid}_{큰 uid}. 글은 그 아래 chatMsgs.
//   - 방 키(store·?chat=·내 읽음 칸 이름): 그룹 방 '<sid>~<roomId>', 1:1 = pairId. '~'는 글자 경로에 못 쓴다 - 읽음은 setDoc merge로(P19-1 ■0).
//   - 글 하나 = 글 + 방 미리 보기(last*) 한 묶음. 방 모양은 종류마다(chatSendDocs) - 그룹 전체·1:1은 늘 같은 모양(둘이 함께 첫 글을 보내도 된다).
//   - 칸과 길이는 규칙과 같게(CHAT_LIMITS). 글 길이는 규칙도 글자 칸 수(UTF-16)로 센다(P15-1 ■0).
//   - 안 읽은 방 = 마지막 글이 남의 것이고 내 읽음(그룹 방 v5ChatReads, 1:1 방 reads.<나>) 뒤. 읽음 칸이 없으면 안 읽음 -
//     그룹에 새로 든 사람은 참여할 때 그 그룹 전체 방 읽음을 적는다(지난 글이 모두 안 읽음으로 뜨지 않게, data/chat markChatJoined).
import type { Attachment } from '../data/types';
import { cleanAttachment, readSharedAttachments } from './attachments';

/** 칸마다 가장 긴 것 - 규칙(firestore.rules 대화)과 같게 */
export const CHAT_LIMITS = { text: 2000, fromName: 40, lastText: 80, roomName: 40, roomMembers: 50, attachments: 10 } as const;
/** 1년 뒤 TTL 정책이 지운다(방은 글마다 늘어난다 - 규칙은 방 360~370일, 글 370일 안) */
export const CHAT_KEEP_DAYS = 365;
/** 방을 열면 받는 글 수 · 위로 올리면 더 받는 수 */
export const CHAT_PAGE = 50;
/** 안 읽은 글 수는 여기까지만 보인다 - 넘으면 '99+' */
export const CHAT_COUNT_MAX = 99;

export type ChatKind = 'all' | 'room' | 'dm';

/** 방을 가리키는 것 - 그룹 방은 그룹 sid + roomId('all' | 'r_…'), 1:1은 pairId */
export type ChatRoomRef = { kind: 'all' | 'room'; sid: string; roomId: string } | { kind: 'dm'; pairId: string };

const ID = '[A-Za-z0-9]+';
const GROUP_KEY = new RegExp(`^(g_${ID})~(all|r_${ID})$`);
const PAIR = new RegExp(`^d_(${ID})_(${ID})$`);

/** 방 키 - 그룹 방 '<sid>~<roomId>', 1:1 = pairId */
export function roomKey(ref: ChatRoomRef): string {
  return ref.kind === 'dm' ? ref.pairId : `${ref.sid}~${ref.roomId}`;
}

/** 방 키 → 방 (모양이 아니면 null) */
export function parseRoomKey(key: string): ChatRoomRef | null {
  const g = GROUP_KEY.exec(key);
  if (g) return { kind: g[2] === 'all' ? 'all' : 'room', sid: g[1], roomId: g[2] };
  const d = PAIR.exec(key);
  return d && d[1] < d[2] ? { kind: 'dm', pairId: key } : null;
}

/** 두 사람의 1:1 방 id - 작은 uid가 앞(규칙이 글자 견주기로 본다) */
export function dmPairId(a: string, b: string): string {
  return a < b ? `d_${a}_${b}` : `d_${b}_${a}`;
}

/** 1:1 방의 상대 - 내가 든 방이 아니면 null */
export function dmOtherOf(pairId: string, me: string): string | null {
  const d = PAIR.exec(pairId);
  if (!d) return null;
  return d[1] === me ? d[2] : d[2] === me ? d[1] : null;
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

/** 글 (chatMsgs 문서 → 앱 모양) */
export interface ChatMsg {
  id: string;
  from: string;
  fromName: string;
  text: string;
  attachments: Attachment[];
  /** 보낸 시각(ms) - 내가 막 보내 서버가 아직 받지 않았으면 null */
  at: number | null;
  /** 보낸 사람이 지웠다 - 모두에게 '지운 글'(P19-4) */
  deleted: boolean;
}

// 서버 문서 → 앱 모양. Timestamp는 toMillis로(이 파일은 Firebase를 import하지 않는다).
const millis = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : typeof v === 'number' ? v : null;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const trueKeys = (v: unknown) =>
  v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === true).map(([k]) => k) : [];
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function readChatRoom(ref: ChatRoomRef, d: Record<string, unknown>): ChatRoom {
  const names: Record<string, string> = {};
  const reads: Record<string, number> = {};
  if (ref.kind === 'dm') {
    for (const [uid, n] of Object.entries((d.names as Record<string, unknown>) ?? {})) if (typeof n === 'string' && n) names[uid] = n;
    for (const [uid, t] of Object.entries((d.reads as Record<string, unknown>) ?? {})) {
      const ms = millis(t);
      if (ms !== null) reads[uid] = ms;
    }
  }
  return {
    key: roomKey(ref),
    kind: ref.kind,
    sid: ref.kind === 'dm' ? str(d.sid) : ref.sid,
    name: ref.kind === 'room' ? str(d.name) : '',
    members: ref.kind === 'all' ? [] : trueKeys(d.members),
    names,
    lastId: str(d.lastId) || null,
    lastAt: millis(d.lastAt),
    lastFrom: str(d.lastFrom),
    lastFromName: str(d.lastFromName) || '이름 없음',
    lastText: str(d.lastText),
    muted: trueKeys(d.muted),
    reads,
  };
}

export function readChatMsg(id: string, d: Record<string, unknown>): ChatMsg {
  // 칸이 있으면 지운 글 - 막 지워 서버 시각을 기다리는 동안은 값이 null이다
  const deleted = 'deletedAt' in d;
  return {
    id,
    from: str(d.from),
    fromName: str(d.fromName) || '이름 없음',
    text: deleted ? '' : str(d.text),
    attachments: deleted ? [] : readSharedAttachments(d.attachments, CHAT_LIMITS.attachments),
    at: millis(d.at),
    deleted,
  };
}

/** 보낼 글 - 이름은 아래 셈이 자른다 */
export interface OutgoingChat {
  from: string;
  fromName: string;
  text: string;
  attachments?: readonly Attachment[];
}

/** 보낼 곳 - 고른 사람 방은 만들 때만 create(이름·사람), 1:1은 상대와 함께 든 그룹 */
export type ChatTarget =
  | { kind: 'all'; sid: string }
  | { kind: 'room'; sid: string; roomId: string; create?: { name: string; members: readonly string[] } }
  | { kind: 'dm'; pairId: string; other: string; sid: string };

/** 글·첨부가 보낼 수 있는 것인가 - 안 되면 안내 글. 첨부가 있으면 글은 비어도 된다 */
export function chatTextError(text: string, files = 0): string | null {
  if (!text.trim() && files === 0) return '보낼 글을 적거나 파일을 붙여 주세요.';
  if (text.length > CHAT_LIMITS.text) return `글은 한 번에 ${CHAT_LIMITS.text}자까지 보낼 수 있습니다 (지금 ${text.length}자).`;
  if (files > CHAT_LIMITS.attachments) return `첨부는 한 번에 ${CHAT_LIMITS.attachments}개까지 보낼 수 있습니다 (지금 ${files}개).`;
  return null;
}

/** 방 목록에 보일 마지막 글 - 빈 줄을 건너뛴 첫 줄(80자), 글이 없으면 '📎 n' */
export function chatPreview(text: string, files = 0): string {
  const line = (text.split('\n').find((l) => l.trim()) ?? '').trim();
  return line ? cut(line, CHAT_LIMITS.lastText) : files ? `📎 ${files}` : '';
}

/** 지울 날(ms) */
export const chatExpireAt = (now: number) => now + CHAT_KEEP_DAYS * 86_400_000;

/** 글이 있는 상자 경로 (방 문서 아래 chatMsgs) */
export function msgsPath(ref: ChatRoomRef): string[] {
  return ref.kind === 'dm' ? ['v5Dm', ref.pairId, 'chatMsgs'] : ['v5Chat', ref.sid, 'chatRooms', ref.roomId, 'chatMsgs'];
}

/** 방 문서 경로 */
export function roomPath(ref: ChatRoomRef): string[] {
  return ref.kind === 'dm' ? ['v5Dm', ref.pairId] : ['v5Chat', ref.sid, 'chatRooms', ref.roomId];
}

export function refOf(t: ChatTarget): ChatRoomRef {
  return t.kind === 'dm' ? { kind: 'dm', pairId: t.pairId } : { kind: t.kind, sid: t.sid, roomId: t.kind === 'all' ? 'all' : t.roomId };
}

/**
 * 보낼 문서 둘 - 글과 방(merge로 쓴다 - 고른 사람 방 만들기만 통째로).
 * 그룹 전체 = 늘 `{ kind, last*, expireAt, v }` · 고른 사람 방 = 만들 때만 name·members, 뒤로는 last*만 ·
 * 1:1 = 늘 `{ kind, members, sid, names: { 나: 이름 }, last*, expireAt, v }`(상대 이름은 함께 든 그룹 사람 목록에서). 🔕(muted)는 싣지 않는다 - 남의 칸을 덮는다.
 * at·expireAt은 자료 층이 서버 시각·Timestamp로 넣는다(이 파일은 Firebase를 모른다).
 */
export function chatSendDocs<A, E>(t: ChatTarget, m: OutgoingChat, id: string, at: A, expireAt: E) {
  const fromName = cut(m.fromName.trim() || '이름 없음', CHAT_LIMITS.fromName);
  const files = m.attachments?.length ?? 0;
  const msg = {
    from: m.from,
    fromName,
    text: m.text,
    // 붙임이 있을 때만 칸째(규칙 - 빈 목록은 막힌다)
    ...(files ? { attachments: m.attachments!.map(cleanAttachment) } : {}),
    at,
    expireAt,
    v: 1 as const,
  };
  const last = { lastId: id, lastAt: at, lastFrom: m.from, lastFromName: fromName, lastText: chatPreview(m.text, files), expireAt };
  if (t.kind === 'all') return { msg, room: { kind: 'all' as const, ...last, v: 1 as const }, merge: true };
  if (t.kind === 'dm') {
    return { msg, room: { kind: 'dm' as const, members: { [m.from]: true, [t.other]: true }, sid: t.sid, names: { [m.from]: fromName }, ...last, v: 1 as const }, merge: true };
  }
  if (!t.create) return { msg, room: last, merge: true };
  const members = Object.fromEntries([...new Set([m.from, ...t.create.members])].map((uid) => [uid, true]));
  return { msg, room: { kind: 'room' as const, name: cut(t.create.name.trim(), CHAT_LIMITS.roomName), members, ...last, v: 1 as const }, merge: false };
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

/** 방 목록 차례 - 마지막 글이 최근인 방부터(막 보낸 방 = 맨 위) */
export function sortRooms(rooms: readonly ChatRoom[]): ChatRoom[] {
  const at = (r: ChatRoom) => r.lastAt ?? Number.MAX_SAFE_INTEGER;
  return [...rooms].sort((a, b) => at(b) - at(a) || a.key.localeCompare(b.key));
}

/** 대화 창 목록 묶음 - 1:1 묶음 + 그룹마다(그룹 전체 · 고른 사람 방) */
export interface ChatSections {
  dms: ChatRoom[];
  groups: { sid: string; name: string; all: ChatRoom | null; rooms: ChatRoom[] }[];
}

/**
 * 목록을 묶는다. 그룹 전체 방은 첫 글이 오기 전에도 그룹마다 한 줄(all null - 눌러서 첫 글을 쓴다).
 * 내가 든 그룹 것만(나간 그룹의 방은 듣기가 끊길 때까지 store에 남는다), 1:1은 함께 든 그룹이 없어도 보인다(지난 글을 읽는다).
 */
export function chatSections(rooms: readonly ChatRoom[], groups: readonly { id: string; name: string }[]): ChatSections {
  const sorted = sortRooms(rooms);
  return {
    dms: sorted.filter((r) => r.kind === 'dm'),
    groups: [...groups]
      .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
      .map((g) => ({
        sid: g.id,
        name: g.name,
        all: sorted.find((r) => r.kind === 'all' && r.sid === g.id) ?? null,
        rooms: sorted.filter((r) => r.kind === 'room' && r.sid === g.id),
      })),
  };
}

/** 목록 줄의 마지막 글 - 그룹 방은 '이름: 글', 내 글은 '나: 글'. 마지막 글을 지웠으면 '지운 글', 글이 없으면 빈 글 */
export function roomPreview(room: ChatRoom, me: string): string {
  if (!room.lastId) return '';
  const text = room.lastText || '지운 글';
  if (room.lastFrom === me) return `나: ${text}`;
  return room.kind === 'dm' ? text : `${room.lastFromName}: ${text}`;
}

/**
 * 받은 글을 잇는다 - 같은 id는 뒤(b) 것으로, 차례는 보낸 시각(보내는 중인 글은 맨 뒤). 방 듣기는 최근 50개뿐이라
 * 지난 글이 듣기 창 밖으로 밀려도 화면에는 남게 받은 것을 모두 모은다.
 */
export function mergeMsgs(a: readonly ChatMsg[], b: readonly ChatMsg[]): ChatMsg[] {
  const byId = new Map<string, ChatMsg>();
  for (const m of [...a, ...b]) byId.set(m.id, m);
  const at = (m: ChatMsg) => m.at ?? Number.MAX_SAFE_INTEGER;
  return [...byId.values()].sort((x, y) => at(x) - at(y) || x.id.localeCompare(y.id));
}

/** 1:1 내 글 옆 '1' - 상대가 아직 안 읽었다(그룹 방은 읽은 사람 수를 세지 않는다) */
export function unseenByOther(room: ChatRoom, me: string, msg: ChatMsg): boolean {
  if (room.kind !== 'dm' || msg.from !== me || msg.deleted) return false;
  const other = dmOtherOf(room.key, me);
  const read = other ? room.reads[other] : undefined;
  return msg.at === null || read === undefined || msg.at > read;
}

/** 안 읽은 글 수 표시 */
export const chatCountLabel = (n: number) => (n > CHAT_COUNT_MAX ? `${CHAT_COUNT_MAX}+` : String(n));

/** 이만큼 안에 같은 사람이 잇달아 쓴 글은 이름을 한 번만 */
export const CHAT_RUN_MS = 5 * 60_000;

/** 글 줄 - day = 이 글 앞에 날짜 나눔 줄(그날 첫 글), head = 이름을 보인다(잇단 글의 첫 글), time = 시각을 보인다(잇단 글의 같은 분 마지막 글) */
export interface ChatRow {
  msg: ChatMsg;
  day: string | null;
  head: boolean;
  time: boolean;
}

const dayKey = (at: number) => new Date(at).toDateString();

/** 날짜 나눔 줄 글 - '2026년 11월 3일 화요일' */
export function chatDayLabel(at: number): string {
  return new Date(at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

/** 글 시각 - '오후 3:05' (null = 보내는 중) */
export function chatTime(at: number | null): string {
  return at === null ? '보내는 중…' : new Date(at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

/**
 * 오래된 것부터 놓인 글에 날짜 나눔·이름 보이기를 붙인다. 보내는 중(at null)인 글은 앞 글과 같은 날로 본다.
 * now = 보내는 중인 글이 맨 앞일 때의 날(시험이 정한다).
 */
export function chatRows(msgs: readonly ChatMsg[], now = Date.now()): ChatRow[] {
  const rows: ChatRow[] = [];
  const ats: number[] = [];
  let prev: { from: string; at: number; day: string } | null = null;
  for (const msg of msgs) {
    const at: number = msg.at ?? prev?.at ?? now;
    const day = dayKey(at);
    const newDay = !prev || prev.day !== day;
    const head = newDay || prev!.from !== msg.from || at - prev!.at > CHAT_RUN_MS;
    rows.push({ msg, day: newDay ? chatDayLabel(at) : null, head, time: true });
    ats.push(at);
    prev = { from: msg.from, at, day };
  }
  // 다음 글이 같은 잇단 글이고 같은 분이면 시각은 그 뒤 글에만 (보내는 중인 글은 늘 '보내는 중…')
  const minute = (at: number) => Math.floor(at / 60_000);
  for (let i = 0; i < rows.length - 1; i++) {
    const next = rows[i + 1];
    if (!next.head && rows[i].msg.at !== null && next.msg.at !== null && minute(ats[i]) === minute(ats[i + 1])) rows[i].time = false;
  }
  return rows;
}

// 푸시 알림을 눌러 앱을 열 때 주소 ?chat=<방 키> (public/sw.js notificationclick) - ?mail= 본보기(domain/mail)

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

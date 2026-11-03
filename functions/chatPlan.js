// functions/chatPlan.js - 대화 푸시 셈 (P19-1 ■3, 순수 함수 - chatPlan.test.js). 보내기는 index.js v5ChatPush·v5DmPush.
// 글이 생기면 방 사람 기기에 '💬 보낸 사람 · 방 이름'만 알린다 - 글은 싣지 않는다(쪽지와 같은 까닭 - 잠금 화면에 학생 이야기, FCM data 4KB).
// 같은 방의 새 글은 알림 하나를 소리 없이 바꾼다(앱 public/sw.js 'chat' 갈래 - tag sp5-chat-<방 키>). 🔕(방 muted.<uid>)인 사람은 뺀다.
// FCM data 키로 'from'은 쓰지 못한다 → 보낸 사람은 'sender'(mailPlan.js isReservedDataKey).

import { NAME_MAX } from './mailPlan.js';

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const trueKeys = (m) => (m && typeof m === 'object' ? Object.keys(m).filter((k) => m[k] === true) : []);

/**
 * 알릴 사람 - 보낸 사람·🔕인 사람을 빼고.
 *   all  = 지금 그 그룹 구성원 모두(spaceMembers { uid: 'owner' | 'member' })
 *   room = 방 사람(roomMembers { uid: true }) 중 지금 그 그룹 구성원(그룹을 나간 사람은 방에 남아 있어도 못 읽는다)
 *   dm   = 방 두 사람 중 상대(보낼 때 규칙이 두 사람이 함께 든 그룹을 봤다)
 */
export function chatRecipients({ kind, spaceMembers, roomMembers, muted, from }) {
  const inGroup = (uid) => ['owner', 'member'].includes(spaceMembers?.[uid]);
  const base =
    kind === 'all'
      ? Object.keys(spaceMembers ?? {}).filter(inGroup)
      : kind === 'room'
        ? trueKeys(roomMembers).filter(inGroup)
        : kind === 'dm'
          ? trueKeys(roomMembers)
          : [];
  const off = new Set(trueKeys(muted));
  return base.filter((uid) => uid && uid !== from && !off.has(uid));
}

/** 알림 제목 - 그룹 전체 = 그룹 이름, 고른 사람 방 = 방 이름(없으면 그룹 이름), 1:1 = 없음(보낸 사람이 제목) */
export function chatTitle({ kind, groupName, roomName }) {
  const name = kind === 'room' ? String(roomName || '').trim() || String(groupName || '').trim() : kind === 'all' ? String(groupName || '').trim() : '';
  return cut(name, NAME_MAX);
}

/** 푸시에 실을 값 (FCM data는 글자만) - 앱 public/sw.js 'chat' 갈래가 읽는다. room = 방 키('<sid>~<roomId>' | pairId - ?chat=) */
export function chatPushData({ room, senderName, title }) {
  return {
    type: 'chat',
    room: String(room || ''),
    sender: cut(String(senderName || '').trim() || '이름 없음', NAME_MAX),
    title: String(title || ''),
  };
}

/** 이 글이 방의 마지막 글인가 - 아니면 뒤 글이 알린다(잇달아 온 글마다 울리지 않게. 함수 차례가 바뀌어도 마지막 글은 늘 알린다) */
export function isLastMsg(room, id) {
  return !!room && room.lastId === id;
}

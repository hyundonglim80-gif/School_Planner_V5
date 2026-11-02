// functions/mailPlan.js - 쪽지 푸시 셈 (P15-1 ■3, 순수 함수 - mailPlan.test.js). 보내기는 index.js v5MailPush.
// 쪽지 사본(v5Mail/{보낸 uid}/mailSent/{id})이 생기면 받는 사람 기기에 '✉ 보낸 사람 · 그룹'만 알린다 - 쪽지 글은 싣지 않는다
// (잠금 화면에 학생 이야기가 보일 수 있고, FCM data는 4KB까지 - 넘으면 invalid-argument로 거절된다).
// FCM data 키로 'from'·'notification'·'message_type'과 'google.'·'gcm.'으로 시작하는 것은 쓰지 못한다 → 보낸 사람은 'sender'.

export const MAIL_TO_MAX = 50;
export const NAME_MAX = 40;

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 받는 사람 - 글자 uid만, 겹침·보낸 사람을 빼고 50명까지(규칙과 같게) */
export function mailRecipients(to, from) {
  const out = [];
  for (const uid of Array.isArray(to) ? to : []) {
    if (typeof uid !== 'string' || !uid || uid === from || out.includes(uid)) continue;
    out.push(uid);
    if (out.length === MAIL_TO_MAX) break;
  }
  return out;
}

/** 푸시에 실을 값 (FCM data는 글자만) - 앱 public/sw.js 'mail' 갈래가 읽는다 */
export function mailPushData({ id, sid, senderName, groupName }) {
  return {
    type: 'mail',
    id: String(id || ''),
    sid: String(sid || ''),
    sender: cut(String(senderName || '').trim() || '이름 없음', NAME_MAX),
    group: cut(String(groupName || '').trim(), NAME_MAX),
  };
}

/** FCM이 data 키로 받지 않는 이름 */
export function isReservedDataKey(key) {
  return ['from', 'notification', 'message_type'].includes(key) || key.startsWith('google.') || key.startsWith('gcm.');
}

/**
 * 쪽지 길에서 토큰을 지울 오류 - 앱을 지웠거나 알림을 끈 기기만.
 * invalid-argument는 뺀다: 우리가 실은 값이 잘못이어도 나오므로, 그것으로 토큰을 지우면 그 사람의 일정 알림까지 끊긴다.
 */
export function isDeadMailToken(code) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

/** 500개씩 (sendEachForMulticast 한 번의 끝) */
export function chunks(list, size = 500) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

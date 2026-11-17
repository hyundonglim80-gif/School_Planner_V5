// functions/pushPlan.js - 대화·Claude 답 푸시가 함께 쓰는 셈 (순수 함수 - pushPlan.test.js). 보내기는 index.js multicast.
// P15 쪽지 푸시(mailPlan.js)에서 나왔다 - 쪽지는 P41-3(11-17)에 걷었고, 함께 쓰던 것만 여기 남겼다.
// FCM data 키로 'from'·'notification'·'message_type'과 'google.'·'gcm.'으로 시작하는 것은 쓰지 못한다 → 보낸 사람은 'sender'.

/** 알림에 싣는 이름(보낸 사람·방 이름) 길이 */
export const NAME_MAX = 40;

/** FCM이 data 키로 받지 않는 이름 */
export function isReservedDataKey(key) {
  return ['from', 'notification', 'message_type'].includes(key) || key.startsWith('google.') || key.startsWith('gcm.');
}

/**
 * 대화·Claude 답 길에서 토큰을 지울 오류 - 앱을 지웠거나 알림을 끈 기기만.
 * invalid-argument는 뺀다: 우리가 실은 값이 잘못이어도 나오므로, 그것으로 토큰을 지우면 그 사람의 일정 알림까지 끊긴다.
 */
export function isDeadPushToken(code) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

/** 500개씩 (sendEachForMulticast 한 번의 끝) */
export function chunks(list, size = 500) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// functions/alarmPlan.js - 일정 알림 서버 푸시의 계산 부분 (V4 functions/alarmPlan.js를 항목 하나 단위로, P8-2).
// Firebase에 기대지 않는 순수 함수 - alarmPlan.test.js가 본다(`npm run test:functions`).
//
// V5 일정 = 문서 하나(spaces/{sid}/items/{id}). 알림 = date('YYYY-MM-DD') + time('HH:mm', 한국 시각).
// 그 항목의 알림 칸은 v5alarms/{itemId} 하나 - 매분 도는 함수가 pendingAt <= 지금인 칸만 골라 보낸다.
//   - 보낸 칸은 sent: true, pendingAt 없음 (범위 조회에 걸리지 않는다 - 색인 하나로 충분)
//   - 같은 시각이면 다시 보내지 않는다. 시각을 바꾸면 새로 보낸다. 알림을 끄거나·끝내거나·지우면 칸을 지운다.
//   - 이미 1시간 넘게 지난 시각은 보내지 않는다(앱의 알림 창과 같은 규칙).
//   - 알림은 처음 날에만 (이월로 따라오는 동안 다시 울리지 않는다 - DESIGN 5-1, V4도 이월하면 알림이 따라오지 않았다).

export const ALARM_WINDOW_MS = 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM_RE = /^(\d{2}):(\d{2})$/;
const KST_OFFSET_H = 9; // 한국은 서머타임이 없다

/** 'YYYY-MM-DD' + 'HH:mm'(한국 시각) → ms. 모양이 틀리면 null */
export function alarmAtMs(date, hm) {
  const d = DATE_RE.exec(typeof date === 'string' ? date : '');
  const t = HM_RE.exec(typeof hm === 'string' ? hm : '');
  if (!d || !t) return null;
  const [y, mo, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, day, h - KST_OFFSET_H, mi);
  return Number.isNaN(ms) ? null : ms;
}

/** 알림을 걸 일정인가 - 일정·지우지 않음·끝내지 않음(기간이면 첫날 끝냄도)·날짜와 시각 */
export function alarmOf(item) {
  if (!item || item.kind !== 'event' || item.deletedAt || item.done) return null;
  if (Array.isArray(item.doneDates) && item.doneDates.includes(item.date)) return null;
  const atMs = alarmAtMs(item.date, item.time);
  return atMs == null ? null : { time: `${item.date}T${item.time}`, atMs };
}

export function alarmBody(item) {
  const text = String(item?.text || '').trim();
  return (text || '예정된 일정이 있습니다.').slice(0, 300);
}

/**
 * 받는 사람: 개인 공간(u_{uid}) = 그 사람, 그룹 공간 = 쓴 사람(authorId) - 쓴 사람이 없으면 구성원 모두.
 * members = 그룹 공간 문서의 members 맵(uid → 역할) 또는 배열.
 */
export function recipientsOf(sid, item, members) {
  if (typeof sid !== 'string') return [];
  if (sid.startsWith('u_')) return [sid.slice(2)];
  if (item?.authorId) return [String(item.authorId)];
  const list = Array.isArray(members) ? members : members && typeof members === 'object' ? Object.keys(members) : [];
  return [...new Set(list.map(String).filter(Boolean))].sort();
}

/**
 * 항목 하나의 알림 칸을 맞춘다.
 * @returns {{ set?: object, remove?: true } | null} - null = 할 일 없음
 */
export function planItemAlarm({ sid, itemId, item, existing, recipients, nowMs }) {
  const a = alarmOf(item);
  if (!a) return existing ? { remove: true } : null;
  const content = alarmBody(item);
  const rec = [...new Set((recipients || []).filter(Boolean))].sort();
  if (existing && existing.time === a.time) {
    // 시각이 같다 - 보낸 것은 다시 보내지 않고, 글·받는 사람만 바뀌었으면 고친다
    if (existing.content === content && JSON.stringify(existing.recipients || []) === JSON.stringify(rec)) return null;
    return { set: { ...existing, content, recipients: rec } };
  }
  const stale = a.atMs < nowMs - ALARM_WINDOW_MS;
  return {
    set: { sid, itemId, time: a.time, atMs: a.atMs, content, recipients: rec, sent: stale, pendingAt: stale ? null : a.atMs },
  };
}

/** 알림 시각·글·끝냄·지움에 닿은 쓰기인가 (아니면 알림 칸을 읽지도 않는다 - 대부분의 저장은 여기서 끝난다) */
export function touchesAlarm(before, after) {
  const key = (d) => (d ? JSON.stringify([d.kind, d.date, d.time, d.text, !!d.done, !!d.deletedAt, (d.doneDates || []).includes(d.date), d.authorId]) : '');
  if (!before?.time && !after?.time) return false;
  return key(before) !== key(after);
}

/** 푸시에 실을 값 (FCM data는 글자만 받는다) */
export function pushData(alarm) {
  return {
    type: 'event-alarm',
    id: String(alarm.itemId || ''),
    sid: String(alarm.sid || ''),
    content: String(alarm.content || ''),
    time: String(alarm.time || ''),
  };
}

/** 토큰을 지워야 하는 FCM 오류 (기기에서 앱을 지웠거나 알림을 껐다) */
export function isDeadTokenError(code) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument';
}

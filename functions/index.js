// functions/index.js - V5 일정 알림 서버 푸시 (P8-2, V4 functions/index.js를 V5 자료로). 앱이 닫혀 있어도 휴대폰·PC에 알림이 가게 한다.
//   1) v5AlarmIndex     - 일정 문서(spaces/{sid}/items/{itemId})가 바뀌면 그 항목의 알림 칸(v5alarms/{itemId})을 맞춘다.
//                         앱의 어느 저장 길로 써도(하루·주간·여러 개 고르기·끌어 옮기기·가져오기 …) 여기서 한 번에 잡힌다.
//   2) v5SendDueAlarms  - 매분 pendingAt <= 지금인 칸을 골라 받는 사람의 기기 토큰(spaces/u_{uid}/pushTokens)으로 FCM을 보낸다.
//   3) v5CleanupAlarms  - 하루 한 번 30일 지난 칸을 지운다.
// 계산은 alarmPlan.js(순수 함수, alarmPlan.test.js). v5alarms는 규칙상 앱이 못 읽고 못 쓴다(이 함수들만, 관리자 권한).
//
// ⚠️ V4와 같은 Firebase 프로젝트다 - 함수 이름이 V4(alarmIndexUser·sendDueAlarms …)와 겹치면 서로 덮는다. 그래서 이름마다 v5를 붙인다.
// ⚠️ 배포는 반드시 codebase로: `npx firebase deploy --only functions:v5 --project schoolplannerv3` (빼면 V4 함수(default)를 지우려 한다).
//    배포는 사용자에게 묻고 PC에서 한다(CLAUDE.md 1장).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { ALARM_WINDOW_MS, isDeadTokenError, planItemAlarm, pushData, recipientsOf, touchesAlarm } from './alarmPlan.js';

// Firestore 위치와 같은 지역 (V4와 같다)
const REGION = 'asia-northeast3';
setGlobalOptions({ region: REGION, maxInstances: 5 });

initializeApp();
const db = getFirestore();
const ALARMS = 'v5alarms';

export const v5AlarmIndex = onDocumentWritten('spaces/{sid}/items/{itemId}', async (event) => {
  const { sid, itemId } = event.params;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  // 대부분의 저장(순서·라벨·글만 바꾼 메모)은 여기서 끝난다 - 알림 칸을 읽지도 않는다
  if (!touchesAlarm(before, after)) return;
  const ref = db.collection(ALARMS).doc(itemId);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;
  // 받는 사람: 그룹 공간이고 쓴 사람이 없으면 구성원 (그 공간 문서의 members)
  let members = null;
  if (!sid.startsWith('u_') && !after?.authorId) {
    const space = await db.collection('spaces').doc(sid).get();
    members = space.data()?.members ?? null;
  }
  const plan = planItemAlarm({ sid, itemId, item: after, existing, recipients: recipientsOf(sid, after, members), nowMs: Date.now() });
  if (!plan) return;
  if (plan.remove) await ref.delete();
  else await ref.set({ ...plan.set, updatedAt: Date.now() });
  logger.info('알림 칸 맞춤', { sid, itemId, remove: !!plan.remove });
});

async function tokensOf(uid) {
  const snap = await db.collection('spaces').doc(`u_${uid}`).collection('pushTokens').get();
  return snap.docs.map((d) => ({ ref: d.ref, token: d.data().token })).filter((t) => typeof t.token === 'string' && t.token);
}

export const v5SendDueAlarms = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Asia/Seoul', retryCount: 0 }, async () => {
  const now = Date.now();
  const due = await db.collection(ALARMS).where('pendingAt', '<=', now).limit(300).get();
  if (due.empty) return;
  const messaging = getMessaging();
  for (const doc of due.docs) {
    const alarm = doc.data();
    // 먼저 '보냄'으로 바꾼다 - 앞 회차가 아직 돌고 있어도 두 번 보내지 않게(그 사이 바뀌었으면 건너뛴다)
    try {
      await doc.ref.update({ sent: true, pendingAt: null, sentAt: now }, { lastUpdateTime: doc.updateTime });
    } catch {
      continue;
    }
    if (typeof alarm.atMs === 'number' && alarm.atMs < now - ALARM_WINDOW_MS) continue; // 너무 늦었다
    const tokens = (await Promise.all((alarm.recipients || []).map(tokensOf))).flat();
    if (tokens.length === 0) continue;
    const res = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      data: pushData(alarm),
      webpush: { headers: { Urgency: 'high', TTL: '3600' } },
      android: { priority: 'high', ttl: 3600 * 1000 },
    });
    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success && isDeadTokenError(r.error?.code)) dead.push(tokens[i].ref);
    });
    await Promise.all(dead.map((ref) => ref.delete().catch(() => {})));
    logger.info('알림 보냄', { id: doc.id, ok: res.successCount, fail: res.failureCount, removed: dead.length });
  }
});

// 오래된 칸 정리 (알림 시각이 30일 넘게 지난 것) - 하루 한 번
export const v5CleanupAlarms = onSchedule({ schedule: 'every day 04:10', timeZone: 'Asia/Seoul', retryCount: 0 }, async () => {
  const old = await db.collection(ALARMS).where('atMs', '<', Date.now() - 30 * 24 * ALARM_WINDOW_MS).limit(400).get();
  if (old.empty) return;
  const batch = db.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  logger.info('지난 알림 칸 지움', { count: old.size });
});

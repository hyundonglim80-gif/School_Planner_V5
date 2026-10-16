// functions/index.js - V5 일정 알림 서버 푸시 (P8-2, V4 functions/index.js를 V5 자료로). 앱이 닫혀 있어도 휴대폰·PC에 알림이 가게 한다.
//   1) v5AlarmIndex     - 일정 문서(spaces/{sid}/items/{itemId})가 바뀌면 그 항목의 알림 칸(v5alarms/{itemId})을 맞춘다.
//                         앱의 어느 저장 길로 써도(하루·주간·여러 개 고르기·끌어 옮기기·가져오기 …) 여기서 한 번에 잡힌다.
//   2) v5SendDueAlarms  - 매분 pendingAt <= 지금인 칸을 골라 받는 사람의 기기 토큰(spaces/u_{uid}/pushTokens)으로 FCM을 보낸다.
//   3) v5CleanupAlarms  - 하루 한 번 30일 지난 칸을 지운다.
//   4) v5ClaudeRequest  - 개인 공간 메모에 'Claude요청' 라벨을 붙이면 GitHub 이슈를 만든다(10-16 - Claude가 고치고 배포, claudePlan.js·docs/CLAUDE-REQUEST.md).
//                         진행은 v5SendDueAlarms가 매분 함께 본다(예약 작업을 늘리지 않는다 - 늘리면 돈이 든다).
// 계산은 alarmPlan.js(순수 함수, alarmPlan.test.js). v5alarms는 규칙상 앱이 못 읽고 못 쓴다(이 함수들만, 관리자 권한).
//
// ⚠️ V4와 같은 Firebase 프로젝트다 - 함수 이름이 V4(alarmIndexUser·sendDueAlarms …)와 겹치면 서로 덮는다. 그래서 이름마다 v5를 붙인다.
// ⚠️ 배포는 반드시 codebase로: `npx firebase deploy --only functions:v5 --project schoolplannerv3` (빼면 V4 함수(default)를 지우려 한다).
//    배포는 사용자에게 묻고 PC에서 한다(CLAUDE.md 1장).
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { ALARM_WINDOW_MS, isDeadTokenError, planItemAlarm, pushData, recipientsOf, touchesAlarm } from './alarmPlan.js';
import {
  FINAL_STATES,
  ISSUE_LABEL,
  REPO,
  isAllowedEmail,
  isClaudeLabelName,
  issueOf,
  mergeShaOf,
  newLabelIds,
  statusFromGithub,
} from './claudePlan.js';

// Firestore 위치와 같은 지역 (V4와 같다)
const REGION = 'asia-northeast3';
setGlobalOptions({ region: REGION, maxInstances: 5 });

initializeApp();
const db = getFirestore();
const ALARMS = 'v5alarms';
// Claude 요청 - v5claude/{itemId} = { sid, issue, state, open, atMs } (함수만 - 규칙에 match가 없어 앱은 못 읽고 못 쓴다)
//   앱이 보는 표시는 spaces/{sid}/claudeRequests/{itemId} = { state, issue, url, note, atMs } (개인 공간 - 그 사람이 읽는다)
const CLAUDE = 'v5claude';
// GitHub 토큰(이 저장소만 - 이슈 쓰기·Actions 읽기)과 보내도 되는 계정 메일(쉼표로). 배포할 때 정한다(docs/CLAUDE-REQUEST.md).
// 메일 목록은 코드에 적지 않는다 - 저장소가 공개다(배포가 functions/.env.<프로젝트>에 적는다, git 무시).
const GITHUB_TOKEN = defineSecret('CLAUDE_GITHUB_TOKEN');
const OWNER_EMAILS = defineString('CLAUDE_OWNER_EMAILS', { description: 'Claude요청 메모를 보내도 되는 구글 메일 (쉼표로)' });

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

export const v5SendDueAlarms = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Asia/Seoul', retryCount: 0, secrets: [GITHUB_TOKEN] },
  async () => {
    await sendDueAlarms();
    // Claude 요청 진행 - 알림이 먼저, 실패해도 알림에 번지지 않게
    await checkClaudeRequests().catch((err) => logger.warn('Claude 요청 확인 실패', { error: String(err?.message || err) }));
  },
);

async function sendDueAlarms() {
  const now = Date.now();
  const due = await db.collection(ALARMS).where('pendingAt', '<=', now).limit(300).get();
  if (due.empty) return;
  const messaging = getMessaging();
  for (const doc of due.docs) {
    const alarm = doc.data();
    // 먼저 '보냄'으로 바꾼다 - 앞 회차가 아직 돌고 있어도 두 번 보내지 않게(그 사이 바뀌었으면 건너뛴다)
    // 건너뛸 때도 까닭을 남긴다 - 휴대폰에 안 왔을 때 로그만 보고 가려내게(10-14 '보냄'이 없어 운영 자료를 읽어야 했다)
    try {
      await doc.ref.update({ sent: true, pendingAt: null, sentAt: now }, { lastUpdateTime: doc.updateTime });
    } catch (err) {
      logger.info('알림 건너뜀 - 그 사이 바뀜', { id: doc.id, error: String(err?.message || err) });
      continue;
    }
    if (typeof alarm.atMs === 'number' && alarm.atMs < now - ALARM_WINDOW_MS) {
      logger.info('알림 건너뜀 - 너무 늦음', { id: doc.id, atMs: alarm.atMs });
      continue;
    }
    const tokens = (await Promise.all((alarm.recipients || []).map(tokensOf))).flat();
    if (tokens.length === 0) {
      logger.info('알림 건너뜀 - 받는 사람 기기 토큰 없음', { id: doc.id, recipients: (alarm.recipients || []).length });
      continue;
    }
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
    const errors = res.responses.filter((r) => !r.success).map((r) => r.error?.code || 'unknown');
    logger.info('알림 보냄', { id: doc.id, tokens: tokens.length, ok: res.successCount, fail: res.failureCount, removed: dead.length, errors });
  }
}

// 오래된 칸 정리 (알림 시각이 30일 넘게 지난 것) - 하루 한 번
export const v5CleanupAlarms = onSchedule({ schedule: 'every day 04:10', timeZone: 'Asia/Seoul', retryCount: 0 }, async () => {
  const old = await db.collection(ALARMS).where('atMs', '<', Date.now() - 30 * 24 * ALARM_WINDOW_MS).limit(400).get();
  if (old.empty) return;
  const batch = db.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  logger.info('지난 알림 칸 지움', { count: old.size });
});

// ───────────────────────── Claude 요청 (10-16) ─────────────────────────

async function github(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    // 매분 알림 함수 안에서도 돈다 - 오래 붙잡지 않게
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN.value()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'school-planner-v5-functions',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method || 'GET'} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

/** 상태를 두 곳에 (함수 칸 + 앱이 보는 칸) */
async function setClaudeState(sid, itemId, fields) {
  const batch = db.batch();
  const open = !FINAL_STATES.includes(fields.state);
  batch.set(db.collection(CLAUDE).doc(itemId), { ...fields, sid, open, updatedAt: Date.now() }, { merge: true });
  batch.set(
    db.collection('spaces').doc(sid).collection('claudeRequests').doc(itemId),
    { ...fields, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
}

export const v5ClaudeRequest = onDocumentWritten({ document: 'spaces/{sid}/items/{itemId}', secrets: [GITHUB_TOKEN] }, async (event) => {
  const { sid, itemId } = event.params;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  // 거의 모든 저장은 여기서 끝난다 - 라벨을 새로 붙인 개인 공간 메모만 (읽기 없음)
  const added = newLabelIds(sid, before, after);
  if (added.length === 0) return;
  const labels = await Promise.all(added.map((id) => db.collection('spaces').doc(sid).collection('labels').doc(id).get()));
  if (!labels.some((l) => l.exists && !l.data().deletedAt && isClaudeLabelName(l.data().name))) return;
  // 이 앱을 쓰는 다른 선생님은 보낼 수 없다 - 정한 계정만 (사용자 결정 10-16)
  const user = await getAuth()
    .getUser(sid.slice(2))
    .catch(() => null);
  if (!isAllowedEmail(user?.email, OWNER_EMAILS.value())) {
    logger.info('Claude 요청 건너뜀 - 정한 계정이 아님', { itemId });
    return;
  }
  // 한 번만: 같은 메모가 아직 진행 중이면 다시 보내지 않는다(같은 저장이 두 번 들어와도)
  const ref = db.collection(CLAUDE).doc(itemId);
  const atMs = Date.now();
  const go = await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (cur.exists && cur.data().open) return false;
    tx.set(ref, { sid, state: 'sending', issue: null, open: true, atMs, updatedAt: atMs });
    return true;
  });
  if (!go) return;
  try {
    const { title, body } = issueOf(after.text, Array.isArray(after.attachments) ? after.attachments.length : 0);
    // 라벨이 없으면 만든다(처음 한 번 - 이미 있으면 422)
    await github('/labels', { method: 'POST', body: JSON.stringify({ name: ISSUE_LABEL, color: 'd97706', description: '앱 메모에서 온 Claude 요청' }) }).catch(
      () => {},
    );
    const issue = await github('/issues', { method: 'POST', body: JSON.stringify({ title, body, labels: [ISSUE_LABEL] }) });
    await setClaudeState(sid, itemId, { state: 'sent', issue: issue.number, url: issue.html_url, note: '', atMs });
    logger.info('Claude 요청 보냄', { itemId, issue: issue.number });
  } catch (err) {
    await setClaudeState(sid, itemId, { state: 'failed', issue: null, url: null, note: '요청을 보내지 못했습니다.', atMs });
    logger.error('Claude 요청 보내기 실패', { itemId, error: String(err?.message || err) });
  }
});

/** 진행 중인 요청마다 GitHub를 읽어 상태를 맞춘다 (매분 - 진행 중인 것이 없으면 읽기 하나) */
async function checkClaudeRequests() {
  const open = await db.collection(CLAUDE).where('open', '==', true).limit(10).get();
  if (open.empty) return;
  const now = Date.now();
  for (const doc of open.docs) {
    const req = doc.data();
    if (!req.issue) {
      // 이슈를 만드는 사이 함수가 끊겼다 - 오래되면 실패로
      if (now - (req.atMs || 0) > 10 * 60 * 1000) await setClaudeState(req.sid, doc.id, { state: 'failed', note: '요청을 보내지 못했습니다.' });
      continue;
    }
    try {
      const issue = await github(`/issues/${req.issue}`);
      const comments = await github(`/issues/${req.issue}/comments?per_page=100`);
      const merged = (issue.labels || []).some((l) => l?.name === 'claude-merged');
      const sha = merged ? mergeShaOf(comments) : null;
      const runs = sha ? ((await github(`/actions/runs?head_sha=${sha}&per_page=20`)).workflow_runs ?? []) : null;
      const next = statusFromGithub({ issue, comments, runs, atMs: req.atMs, nowMs: now });
      if (next.state !== req.state || next.note !== (req.note ?? '')) {
        await setClaudeState(req.sid, doc.id, { state: next.state, note: next.note });
        logger.info('Claude 요청 상태', { itemId: doc.id, issue: req.issue, state: next.state });
      }
    } catch (err) {
      logger.warn('Claude 요청 읽기 실패', { itemId: doc.id, error: String(err?.message || err) });
    }
  }
}

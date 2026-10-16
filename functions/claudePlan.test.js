// claudePlan.js 시험 - `npm run test:functions`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askedNow, isClaudeLabelName, issueOf, mergeShaOf, resultNoteOf, statusFromGithub, REQUEST_TIMEOUT_MS } from './claudePlan.js';

test('라벨 이름 - 그림 글자·띄어쓰기·대소문자는 보지 않는다', () => {
  for (const n of ['Claude요청', 'claude 요청', '🤖 Claude요청', 'CLAUDE 요청']) assert.equal(isClaudeLabelName(n), true, n);
  for (const n of ['Claude', '요청', 'Claude요청함', '', null]) assert.equal(isClaudeLabelName(n), false, String(n));
});

test('요청 단추를 누른 쓰기만 - 저장(라벨 붙이기·글 고치기)으로는 보내지 않는다', () => {
  const note = { kind: 'note', text: '고쳐 줘', labelIds: ['a'], deletedAt: null };
  const asked = { ...note, claudeAskAt: 100 };
  assert.equal(askedNow('u_1', null, note), false);
  assert.equal(askedNow('u_1', { ...note, labelIds: [] }, note), false);
  assert.equal(askedNow('u_1', note, asked), true);
  assert.equal(askedNow('u_1', null, asked), true);
  assert.equal(askedNow('u_1', asked, { ...asked, text: '더 고쳐 줘' }), false);
  assert.equal(askedNow('u_1', asked, { ...asked, claudeAskAt: 200 }), true);
  assert.equal(askedNow('g_1', note, asked), false);
  assert.equal(askedNow('u_1', note, { ...asked, kind: 'event' }), false);
  assert.equal(askedNow('u_1', note, { ...asked, deletedAt: 1 }), false);
  assert.equal(askedNow('u_1', note, { ...asked, text: '  ' }), false);
  assert.equal(askedNow('u_1', asked, null), false);
});

test('이슈 - 첫 줄 제목, 글만', () => {
  const { title, body } = issueOf('\n주간 화면 글자를 키워 줘\n둘째 줄', 2);
  assert.equal(title, '메모 요청: 주간 화면 글자를 키워 줘');
  assert.match(body, /^주간 화면 글자를 키워 줘\n둘째 줄\n/);
  assert.match(body, /첨부 2개/);
  assert.equal(issueOf('가'.repeat(70)).title, `메모 요청: ${'가'.repeat(60)}…`);
});

test('댓글에서 결과 글·합친 커밋', () => {
  const comments = [{ body: '처음' }, { body: '<!-- sp5-result -->\n글자를 키웠습니다.\n<!-- sp5-merge-sha:abc1234def -->' }];
  assert.equal(resultNoteOf(comments), '글자를 키웠습니다.');
  assert.equal(mergeShaOf(comments), 'abc1234def');
  assert.equal(mergeShaOf([{ body: '없음' }]), null);
});

test('상태 - 라벨·배포 결과·시간 초과', () => {
  const at = 1_000_000;
  const now = at + 60_000;
  const issue = (labels, state = 'open') => ({ state, labels: labels.map((name) => ({ name })) });
  assert.equal(statusFromGithub({ issue: issue([]), atMs: at, nowMs: now }).state, 'sent');
  assert.equal(statusFromGithub({ issue: issue(['claude-working']), atMs: at, nowMs: now }).state, 'working');
  assert.equal(statusFromGithub({ issue: issue(['claude-merged'], 'closed'), runs: [], atMs: at, nowMs: now }).state, 'merged');
  const deployed = [{ name: 'CI', status: 'completed', conclusion: 'success' }, { name: 'Deploy to Firebase Hosting on merge', status: 'completed', conclusion: 'success' }];
  assert.equal(statusFromGithub({ issue: issue(['claude-merged'], 'closed'), runs: deployed, atMs: at, nowMs: now }).state, 'deployed');
  const cancelled = [{ name: 'Deploy to Firebase Hosting on merge', status: 'completed', conclusion: 'cancelled' }];
  assert.equal(statusFromGithub({ issue: issue(['claude-merged']), runs: cancelled }).state, 'deployed');
  const ciRed = [{ name: 'CI', status: 'completed', conclusion: 'failure' }];
  assert.equal(statusFromGithub({ issue: issue(['claude-merged']), runs: ciRed }).state, 'failed');
  const failed = statusFromGithub({ issue: issue(['claude-failed']), comments: [{ body: '<!-- sp5-result -->\n테스트 실패' }] });
  assert.deepEqual(failed, { state: 'failed', note: '테스트 실패' });
  assert.equal(statusFromGithub({ issue: issue(['claude-nochange']) }).state, 'nochange');
  assert.equal(statusFromGithub({ issue: issue([], 'closed') }).state, 'failed');
  assert.equal(statusFromGithub({ issue: issue(['claude-working']), atMs: at, nowMs: at + REQUEST_TIMEOUT_MS + 1 }).state, 'failed');
});

test('보내도 되는 계정 - 목록 안에서만, 대소문자·띄어쓰기는 보지 않는다', async () => {
  const { isAllowedEmail } = await import('./claudePlan.js');
  const list = ' a@x.com, B@x.com ,c@x.com';
  assert.equal(isAllowedEmail('a@x.com', list), true);
  assert.equal(isAllowedEmail('b@X.com', list), true);
  assert.equal(isAllowedEmail('d@x.com', list), false);
  assert.equal(isAllowedEmail('', list), false);
  assert.equal(isAllowedEmail(null, list), false);
  assert.equal(isAllowedEmail('a@x.com', ''), false);
});

test('한 번에 하나 - 도는 것이 있으면 기다리고, 없으면 가장 먼저 기다린 것', async () => {
  const { nextToDispatch } = await import('./claudePlan.js');
  assert.equal(nextToDispatch([]), null);
  assert.equal(nextToDispatch([{ id: 'a', state: 'queued', atMs: 2 }, { id: 'b', state: 'queued', atMs: 1 }]), 'b');
  assert.equal(nextToDispatch([{ id: 'a', state: 'working', atMs: 1 }, { id: 'b', state: 'queued', atMs: 2 }]), null);
  assert.equal(nextToDispatch([{ id: 'a', state: 'sending' }, { id: 'b', state: 'queued' }]), null);
  // 합친 뒤(배포 중)에는 다음을 보낸다
  assert.equal(nextToDispatch([{ id: 'a', state: 'merged', atMs: 1 }, { id: 'b', state: 'queued', atMs: 2 }]), 'b');
});

test('Claude요청 라벨 - 있으면 그대로, 같은 이름이면 표시만, 지웠으면 되살림, 없으면 맨 뒤에 새로', async () => {
  const { planClaudeLabel, orderAfterLast } = await import('./claudePlan.js');
  const l = (id, name, extra = {}) => ({ id, kind: 'note', name, order: 'a0', deletedAt: null, ...extra });
  assert.equal(planClaudeLabel([l('x', 'Claude요청', { system: 'claudeRequest' })]), null);
  assert.deepEqual(planClaudeLabel([l('x', '🤖 Claude 요청')]), { action: 'flag', id: 'x' });
  assert.deepEqual(planClaudeLabel([l('x', 'Claude요청', { system: 'claudeRequest', deletedAt: 1 })]), { action: 'restore', id: 'x' });
  assert.deepEqual(planClaudeLabel([l('x', 'Claude요청', { deletedAt: 1 })]), { action: 'restore', id: 'x' });
  // 일정 라벨은 보지 않는다
  assert.deepEqual(planClaudeLabel([{ ...l('e', 'Claude요청'), kind: 'event' }, l('m', '수업', { order: 'a1' })]), { action: 'create', order: 'a1V' });
  assert.equal(orderAfterLast([]), 'a0');
  assert.equal(orderAfterLast(['a0', 'a2', 'a1V']), 'a2V');
});

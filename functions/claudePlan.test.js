// claudePlan.js 시험 - `npm run test:functions`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isClaudeLabelName, issueOf, mergeShaOf, newLabelIds, resultNoteOf, statusFromGithub, REQUEST_TIMEOUT_MS } from './claudePlan.js';

test('라벨 이름 - 그림 글자·띄어쓰기·대소문자는 보지 않는다', () => {
  for (const n of ['Claude요청', 'claude 요청', '🤖 Claude요청', 'CLAUDE 요청']) assert.equal(isClaudeLabelName(n), true, n);
  for (const n of ['Claude', '요청', 'Claude요청함', '', null]) assert.equal(isClaudeLabelName(n), false, String(n));
});

test('새로 붙은 라벨만 - 개인 공간 메모, 글이 있을 때', () => {
  const note = { kind: 'note', text: '고쳐 줘', labelIds: ['a', 'b'], deletedAt: null };
  assert.deepEqual(newLabelIds('u_1', null, note), ['a', 'b']);
  assert.deepEqual(newLabelIds('u_1', { ...note, labelIds: ['a'] }, note), ['b']);
  assert.deepEqual(newLabelIds('u_1', note, { ...note, text: '더 고쳐 줘' }), []);
  // 지웠던 메모를 되살리면 붙은 라벨이 다 새로
  assert.deepEqual(newLabelIds('u_1', { ...note, deletedAt: 1 }, note), ['a', 'b']);
  assert.deepEqual(newLabelIds('g_1', null, note), []);
  assert.deepEqual(newLabelIds('u_1', null, { ...note, kind: 'event' }), []);
  assert.deepEqual(newLabelIds('u_1', null, { ...note, deletedAt: 1 }), []);
  assert.deepEqual(newLabelIds('u_1', null, { ...note, text: '  ' }), []);
  assert.deepEqual(newLabelIds('u_1', note, null), []);
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

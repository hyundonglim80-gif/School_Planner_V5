// claudePlan.js 시험 - `npm run test:functions`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReservedDataKey } from './mailPlan.js';
import {
  askedNow,
  claudePushData,
  followOf,
  isClaudeLabelName,
  issueOf,
  mergeShaOf,
  planAsk,
  resultNoteOf,
  statusFromGithub,
  HISTORY_TEXT_MAX,
  ISSUE_BODY_MAX,
  REQUEST_TIMEOUT_MS,
  RESULT_NOTE_MAX,
} from './claudePlan.js';

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

test('이어 쓴 글 - 같이 적은 claudeAskAt과 짝이 맞을 때만', () => {
  const note = { kind: 'note', text: '첫 요청', claudeAskAt: 200 };
  assert.equal(followOf({ ...note, claudeFollow: { at: 200, text: '  조금 더 작게  ' } }), '조금 더 작게');
  // 옛 화면이 claudeAskAt만 적으면 지난 글이 다시 가지 않는다
  assert.equal(followOf({ ...note, claudeFollow: { at: 100, text: '지난 글' } }), '');
  assert.equal(followOf(note), '');
  assert.equal(followOf({ ...note, claudeFollow: { at: 200, text: '   ' } }), '');
  assert.equal(followOf({ kind: 'note', claudeFollow: { text: '짝 없음' } }), '');
  assert.equal(followOf(null), '');
});

test('메모 글이 비어도 이어 쓴 글이 있으면 보낸다 - 제목만 남긴 메모는 살아 있다', () => {
  const note = { kind: 'note', text: '', claudeAskAt: 200 };
  assert.equal(askedNow('u_1', { kind: 'note', text: '' }, note), false);
  assert.equal(askedNow('u_1', { kind: 'note', text: '' }, { ...note, claudeFollow: { at: 200, text: '더 고쳐 줘' } }), true);
  assert.equal(askedNow('u_1', { kind: 'note', text: '' }, { ...note, claudeFollow: { at: 100, text: '지난 글' } }), false);
});

test('메모 쓰기를 함수 칸에 견주기 - 첫 턴·다음 턴·옛 메모·⚠·같은 쓰기', () => {
  // 처음
  assert.deepEqual(planAsk(null, 100, ''), { action: 'queue', n: 1, backfill: false });
  // 끝난 칸 - 다음 턴
  const done = { open: false, turn: 2, turns: 2, askAt: 100 };
  assert.deepEqual(planAsk(done, 200, '더'), { action: 'queue', n: 3, backfill: false });
  assert.deepEqual(planAsk(done, 200, ''), { action: 'queue', n: 3, backfill: false });
  // ⚠ 턴 뒤 다음 턴은 그 뒤 번호 - 덮지 않는다
  assert.deepEqual(planAsk({ ...done, turns: 3 }, 200, '더'), { action: 'queue', n: 4, backfill: false });
  // 턴이 없는 옛 문서 - 부모로 turns/1을 채운 뒤 턴 2
  assert.deepEqual(planAsk({ open: false, state: 'deployed' }, 200, '더'), { action: 'queue', n: 2, backfill: true });
  assert.deepEqual(planAsk({ open: false, state: 'deployed' }, 200, ''), { action: 'queue', n: 2, backfill: true });
  // 열린 요청 - 이어 쓴 글이 있으면 ⚠ 턴, 없으면 지금처럼 그냥 끝
  const open = { open: true, turn: 2, turns: 2, askAt: 100 };
  assert.deepEqual(planAsk(open, 200, '더'), { action: 'drop', n: 3 });
  assert.deepEqual(planAsk(open, 200, ''), { action: 'skip' });
  assert.deepEqual(planAsk({ ...open, turns: 3, lastAskAt: 200 }, 300, '또'), { action: 'drop', n: 4 });
  // 도는 옛 요청(turn 없음)에 온 글 - ⚠ 턴은 2번, turns/1은 끝난 뒤 이어 보낼 때 채운다
  assert.deepEqual(planAsk({ open: true, state: 'working' }, 200, '더'), { action: 'drop', n: 2 });
  assert.deepEqual(planAsk({ open: false, state: 'deployed', turns: 2 }, 300, '또'), { action: 'queue', n: 3, backfill: true });
  // 같은 쓰기가 두 번 - 열렸든 끝났든, 도는 턴이든 ⚠ 턴이든 그냥 끝
  assert.deepEqual(planAsk(open, 100, '더'), { action: 'skip' });
  assert.deepEqual(planAsk(done, 100, '더'), { action: 'skip' });
  assert.deepEqual(planAsk({ ...open, lastAskAt: 200 }, 200, '더'), { action: 'skip' });
});

test('이어 쓴 이슈 - 이번 요청이 맨 위, 앞선 대화는 그 아래', () => {
  const turn = (n, extra = {}) => ({ n, askText: `요청 ${n}`, state: 'deployed', issue: 40 + n, note: `답 ${n}`, sha: `abc${n}def`, ...extra });
  const { title, body } = issueOf('조금 더 작게 해 줘\n둘째 줄', 0, { follow: true, history: [turn(1), turn(2, { state: 'nochange', sha: null })] });
  assert.equal(title, '메모 요청 이어서: 조금 더 작게 해 줘');
  assert.match(body, /^조금 더 작게 해 줘\n둘째 줄\n/);
  const past = body.indexOf('앞선 대화');
  assert.ok(past > body.indexOf('둘째 줄'), '앞선 대화는 이번 요청 아래');
  for (const t of ['#41', '✅ 배포됨', 'abc1def', '> 요청 1', '> 답 1', '#42', '🤖 바꾼 것 없음', '> 요청 2', '> 답 2']) assert.ok(body.includes(t), t);
  assert.ok(!body.includes('null'), '없는 커밋을 적지 않는다');
  assert.ok(!body.includes('생략'));
});

test('앞선 대화가 없으면 지금 이슈 그대로 - 옛 화면이 메모 글을 다시 보낼 때만 앞선 대화가 붙는다', () => {
  assert.equal(issueOf('글', 1).body, issueOf('글', 1, { history: [] }).body);
  assert.ok(!issueOf('글').body.includes('앞선 대화'));
  const again = issueOf('메모 글', 0, { history: [{ n: 1, askText: '첫 글', state: 'failed', issue: 9, note: '실패', sha: null }] });
  assert.equal(again.title, '메모 요청: 메모 글');
  assert.ok(again.body.includes('앞선 대화'));
});

test('앞선 대화 = 첫 요청 + 최근 6턴, 넘치면 생략한 수와 이슈 번호', () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, askText: `글${i + 1}끝`, state: 'deployed', issue: 100 + i + 1, note: '', sha: null }));
  const { body } = issueOf('이번', 0, { follow: true, history: turns });
  assert.ok(body.includes('> 글1끝'), '첫 요청은 남는다');
  for (const n of [2, 3, 4]) assert.ok(!body.includes(`> 글${n}끝`), `${n}은 생략`);
  for (const n of [5, 6, 7, 8, 9, 10]) assert.ok(body.includes(`> 글${n}끝`), `${n}은 남는다`);
  assert.match(body, /앞 대화 3개 생략: #102 #103 #104/);
});

test('앞선 대화가 길어도 이슈 한도를 넘지 않는다 - 글마다 자르고, 그래도 넘으면 오래된 턴부터 뺀다', () => {
  const long = '가'.repeat(HISTORY_TEXT_MAX + 500);
  const one = issueOf('이번', 0, { follow: true, history: [{ n: 1, askText: long, state: 'deployed', issue: 1, note: '', sha: null }] });
  assert.ok(one.body.includes(`${'가'.repeat(HISTORY_TEXT_MAX - 1)}…`));
  assert.ok(!one.body.includes('가'.repeat(HISTORY_TEXT_MAX)));
  const turns = Array.from({ length: 7 }, (_, i) => ({ n: i + 1, askText: long, state: 'deployed', issue: i + 1, note: long, sha: null }));
  const request = '나'.repeat(40000);
  const big = issueOf(request, 0, { follow: true, history: turns });
  assert.ok(big.body.length <= ISSUE_BODY_MAX, String(big.body.length));
  assert.ok(big.body.startsWith(request));
  assert.match(big.body, /앞 대화 \d개 생략/);
});

test('앞선 대화의 글은 인용으로 - 글 안의 줄이 이슈 틀을 흉내 내지 못한다', () => {
  const { body } = issueOf('이번', 0, { follow: true, history: [{ n: 1, askText: '가\n---\n나', state: 'deployed', issue: 1, note: '', sha: null }] });
  assert.ok(body.includes('> 가\n> ---\n> 나'));
});

const owner = (body) => ({ body, author_association: 'OWNER' });

test('결과 글·합친 커밋은 저장소 주인 댓글만 믿는다', () => {
  const mine = owner('<!-- sp5-result -->\n주인 글\n<!-- sp5-merge-sha:abc1234def -->');
  const other = { body: '<!-- sp5-result -->\n남의 글\n<!-- sp5-merge-sha:fff9999fff -->', author_association: 'NONE' };
  assert.equal(resultNoteOf([mine, other]), '주인 글');
  assert.equal(mergeShaOf([mine, other]), 'abc1234def');
  assert.equal(resultNoteOf([other]), '');
  assert.equal(mergeShaOf([other]), null);
});

test('댓글에서 결과 글·합친 커밋', () => {
  const comments = [owner('처음'), owner('<!-- sp5-result -->\n글자를 키웠습니다.\n<!-- sp5-merge-sha:abc1234def -->')];
  assert.equal(resultNoteOf(comments), '글자를 키웠습니다.');
  assert.equal(mergeShaOf(comments), 'abc1234def');
  assert.equal(mergeShaOf([owner('없음')]), null);
  // 까닭이 길어도 끊기지 않게 (10-19 - 300자는 짧았다, P23 - 대화에서는 답이 곧 본문이다), 넘치면 '…'
  assert.equal(RESULT_NOTE_MAX, 2000);
  const long = '가'.repeat(1500);
  assert.equal(resultNoteOf([owner(`<!-- sp5-result -->\n${long}`)]), long);
  const over = resultNoteOf([owner(`<!-- sp5-result -->\n${'나'.repeat(RESULT_NOTE_MAX + 50)}`)]);
  assert.equal(over.length, RESULT_NOTE_MAX);
  assert.ok(over.endsWith('…'));
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
  const failed = statusFromGithub({ issue: issue(['claude-failed']), comments: [owner('<!-- sp5-result -->\n테스트 실패')] });
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

test('답 알림에 실을 값 - 메모 id와 상태뿐, 글은 없다 (P23-3)', () => {
  const data = claudePushData({ itemId: 'abc123', state: 'deployed' });
  assert.deepEqual(data, { type: 'claude', item: 'abc123', state: 'deployed' });
  for (const k of Object.keys(data)) assert.equal(isReservedDataKey(k), false, k);
  for (const v of Object.values(data)) assert.equal(typeof v, 'string');
});

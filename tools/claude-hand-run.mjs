// 메모로 Claude 요청 - 함수 손 실행 (P23-1 ■2. P13 ■3은 같은 것을 돌리고 스크립트를 남기지 않았다).
// 함수 에뮬레이터를 켜지 않고 v5ClaudeRequest.run(event)·v5SendDueAlarms.run()을 Firestore·Auth 에뮬레이터에 곧바로 돌린다 -
// 트랜잭션은 진짜고, GitHub만 globalThis.fetch를 바꿔 흉내 낸다(운영 코드에 시험용 길을 넣지 않는다).
//
//   node tools/claude-hand-run.mjs            (에뮬레이터 8080·9099가 켜져 있어야 한다)
//
// 심는 자료는 계정 claude-hand-run 아래뿐이고 끝에 걷는다. 도중에 끄면 다음 실행이 먼저 걷는다.
import { createRequire } from 'node:module';

const UID = 'claude-hand-run';
const SID = `u_${UID}`;
const EMAIL = 'claude-hand-run@example.test';
const LABEL = 'hand-label';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'schoolplannerv3';
process.env.CLAUDE_GITHUB_TOKEN = 'fake';
process.env.CLAUDE_OWNER_EMAILS = EMAIL;

// ───────────── 가짜 GitHub ─────────────

const DEPLOY = 'Deploy to Firebase Hosting on merge';
const gh = { issues: new Map(), next: 1000, failCreate: false };

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith('https://api.github.com/')) return realFetch(url, init);
  const path = u.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, '');
  const method = init.method ?? 'GET';
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (method === 'POST' && path === '/labels') return json(422, { message: 'already_exists' });
  if (method === 'POST' && path === '/issues') {
    if (gh.failCreate) return json(500, { message: 'fake failure' });
    const { title, body, labels } = JSON.parse(init.body);
    const number = gh.next++;
    const issue = { number, title, body, state: 'open', labels: labels.map((name) => ({ name })), html_url: `https://github.com/fake/fake/issues/${number}`, comments: [], runs: [] };
    gh.issues.set(number, issue);
    return json(201, issue);
  }
  const comments = /^\/issues\/(\d+)\/comments/.exec(path);
  if (comments) return json(200, gh.issues.get(Number(comments[1])).comments);
  const one = /^\/issues\/(\d+)$/.exec(path);
  if (one) return json(200, gh.issues.get(Number(one[1])));
  const runs = /^\/actions\/runs\?head_sha=([0-9a-f]+)/.exec(path);
  if (runs) return json(200, { workflow_runs: [...gh.issues.values()].find((i) => i.sha === runs[1])?.runs ?? [] });
  return json(404, { message: `fake: ${method} ${path}` });
};

const lastIssue = () => [...gh.issues.values()].at(-1);
const issueCount = () => gh.issues.size;

/** 워크플로가 하는 것 - 라벨·결과 댓글 (함수는 주인 댓글만 믿는다) */
function working(issue) {
  issue.labels.push({ name: 'claude-working' });
}
function merged(issue, note, sha, { deployed = true } = {}) {
  issue.labels = [{ name: 'claude-request' }, { name: 'claude-merged' }];
  issue.state = 'closed';
  issue.sha = sha;
  issue.comments.push({ author_association: 'OWNER', body: `<!-- sp5-result -->\n${note}\n<!-- sp5-merge-sha:${sha} -->` });
  issue.runs = deployed ? [{ name: 'CI', status: 'completed', conclusion: 'success' }, { name: DEPLOY, status: 'completed', conclusion: 'success' }] : [];
}
function nochange(issue, note) {
  issue.labels = [{ name: 'claude-request' }, { name: 'claude-nochange' }];
  issue.state = 'closed';
  issue.comments.push({ author_association: 'OWNER', body: `<!-- sp5-result -->\n${note}` });
}

// ───────────── 준비 ─────────────

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { v5ClaudeRequest, v5SendDueAlarms } = await import('../functions/index.js');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const db = getFirestore();

const items = db.collection('spaces').doc(SID).collection('items');
const fn = (id) => db.collection('v5claude').doc(id);
const shown = (id) => db.collection('spaces').doc(SID).collection('claudeRequests').doc(id);
const turnRef = (id, n) => shown(id).collection('turns').doc(String(n));
const read = async (ref) => (await ref.get()).data() ?? null;
const turnCount = async (id) => (await shown(id).collection('turns').get()).size;

let fails = 0;
let checks = 0;
const out = (line) => process.stderr.write(`${line}\n`);
function check(name, ok, detail) {
  checks++;
  if (ok) return;
  fails++;
  out(`  ✗ ${name}${detail === undefined ? '' : ` - ${JSON.stringify(detail)}`}`);
}
const eq = (name, got, want) => check(name, got === want, { got, want });
const part = (title) => out(`■ ${title}`);

/** 메모에 쓰고 트리거를 손으로 부른다. 돌려준 event로 같은 쓰기를 한 번 더 부를 수 있다 */
async function write(id, patch) {
  const ref = items.doc(id);
  const before = (await ref.get()).data() ?? null;
  await ref.set(patch, { merge: true });
  const after = (await ref.get()).data();
  const event = { params: { sid: SID, itemId: id }, data: { before: { exists: !!before, data: () => before }, after: { exists: true, data: () => after } } };
  await v5ClaudeRequest.run(event);
  return event;
}
const again = (event) => v5ClaudeRequest.run(event);
/** 매분 함수 한 번 */
const tick = () => v5SendDueAlarms.run({});
let clock = Date.now();
const nextAt = () => ++clock;
const note = (id, text) => write(id, { kind: 'note', text, labelIds: [LABEL], deletedAt: null, claudeAskAt: nextAt() });
const follow = (id, text) => {
  const at = nextAt();
  return write(id, { claudeAskAt: at, claudeFollow: { at, text } });
};

async function cleanup() {
  await db.recursiveDelete(db.collection('spaces').doc(SID));
  const mine = await db.collection('v5claude').where('sid', '==', SID).get();
  await Promise.all(mine.docs.map((d) => d.ref.delete()));
  await db.collection('v5claudeMeta').doc('labels').delete();
  await getAuth()
    .deleteUser(UID)
    .catch(() => {});
}

await cleanup();
const stranger = await db.collection('v5claude').where('open', '==', true).get();
if (!stranger.empty) {
  out(`에뮬레이터에 다른 열린 요청이 있습니다(${stranger.docs.map((d) => d.id).join(', ')}) - 지우고 다시 돌리세요.`);
  process.exit(1);
}
await getAuth().createUser({ uid: UID, email: EMAIL, emailVerified: true });
await db.collection('spaces').doc(SID).collection('labels').doc(LABEL).set({ kind: 'note', name: 'Claude요청', system: 'claudeRequest', deletedAt: null });

// ───────────── 갈래 ─────────────

part('1 첫 요청 - 메모 글이 이슈로, 턴 1');
await note('hand-a', '첫 요청 글');
eq('이슈 하나', issueCount(), 1);
const i1 = lastIssue();
eq('제목', i1.title, '메모 요청: 첫 요청 글');
check('앞선 대화 없음', !i1.body.includes('앞선 대화'));
{
  const f = await read(fn('hand-a'));
  const p = await read(shown('hand-a'));
  const t = await read(turnRef('hand-a', 1));
  eq('함수 칸 turn', f.turn, 1);
  eq('함수 칸 state', f.state, 'sent');
  eq('부모 turns', p.turns, 1);
  eq('부모 state', p.state, 'sent');
  eq('부모 issue', p.issue, i1.number);
  eq('턴 글 = 보낼 때의 메모 글', t.askText, '첫 요청 글');
  eq('턴 state', t.state, 'sent');
  eq('턴 issue', t.issue, i1.number);
  check('턴에 atMs를 적지 않는다', !('atMs' in t));
}
working(i1);
await tick();
eq('고치는 중이 턴에', (await read(turnRef('hand-a', 1))).state, 'working');
merged(i1, '버튼을 옮겼습니다.', 'abc1234def', { deployed: false });
await tick();
eq('배포 중', (await read(turnRef('hand-a', 1))).state, 'merged');
eq('합친 커밋이 턴에', (await read(turnRef('hand-a', 1))).sha, 'abc1234def');
check('배포 중은 열려 있다', (await read(fn('hand-a'))).open === true);
i1.runs = [{ name: 'CI', status: 'completed', conclusion: 'success' }, { name: DEPLOY, status: 'completed', conclusion: 'success' }];
await tick();
{
  const t = await read(turnRef('hand-a', 1));
  eq('턴 끝', t.state, 'deployed');
  eq('답 글', t.note, '버튼을 옮겼습니다.');
  eq('부모 = 마지막 턴', (await read(shown('hand-a'))).state, 'deployed');
  eq('함수 칸 닫힘', (await read(fn('hand-a'))).open, false);
  // 새 답 (P23-3) - 끝 상태가 되는 쓰기에만, 앱이 보는 칸에만
  const p = await read(shown('hand-a'));
  check('끝나면 부모에 답한 때', typeof p.answeredAt === 'number');
  check('답한 때는 턴·함수 칸에 적지 않는다', !('answeredAt' in t) && !('answeredAt' in (await read(fn('hand-a')))));
  await tick();
  eq('다음 매분에도 답한 때는 그대로', (await read(shown('hand-a'))).answeredAt, p.answeredAt);
  // 앱이 본 값을 그대로 적는다 - 다음 쓰기들이 지우지 않아야 한다
  await shown('hand-a').update({ seenAt: p.answeredAt });
}

part('2 이어 보내기 - 이어 쓴 글이 이슈로, 앞선 대화가 함께, 첫 턴은 그대로');
await write('hand-a', { text: '메모 글을 고침' });
eq('메모 글 저장으로는 보내지 않는다', issueCount(), 1);
await follow('hand-a', '조금 더 작게 해 줘');
eq('새 이슈', issueCount(), 2);
const i2 = lastIssue();
eq('제목', i2.title, '메모 요청 이어서: 조금 더 작게 해 줘');
check('이번 요청이 맨 위', i2.body.startsWith('조금 더 작게 해 줘'), i2.body.slice(0, 40));
for (const t of ['앞선 대화', '> 첫 요청 글', '> 버튼을 옮겼습니다.', `#${i1.number}`, '✅ 배포됨', 'abc1234def']) check(`본문에 ${t}`, i2.body.includes(t), i2.body);
check('고친 메모 글은 가지 않는다', !i2.body.includes('메모 글을 고침'));
{
  const f = await read(fn('hand-a'));
  const p = await read(shown('hand-a'));
  const t2 = await read(turnRef('hand-a', 2));
  const t1 = await read(turnRef('hand-a', 1));
  eq('턴 2', f.turn, 2);
  eq('부모 turns', p.turns, 2);
  eq('부모 note 비움', p.note, '');
  eq('부모 sha 비움', p.sha, null);
  eq('턴 2 글', t2.askText, '조금 더 작게 해 줘');
  eq('턴 2 issue', t2.issue, i2.number);
  eq('첫 턴 글 그대로', t1.askText, '첫 요청 글');
  eq('첫 턴 답 그대로', t1.note, '버튼을 옮겼습니다.');
  check('이어 보내도 앱이 본 값이 남는다', p.seenAt === p.answeredAt);
}

part('3 도는 중 보내기 - 글을 ⚠ 턴으로 남기고, 도는 턴은 그대로');
await follow('hand-a', '도는 중에 쓴 글');
eq('이슈는 늘지 않는다', issueCount(), 2);
{
  const f = await read(fn('hand-a'));
  const p = await read(shown('hand-a'));
  const t3 = await read(turnRef('hand-a', 3));
  eq('⚠ 턴 state', t3.state, 'dropped');
  eq('⚠ 턴 글', t3.askText, '도는 중에 쓴 글');
  eq('도는 턴은 2', f.turn, 2);
  eq('함수 칸 turns', f.turns, 3);
  eq('함수 칸 state', f.state, 'sent');
  eq('부모 state는 도는 턴', p.state, 'sent');
  eq('부모 turns', p.turns, 3);
}
working(i2);
await tick();
eq('턴 2가 움직인다', (await read(turnRef('hand-a', 2))).state, 'working');
eq('⚠ 턴은 그대로', (await read(turnRef('hand-a', 3))).state, 'dropped');
nochange(i2, '무엇을 작게 할까요? 글자인가요, 버튼인가요?');
await tick();
eq('턴 2 끝', (await read(turnRef('hand-a', 2))).state, 'nochange');
{
  const p = await read(shown('hand-a'));
  check('다음 답은 본 때보다 늦다 = 새 답', p.answeredAt > p.seenAt);
}
eq('⚠ 턴은 끝나도 그대로', (await read(turnRef('hand-a', 3))).state, 'dropped');
await follow('hand-a', '글자를 작게');
const i3 = lastIssue();
eq('다음 턴은 ⚠ 뒤 번호', (await read(fn('hand-a'))).turn, 4);
eq('턴 4 글', (await read(turnRef('hand-a', 4))).askText, '글자를 작게');
eq('⚠ 턴을 덮지 않는다', (await read(turnRef('hand-a', 3))).state, 'dropped');
check('⚠ 글은 앞선 대화에 없다 - Claude가 본 적이 없다', !i3.body.includes('도는 중에 쓴 글'), i3.body);
check('앞 턴의 물음이 앞선 대화에', i3.body.includes('> 무엇을 작게 할까요?'), i3.body);
merged(i3, '글자를 줄였습니다.', 'bbb2222');
await tick();
await tick();

part('4 같은 쓰기 두 번 - 줄·이어 쓴 글·⚠·끝난 뒤 모두 하나');
const eFirst = await note('hand-b', '둘째 메모');
const beforeB = issueCount();
await again(eFirst);
eq('첫 요청 두 번 = 이슈 하나', issueCount(), beforeB);
eq('⚠ 턴이 생기지 않는다', await turnCount('hand-b'), 1);
const iB = lastIssue();
merged(iB, '답', 'ccc3333');
await tick();
const eFollow = await follow('hand-b', '이어서');
const iB2 = lastIssue();
await again(eFollow);
eq('이어 쓴 글 두 번 = 이슈 하나', issueCount(), beforeB + 1);
eq('턴 둘', await turnCount('hand-b'), 2);
const eDrop = await follow('hand-b', '도는 중');
await again(eDrop);
eq('⚠ 쓰기 두 번 = ⚠ 턴 하나', await turnCount('hand-b'), 3);
eq('함수 칸 turns', (await read(fn('hand-b'))).turns, 3);
merged(iB2, '답 둘', 'ddd4444');
await tick();
eq('끝남', (await read(fn('hand-b'))).open, false);
await again(eFollow);
eq('끝난 뒤 늦게 온 같은 쓰기도 다시 돌지 않는다', issueCount(), beforeB + 1);
eq('턴이 늘지 않는다', await turnCount('hand-b'), 3);

part('5 옛 메모 - 턴이 없는 문서에 이어 보내면 부모로 첫 턴을 채운다');
await items.doc('hand-c').set({ kind: 'note', text: '옛 메모 글', labelIds: [LABEL], deletedAt: null, claudeAskAt: 1 });
await fn('hand-c').set({ sid: SID, state: 'deployed', issue: 77, open: false, atMs: 1, updatedAt: 1 });
await shown('hand-c').set({ state: 'deployed', issue: 77, url: 'https://github.com/fake/fake/issues/77', note: '옛 답', atMs: 1 });
await follow('hand-c', '옛 메모에 이어서');
{
  const t1 = await read(turnRef('hand-c', 1));
  const t2 = await read(turnRef('hand-c', 2));
  const body = lastIssue().body;
  eq('첫 턴 issue', t1.issue, 77);
  eq('첫 턴 state', t1.state, 'deployed');
  eq('첫 턴 답', t1.note, '옛 답');
  eq('첫 턴 글 = 지금 메모 글', t1.askText, '옛 메모 글');
  eq('둘째 턴', t2.askText, '옛 메모에 이어서');
  eq('부모 turns', (await read(shown('hand-c'))).turns, 2);
  check('앞선 대화에 옛 답', body.includes('#77') && body.includes('> 옛 답'), body);
}
merged(lastIssue(), '답', 'eee5555');
await tick();

part('6 배포 순간 돌던 요청 - turn이 없으면 지금 길 그대로, 턴 문서가 생기지 않는다');
await items.doc('hand-d').set({ kind: 'note', text: '돌던 요청', labelIds: [LABEL], deletedAt: null, claudeAskAt: 1 });
{
  const res = await fetch('https://api.github.com/repos/x/y/issues', { method: 'POST', body: JSON.stringify({ title: '돌던', body: '돌던', labels: ['claude-request'] }) });
  const issue = await res.json();
  const live = gh.issues.get(issue.number);
  working(live);
  await fn('hand-d').set({ sid: SID, state: 'sent', issue: issue.number, open: true, atMs: Date.now(), updatedAt: 1 });
  await shown('hand-d').set({ state: 'sent', issue: issue.number, url: live.html_url, note: '', atMs: 1 });
  await tick();
  eq('옛 요청 진행', (await read(shown('hand-d'))).state, 'working');
  merged(live, '옛 요청 끝', 'fff6666');
  await tick();
  eq('옛 요청 끝', (await read(shown('hand-d'))).state, 'deployed');
  eq('턴 문서 없음', await turnCount('hand-d'), 0);
}
await items.doc('hand-e').set({ kind: 'note', text: '줄에 있던 옛 요청', labelIds: [LABEL], deletedAt: null, claudeAskAt: 1 });
await fn('hand-e').set({ sid: SID, state: 'queued', issue: null, open: true, atMs: 1, updatedAt: 1 });
await tick();
eq('줄에 있던 옛 요청 = 메모 글로 보냄', lastIssue().title, '메모 요청: 줄에 있던 옛 요청');
eq('줄에 있던 옛 요청 표시', (await read(shown('hand-e'))).state, 'sent');
eq('턴 문서 없음', await turnCount('hand-e'), 0);
merged(lastIssue(), '답', '0006666');
await tick();

part('7 옛 화면 - claudeAskAt만 적으면 지난 이어 쓴 글이 다시 가지 않고 메모 글이 간다');
{
  const count = issueCount();
  await write('hand-a', { claudeAskAt: nextAt() });
  eq('새 이슈', issueCount(), count + 1);
  const issue = lastIssue();
  eq('제목', issue.title, '메모 요청: 메모 글을 고침');
  check('메모 글이 맨 위', issue.body.startsWith('메모 글을 고침'), issue.body.slice(0, 40));
  check('앞선 대화는 붙는다', issue.body.includes('앞선 대화'));
  eq('턴 5 글 = 메모 글', (await read(turnRef('hand-a', 5))).askText, '메모 글을 고침');
  merged(issue, '답', '1117777');
  await tick();
}

part('8 줄 - 다른 메모가 도는 동안 이어 쓴 글은 기다리고, 끝나면 그 글로 간다');
await note('hand-f', '도는 메모');
const iF = lastIssue();
{
  const count = issueCount();
  await follow('hand-a', '기다린 글');
  eq('기다린다', issueCount(), count);
  eq('턴이 줄에', (await read(turnRef('hand-a', 6))).state, 'queued');
  eq('부모가 줄에', (await read(shown('hand-a'))).state, 'queued');
  merged(iF, '답', '2228888');
  await tick();
  eq('앞이 끝나 보냄', issueCount(), count + 1);
  eq('기다린 글이 간다', lastIssue().title, '메모 요청 이어서: 기다린 글');
  eq('턴이 보냄', (await read(turnRef('hand-a', 6))).state, 'sent');
  merged(lastIssue(), '답', '3339999');
  await tick();
}

part('9 보내기 실패 - 턴에 실패가 남고, 글도 남고, 다음 말을 보낼 수 있다');
gh.failCreate = true;
await note('hand-g', '실패할 요청');
gh.failCreate = false;
{
  const t = await read(turnRef('hand-g', 1));
  eq('턴 실패', t.state, 'failed');
  eq('턴 글 남음', t.askText, '실패할 요청');
  check('보내기 실패도 답한 때', typeof (await read(shown('hand-g'))).answeredAt === 'number');
  eq('닫힘', (await read(fn('hand-g'))).open, false);
  await follow('hand-g', '다시 보냄');
  eq('턴 2 보냄', (await read(turnRef('hand-g', 2))).state, 'sent');
  check('실패도 앞선 대화에', lastIssue().body.includes('❌ 실패'), lastIssue().body);
  merged(lastIssue(), '답', '4440000');
  await tick();
}

part('10 메모 글이 빈 메모 · 보내기 전에 지운 메모');
await write('hand-g', { text: '' });
{
  const count = issueCount();
  await follow('hand-g', '글 없는 메모에 이어서');
  eq('이어 쓴 글이면 메모 글이 비어도 간다', issueCount(), count + 1);
  const running = lastIssue();
  // 앞 요청이 도는 동안 줄에 섰다가, 보내기 전에 지운다
  await note('hand-h', '지울 메모');
  await items.doc('hand-h').set({ deletedAt: 1 }, { merge: true });
  merged(running, '답', '5551111');
  await tick();
  eq('지운 메모는 보내지 않는다', issueCount(), count + 1);
  eq('턴에 까닭', (await read(turnRef('hand-h', 1))).state, 'nochange');
  eq('턴 글은 남는다', (await read(turnRef('hand-h', 1))).askText, '지울 메모');
  await tick();
}

await cleanup();
out(`\n${fails === 0 ? '통과' : `틀림 ${fails}개`} (${checks}개 봄)`);
process.exit(fails === 0 ? 0 : 1);

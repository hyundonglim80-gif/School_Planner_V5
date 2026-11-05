// functions/claudePlan.js - 메모로 Claude에게 고칠 것 보내기의 계산 부분 (사용자 요청 10-16).
// Firebase·GitHub에 기대지 않는 순수 함수 - claudePlan.test.js가 본다(`npm run test:functions`).
//
// 흐름: 개인 공간 메모에 'Claude요청' 라벨을 붙여 저장 → 함수가 GitHub 이슈(라벨 claude-request)를 만든다
//   → .github/workflows/claude-request.yml에서 Claude가 고친다 → 확인(lint·테스트·빌드) → PR을 만들고 바로 합친다
//   → main CI → 화면 배포(firebase-hosting-merge.yml). 매분 도는 함수가 이슈 라벨·배포 결과를 읽어 앱의 표시를 바꾼다.
// 이슈 라벨(워크플로가 단다): claude-working(고치는 중) · claude-merged(합침 - 댓글에 합친 커밋) · claude-nochange · claude-failed

export const REPO = 'hyundonglim80-gif/School_Planner_V5';
export const ISSUE_LABEL = 'claude-request';
/** 이 시간이 지나도 끝나지 않으면 실패로 본다 */
export const REQUEST_TIMEOUT_MS = 3 * 60 * 60 * 1000;
/** 끝난 상태 - 매분 확인에서 뺀다 */
export const FINAL_STATES = ['deployed', 'nochange', 'failed'];
/** firebase-hosting-merge.yml·ci.yml의 name */
export const DEPLOY_WORKFLOW = 'Deploy to Firebase Hosting on merge';
export const CI_WORKFLOW = 'CI';
export const MERGE_MARK = 'sp5-merge-sha:';
export const RESULT_MARK = '<!-- sp5-result -->';

/** 라벨 이름이 'Claude요청'인가 ('Claude 요청'·'🤖 claude요청'도 - 그림 글자·띄어쓰기·대소문자는 보지 않는다) */
export function isClaudeLabelName(name) {
  const plain = String(name ?? '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
  return plain === 'claude요청';
}

/**
 * 이어 쓴 글 (P23 - 메모의 claudeFollow = { at, text }). 앱이 claudeAskAt과 같은 값을 at에 적어 짝을 맞춘다 -
 * 옛 화면(설치 앱)이 claudeAskAt만 적으면 지난 글이 다시 가지 않고 메모 글이 간다.
 */
export function followOf(after) {
  const f = after?.claudeFollow;
  if (!f || typeof after.claudeAskAt !== 'number' || f.at !== after.claudeAskAt) return '';
  return String(f.text ?? '').trim();
}

/**
 * 이번 쓰기가 '🤖 요청' 누르기인가 (10-16 사용자 요청 - 저장으로는 보내지 않고, 사용자가 정한 때 단추로).
 * 앱이 메모의 claudeAskAt(누른 때 ms)만 바꿔 적는다 - 그 값이 새로 생기거나 바뀐 쓰기만. 개인 공간·메모·지우지 않음·글이 있음.
 * 이어 쓴 글이 있으면 메모 글은 비어도 된다(P23 - 제목만 남긴 메모는 살아 있고, 이어 쓰는 말은 메모 글을 쓰지 않는다).
 */
export function askedNow(sid, before, after) {
  if (typeof sid !== 'string' || !sid.startsWith('u_')) return false;
  if (!after || after.kind !== 'note' || after.deletedAt) return false;
  if (typeof after.claudeAskAt !== 'number' || after.claudeAskAt === before?.claudeAskAt) return false;
  return !!String(after.text ?? '').trim() || !!followOf(after);
}

/**
 * 메모 쓰기 하나를 함수 칸(v5claude/{itemId})에 견주어 할 일 (P23) - 표는 docs/PLAN.md 5장 'P23-1 ■0 확인'.
 * cur = 지금 칸(없으면 null), askAt = 이번 claudeAskAt, follow = 이어 쓴 글(없으면 '').
 *  - { action: 'skip' }: 같은 쓰기가 두 번 왔거나(열렸든 끝났든), 열린 요청이 있는데 이어 쓴 글이 없다(지금처럼 말없이)
 *  - { action: 'drop', n }: 열린 요청이 있는데 이어 쓴 글이 왔다 - 글을 잃지 않게 ⚠ 턴 n (도는 턴은 그대로)
 *  - { action: 'queue', n, backfill }: 턴 n으로 줄에 세운다. backfill = 턴이 없는 옛 문서 - 부모로 turns/1을 먼저 채운다
 * 번호는 turns(⚠ 턴까지 쓴 마지막 번호) 다음 - turn(도는 턴)만 보면 다음 턴이 ⚠ 턴을 덮는다.
 */
export function planAsk(cur, askAt, follow) {
  if (cur && (cur.askAt === askAt || cur.lastAskAt === askAt)) return { action: 'skip' };
  const n = (cur?.turns ?? cur?.turn ?? (cur ? 1 : 0)) + 1;
  if (cur?.open) return follow ? { action: 'drop', n } : { action: 'skip' };
  return { action: 'queue', n, backfill: !!cur && typeof cur.turn !== 'number' };
}

/** 앞선 대화에 넣는 턴 수 - 첫 요청 + 최근 몇 턴 (이슈 한도와 Claude 토큰 때문에 다 넣지 않는다) */
export const HISTORY_RECENT = 6;
/** 앞선 대화의 글 하나(요청·답) 길이 */
export const HISTORY_TEXT_MAX = 3000;
/** 이슈 본문 한도 (GitHub는 65536자 - 틀 글자 몫을 남긴다) */
export const ISSUE_BODY_MAX = 60000;

/** 글자 수로 자른다 (넘치면 '…') */
const clip = (text, max) => {
  const t = String(text ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
/** 인용으로 - 글 안의 '---'·제목 줄이 이슈 틀을 흉내 내지 못한다 */
const quote = (text) =>
  text
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n');

/** 앞 턴의 표시 - 앱 카드와 같은 말 (앞 턴은 끝났거나 배포 중이다) */
const TURN_STATE = { merged: '🤖 배포 중', deployed: '✅ 배포됨', nochange: '🤖 바꾼 것 없음', failed: '❌ 실패' };

function turnBlock(t) {
  const head = [t.n === 1 ? '첫 요청' : `${t.n}번째 요청`, t.issue ? `#${t.issue}` : '', TURN_STATE[t.state] ?? t.state, t.sha ? `합친 커밋 ${t.sha}` : '']
    .filter(Boolean)
    .join(' · ');
  const ask = clip(t.askText, HISTORY_TEXT_MAX);
  const note = clip(t.note, HISTORY_TEXT_MAX);
  return [`### ${head}`, ...(ask ? [quote(ask)] : []), ...(note ? ['', '답:', quote(note)] : []), ''].join('\n');
}

/** 앞선 대화 줄들 - 첫 요청 + 최근 턴. room을 넘으면 오래된 턴부터 생략으로 넘긴다 */
function historyLines(history, room) {
  if (!history?.length) return [];
  const [first, ...rest] = history;
  const recent = rest.slice(-HISTORY_RECENT);
  const omitted = rest.slice(0, rest.length - recent.length);
  const render = () => {
    const nums = omitted.filter((t) => t.issue).map((t) => `#${t.issue}`);
    return [
      '',
      '---',
      '## 앞선 대화 (맥락일 뿐입니다 - 고칠 것은 위 요청뿐입니다)',
      '',
      turnBlock(first),
      ...(omitted.length ? [`(앞 대화 ${omitted.length}개 생략${nums.length ? `: ${nums.join(' ')}` : ''})`, ''] : []),
      ...recent.map(turnBlock),
    ];
  };
  let lines = render();
  while (recent.length > 0 && lines.join('\n').length > room) {
    omitted.push(recent.shift());
    lines = render();
  }
  return lines;
}

/**
 * 이슈 제목·본문. 저장소가 공개라 메모 글만 보낸다(공간·계정 id·첨부는 보내지 않는다).
 * P23: follow = 메모 안에서 이어 쓴 말(제목이 다르다) · history = 앞 턴들(이번 요청이 맨 위, 그 아래에 앞선 대화).
 * 이슈 하나 = 턴 하나라 맥락은 새 이슈 본문으로 건넨다 - 워크플로가 본문을 프롬프트에 넣는다.
 */
export function issueOf(text, attachments = 0, { follow = false, history = [] } = {}) {
  const body = String(text ?? '').trim();
  const first = body.split('\n').find((l) => l.trim()) ?? '';
  const short = first.trim().slice(0, 60);
  const title = `${follow ? '메모 요청 이어서' : '메모 요청'}: ${short}${first.trim().length > 60 ? '…' : ''}`;
  const lines = [body, ...historyLines(history, ISSUE_BODY_MAX - body.length - 200), '', '---', '앱 메모에 Claude요청 라벨을 붙여 저장해 저절로 만든 요청입니다.'];
  if (attachments > 0) lines.push(`(메모의 첨부 ${attachments}개는 보내지 않았습니다.)`);
  return { title, body: lines.join('\n') };
}

/** 답 알림에 실을 값 (P23-3 - FCM data는 글자만). 글은 싣지 않는다 - 쪽지·대화와 같다. 앱 public/sw.js 'claude' 갈래가 읽는다 */
export function claudePushData({ itemId, state }) {
  return { type: 'claude', item: String(itemId), state: String(state) };
}

/** 결과 글 길이 - 앱 메모 카드·수정 칸에 글로 보인다 (10-19 - 300자는 까닭이 중간에 끊겼다, P23 - 대화에서는 답이 곧 본문이다. 워크플로 자르기와 함께) */
export const RESULT_NOTE_MAX = 2000;

/** 워크플로가 저장소 주인 토큰으로 단 댓글만 - 공개 이슈라 누구나 같은 표시를 적을 수 있다 */
const ownerComments = (comments) => (comments ?? []).filter((c) => c?.author_association === 'OWNER');

/** 마지막 결과 댓글의 글 (바꾼 것·바꾸지 않은 까닭 - 넘치면 '…') */
export function resultNoteOf(comments) {
  const last = ownerComments(comments).reverse().find((c) => String(c?.body ?? '').includes(RESULT_MARK));
  if (!last) return '';
  const text = String(last.body)
    .replace(RESULT_MARK, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  return clip(text, RESULT_NOTE_MAX);
}

/** 합친 커밋 (워크플로가 댓글에 '<!-- sp5-merge-sha:… -->'로 남긴다) */
export function mergeShaOf(comments) {
  for (const c of ownerComments(comments).reverse()) {
    const m = new RegExp(`${MERGE_MARK}([0-9a-f]{7,40})`).exec(String(c?.body ?? ''));
    if (m) return m[1];
  }
  return null;
}

/**
 * GitHub에서 읽은 것으로 지금 상태 - { state, note }.
 * issue = { state, labels: [{ name }] }, comments = [{ body }], runs = 합친 커밋의 workflow_runs(합친 뒤에만) [{ name, status, conclusion }].
 */
export function statusFromGithub({ issue, comments = [], runs = null, atMs, nowMs }) {
  const labels = new Set((issue?.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name)));
  const note = resultNoteOf(comments);
  if (labels.has('claude-failed')) return { state: 'failed', note: note || '고치지 못했습니다.' };
  if (labels.has('claude-nochange')) return { state: 'nochange', note: note || '바꾼 것이 없습니다(Claude가 까닭을 남기지 않았습니다 - 표시를 눌러 실행 기록을 보세요).' };
  const late = typeof atMs === 'number' && typeof nowMs === 'number' && nowMs - atMs > REQUEST_TIMEOUT_MS;
  if (labels.has('claude-merged')) {
    const deploy = (runs ?? []).find((r) => r?.name === DEPLOY_WORKFLOW);
    const ci = (runs ?? []).find((r) => r?.name === CI_WORKFLOW);
    // 잇달아 합치면 앞 배포는 취소되고 뒤 배포에 함께 올라간다(hosting-live concurrency)
    if (deploy?.status === 'completed' && ['success', 'cancelled'].includes(deploy.conclusion)) return { state: 'deployed', note };
    if (deploy?.status === 'completed') return { state: 'failed', note: '합쳤지만 배포가 실패했습니다.' };
    if (ci?.status === 'completed' && ci.conclusion !== 'success' && !deploy) return { state: 'failed', note: '합쳤지만 main CI가 실패했습니다.' };
    if (late) return { state: 'failed', note: '배포를 기다리다 시간이 지났습니다.' };
    return { state: 'merged', note };
  }
  if (issue?.state === 'closed') return { state: 'failed', note: '이슈가 닫혔습니다.' };
  if (late) return { state: 'failed', note: '시간이 지나도 끝나지 않았습니다.' };
  if (labels.has('claude-working')) return { state: 'working', note: '' };
  return { state: 'sent', note: '' };
}

/**
 * 보내도 되는 계정인가 - 정한 메일 목록(쉼표로) 안에 있을 때만 (사용자 결정 10-16 - 세 계정).
 * 목록은 코드에 적지 않는다: 저장소가 공개라 배포 때 정하는 값(CLAUDE_OWNER_EMAILS, functions/.env - git 무시)으로.
 * 목록이 비었으면 아무도 보내지 못한다.
 */
export function isAllowedEmail(email, list) {
  const allowed = String(list ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const me = String(email ?? '').trim().toLowerCase();
  return me !== '' && allowed.includes(me);
}

// ───────────── 한 번에 하나 (10-16 사용자 질문 - 앞 요청이 끝나야 다음을 보낸다) ─────────────
// 함수가 메모를 받으면 'queued'로 두고, 앞 요청이 GitHub에서 도는 동안(sending·sent·working)은 보내지 않는다.
// 앞 요청이 합쳐지거나(merged - 배포는 따로 돈다) 끝나면 가장 먼저 기다린 것을 보낸다(그때의 메모 글로).

/** 지금 GitHub에서 도는 상태 - 이것이 있으면 다음을 보내지 않는다 */
export const BUSY_STATES = ['sending', 'sent', 'working'];

/** 다음에 보낼 요청 id (도는 것이 있거나 기다리는 것이 없으면 null) - reqs = 열린 요청 [{ id, state, atMs }] */
export function nextToDispatch(reqs) {
  const list = reqs ?? [];
  if (list.some((r) => BUSY_STATES.includes(r.state))) return null;
  const queued = list.filter((r) => r.state === 'queued').sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0) || String(a.id).localeCompare(String(b.id)));
  return queued[0]?.id ?? null;
}

// ───────────── 'Claude요청' 라벨을 정한 계정에 (10-16 사용자 요청 - 지우지 못하게) ─────────────

export const CLAUDE_LABEL_NAME = 'Claude요청';
export const CLAUDE_LABEL_SYSTEM = 'claudeRequest';

/** 맨 뒤 차례 값 (domain/order 모양 - 가장 큰 값 뒤에 글자 하나를 붙이면 그보다 크고 맞는 값이다) */
export function orderAfterLast(orders) {
  const live = (orders ?? []).filter((o) => typeof o === 'string' && o);
  if (live.length === 0) return 'a0';
  return live.reduce((a, b) => (b > a ? b : a)) + 'V';
}

/**
 * 그 계정의 메모 라벨(지운 것도)을 보고 할 일 - null(이미 있음) | { action: 'flag'|'restore', id } | { action: 'create', order }.
 * 이름이 같은 라벨을 사용자가 먼저 만들었으면 그것에 표시만 단다(새로 만들지 않는다).
 */
export function planClaudeLabel(labels) {
  const notes = (labels ?? []).filter((l) => l && l.kind === 'note');
  const live = notes.filter((l) => !l.deletedAt);
  if (live.some((l) => l.system === CLAUDE_LABEL_SYSTEM)) return null;
  const named = live.find((l) => isClaudeLabelName(l.name));
  if (named) return { action: 'flag', id: named.id };
  const gone = notes.find((l) => l.deletedAt && l.system === CLAUDE_LABEL_SYSTEM) ?? notes.find((l) => l.deletedAt && isClaudeLabelName(l.name));
  if (gone) return { action: 'restore', id: gone.id };
  return { action: 'create', order: orderAfterLast(live.map((l) => l.order)) };
}

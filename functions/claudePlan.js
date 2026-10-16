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
 * 이번 저장에서 새로 붙은 라벨 id - 보낼지 볼 메모만(개인 공간·메모·지우지 않음·글이 있음).
 * 라벨을 새로 붙일 때만 보낸다(같은 메모를 고쳐 저장할 때마다 다시 보내지 않게 - 다시 보내려면 라벨을 떼었다 붙인다).
 */
export function newLabelIds(sid, before, after) {
  if (typeof sid !== 'string' || !sid.startsWith('u_')) return [];
  if (!after || after.kind !== 'note' || after.deletedAt) return [];
  if (!String(after.text ?? '').trim()) return [];
  const had = new Set(before && !before.deletedAt && Array.isArray(before.labelIds) ? before.labelIds : []);
  return (Array.isArray(after.labelIds) ? after.labelIds : []).filter((id) => typeof id === 'string' && !had.has(id));
}

/** 이슈 제목·본문. 저장소가 공개라 메모 글만 보낸다(공간·계정 id·첨부는 보내지 않는다) */
export function issueOf(text, attachments = 0) {
  const body = String(text ?? '').trim();
  const first = body.split('\n').find((l) => l.trim()) ?? '';
  const short = first.trim().slice(0, 60);
  const title = `메모 요청: ${short}${first.trim().length > 60 ? '…' : ''}`;
  const lines = [body, '', '---', '앱 메모에 Claude요청 라벨을 붙여 저장해 저절로 만든 요청입니다.'];
  if (attachments > 0) lines.push(`(메모의 첨부 ${attachments}개는 보내지 않았습니다.)`);
  return { title, body: lines.join('\n') };
}

/** 마지막 결과 댓글의 글 (표시 아래 한 줄로 - 300자) */
export function resultNoteOf(comments) {
  const last = [...(comments ?? [])].reverse().find((c) => String(c?.body ?? '').includes(RESULT_MARK));
  if (!last) return '';
  return String(last.body)
    .replace(RESULT_MARK, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
    .slice(0, 300);
}

/** 합친 커밋 (워크플로가 댓글에 '<!-- sp5-merge-sha:… -->'로 남긴다) */
export function mergeShaOf(comments) {
  for (const c of [...(comments ?? [])].reverse()) {
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
  if (labels.has('claude-nochange')) return { state: 'nochange', note: note || '바꾼 것이 없습니다.' };
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

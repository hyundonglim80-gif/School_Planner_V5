// 메모로 Claude에게 고칠 것 보내기 - 메모 카드의 진행 표시 (사용자 요청 10-16, docs/CLAUDE-REQUEST.md).
// 서버 함수(functions/index.js v5ClaudeRequest·매분 확인)가 spaces/{sid}/claudeRequests/{itemId}에 적은 것을 읽기만 한다.

export type ClaudeRequestState = 'queued' | 'sending' | 'sent' | 'working' | 'merged' | 'deployed' | 'nochange' | 'failed';

export interface ClaudeRequest {
  state: ClaudeRequestState;
  issue: number | null;
  url: string | null;
  note: string;
  /** 끝 상태가 된 때 - 함수가 적는다(P23-3). P23-3 전에 끝난 요청에는 없다 */
  answeredAt?: number;
  /** 앱이 본 답의 answeredAt - 기기 시각이 아니라 그 값을 그대로 적어, 기기 시계가 달라도 어긋나지 않는다 */
  seenAt?: number;
}

const STATES: readonly ClaudeRequestState[] = ['queued', 'sending', 'sent', 'working', 'merged', 'deployed', 'nochange', 'failed'];

/** 서버 문서 → 표시할 것 (모양이 틀리면 null) */
export function readClaudeRequest(raw: unknown): ClaudeRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === v.state);
  if (!state) return null;
  const url = typeof v.url === 'string' && v.url.startsWith('https://github.com/') ? v.url : null;
  return {
    state,
    issue: typeof v.issue === 'number' ? v.issue : null,
    url,
    note: typeof v.note === 'string' ? v.note : '',
    ...(typeof v.answeredAt === 'number' ? { answeredAt: v.answeredAt } : {}),
    ...(typeof v.seenAt === 'number' ? { seenAt: v.seenAt } : {}),
  };
}

/** 끝난 요청 - 함수가 다음 말을 받는다. 배포 중(merged)은 아직 열려 있다 */
export const claudeFinished = (state: ClaudeRequestState) => state === 'deployed' || state === 'nochange' || state === 'failed';

/** 아직 안 본 답의 answeredAt, 없으면 null (P23-3 - 메모 카드 '새 답'). 이어 보내 도는 동안은 없다 */
export function claudeNewAnswerAt(r: ClaudeRequest | undefined): number | null {
  if (!r || !claudeFinished(r.state) || r.answeredAt === undefined) return null;
  return r.answeredAt > (r.seenAt ?? 0) ? r.answeredAt : null;
}

/** 이번 받기로 답이 새로 온 메모들 - 앱 안내 (P23-3). 처음 받은 문서는 뺀다(앱을 열 때 있던 답은 카드 '새 답'이 알린다) */
export function claudeAnsweredNow(before: Record<string, ClaudeRequest>, now: Record<string, ClaudeRequest>): string[] {
  return Object.keys(now).filter((id) => {
    const at = claudeNewAnswerAt(now[id]);
    return at !== null && before[id] !== undefined && before[id].answeredAt !== at;
  });
}

/** 주소의 ?claude= 값 (답 알림을 눌러 연 앱 - public/sw.js) - 없거나 메모 id 모양이 아니면 null */
export function claudeParamOf(search: string): string | null {
  const id = new URLSearchParams(search).get('claude');
  return id && /^[A-Za-z0-9]{1,40}$/.test(id) ? id : null;
}

/** 주소에서 ?claude=를 지운다 (새로고침해도 다시 열리지 않게). 다른 값과 # 뒤는 둔다 */
export function stripClaudeParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('claude');
  return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '') + u.hash;
}

/**
 * 결과 글 - 바꾼 것 또는 바꾸지 않은 까닭 (10-19 사용자 의견 - '바꾼 것 없음'만으로는 왜인지 몰랐다).
 * 워크플로 결과 댓글(함수가 옮겨 적은 note)에서 주소와 '합쳤습니다' 머리 줄은 뺀다 - 표시가 이미 말하고, 주소는 표시를 누르면 간다.
 */
export function claudeNoteText(r: Pick<ClaudeRequest, 'note'>): string {
  return r.note
    .replace(/\s*(?:-\s*)?(?:실행 기록\s*)?https?:\/\/\S+/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => !/^합쳤습니다 - 화면 배포는 몇 분 뒤\.?$/.test(l.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 카드 표시 - 글·색·마우스를 올렸을 때 */
export function claudeBadge(r: ClaudeRequest): { text: string; tone: 'wait' | 'ok' | 'bad'; title: string } {
  const text = {
    // 한 번에 하나 - 앞 요청이 합쳐지거나 끝나면 보낸다 (10-16)
    queued: '🤖 차례 기다림',
    sending: '🤖 보냄',
    sent: '🤖 보냄',
    working: '🤖 고치는 중',
    merged: '🤖 배포 중',
    deployed: '✅ 배포됨',
    nochange: '🤖 바꾼 것 없음',
    failed: '❌ 실패',
  }[r.state];
  const tone = r.state === 'deployed' ? 'ok' : r.state === 'failed' || r.state === 'nochange' ? 'bad' : 'wait';
  const head = r.issue ? `Claude 요청 #${r.issue}` : 'Claude 요청';
  const title = [head, r.note].filter(Boolean).join(' - ') + (r.url ? ' (누르면 GitHub에서 자세히)' : '');
  return { text, tone, title };
}

// ─── 메모 안 대화 (P23 - 턴 = 내 요청 하나 + Claude 답 하나 = 이슈 하나, spaces/{sid}/claudeRequests/{itemId}/turns/{n}) ───

/** 이어 쓴 글 한도 - 함수 HISTORY_TEXT_MAX와 같다(넘으면 다음 턴의 앞선 대화에서 잘린다) */
export const CLAUDE_FOLLOW_MAX = 3000;

/** dropped = 앞 요청이 도는 동안 다른 기기에서 보낸 글(함수가 ⚠ 턴으로 남긴다) · asking = 메모에 적었고 턴은 아직 없다(화면에서만) */
export type ClaudeTurnState = ClaudeRequestState | 'dropped' | 'asking';

export interface ClaudeTurn {
  n: number;
  /** 보낸 글 - 첫 턴은 보낼 때 함수가 적는다(그 전에는 빈 글, 턴이 없는 옛 문서도 빈 글) */
  askText: string;
  /** 메모의 claudeAskAt과 같은 값 - 옛 문서를 채운 첫 턴은 null */
  askAt: number | null;
  state: ClaudeTurnState;
  issue: number | null;
  url: string | null;
  note: string;
  /** 고른 모델·노력 (11-08) - 함수가 턴에 적는다. 없으면 기본 */
  run?: ClaudeRun;
}

/** 메모의 칸 가운데 대화에 쓰는 것 */
export interface ClaudeAskFields {
  claudeAskAt?: number;
  claudeFollow?: { at: number; text: string };
  /** 고른 모델·노력 (11-08) - at = 함께 적은 claudeAskAt */
  claudeRun?: { at: number; model: string; effort: string };
}

/** 서버 턴 문서 → 표시할 것 (모양이 틀리면 null) */
export function readClaudeTurn(raw: unknown): ClaudeTurn | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.n !== 'number') return null;
  const shown = v.state === 'dropped' ? readClaudeRequest({ ...v, state: 'failed' }) : readClaudeRequest(v);
  if (!shown) return null;
  return {
    ...shown,
    n: v.n,
    askText: typeof v.askText === 'string' ? v.askText : '',
    askAt: typeof v.askAt === 'number' ? v.askAt : null,
    state: v.state === 'dropped' ? 'dropped' : shown.state,
    // 고른 모델·노력 (11-08) - 그 전 턴·기본으로 보낸 턴에는 없다
    ...(v.model || v.effort ? { run: readClaudeRun(v) } : {}),
  };
}

/**
 * 말풍선으로 그릴 턴들. turns = 받은 턴(받는 중이면 null - 아무것도 그리지 않는다, 부모로 먼저 그리면 턴이 많은 메모가 깜빡인다).
 * 턴이 없는 옛 문서는 부모로 한 턴(P23 전에 보낸 메모 - 옮기지 않는다), 아직 턴이 없는 이어 쓴 글은 '보내는 중' 턴 하나.
 */
export function turnsForView(turns: readonly ClaudeTurn[] | null, req: ClaudeRequest | null, ask: ClaudeAskFields): ClaudeTurn[] {
  if (!turns || !req) return [];
  const list: ClaudeTurn[] = turns.length > 0 ? [...turns].sort((a, b) => a.n - b.n) : [{ n: 1, askText: '', askAt: null, ...req }];
  const follow = ask.claudeFollow;
  if (!follow || follow.at !== ask.claudeAskAt || list.some((t) => t.askAt === follow.at)) return list;
  const run = ask.claudeRun?.at === follow.at ? readClaudeRun(ask.claudeRun) : undefined;
  return [...list, { n: list[list.length - 1].n + 1, askText: follow.text, askAt: follow.at, state: 'asking', issue: null, url: null, note: '', run }];
}

/** 아직 보낼 수 없나 - 메모 하나에 열린 요청은 하나다(도는 중·배포 중·보내는 중, 턴을 받는 중) */
export function claudeBusy(req: ClaudeRequest, turns: readonly ClaudeTurn[] | null, view: readonly ClaudeTurn[]): boolean {
  return !turns || !claudeFinished(req.state) || view.some((t) => t.state === 'asking');
}

/** 말풍선 표시 - 카드와 같은 말. 바꾼 것 없음은 실패 색이 아니다(되물음·답일 수 있다 - P23 프롬프트) */
export function claudeTurnBadge(t: ClaudeTurn): ReturnType<typeof claudeBadge> {
  if (t.state === 'asking') return { text: '🤖 보내는 중', tone: 'wait', title: '곧 차례에 들어갑니다' };
  if (t.state === 'dropped') return { text: '⚠ 보내지 못함', tone: 'bad', title: t.note };
  const b = claudeBadge({ ...t, state: t.state });
  return t.state === 'nochange' ? { ...b, tone: 'wait' } : b;
}

// ─── 모델·노력 고르기 (11-08 사용자 요청 - 'Claude 모델과 노력 정도를 선택할 수 있게') ───
//   앱이 메모에 claudeRun = { at, model, effort }(at = 함께 적는 claudeAskAt)를 적고 → 함수가 이슈 본문 표시 줄로 →
//   워크플로(.github/workflows/claude-request.yml)가 --model·--effort로. 빈 값 = 기본(워크플로가 아무것도 붙이지 않는다).
//   고를 수 있는 값은 함수(functions/claudePlan.js CLAUDE_MODELS·CLAUDE_EFFORTS)·워크플로와 같다 - 하나를 바꾸면 셋 다.

export type ClaudeModel = '' | 'fable' | 'opus' | 'sonnet' | 'haiku';
export type ClaudeEffort = '' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const CLAUDE_MODELS: ReadonlyArray<{ id: ClaudeModel; label: string }> = [
  { id: '', label: '기본' },
  { id: 'fable', label: 'Fable' },
  { id: 'opus', label: 'Opus' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
];
export const CLAUDE_EFFORTS: ReadonlyArray<{ id: ClaudeEffort; label: string }> = [
  { id: '', label: '기본' },
  { id: 'low', label: '낮음' },
  { id: 'medium', label: '보통' },
  { id: 'high', label: '높음' },
  { id: 'xhigh', label: '아주 높음' },
  { id: 'max', label: '최대' },
];

export interface ClaudeRun {
  model: ClaudeModel;
  effort: ClaudeEffort;
}

export const DEFAULT_CLAUDE_RUN: ClaudeRun = { model: '', effort: '' };

/** 모르는 값은 기본으로 (기기 보관·서버 문서 모두) */
export function readClaudeRun(raw: unknown): ClaudeRun {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    model: CLAUDE_MODELS.find((m) => m.id && m.id === v.model)?.id ?? '',
    effort: CLAUDE_EFFORTS.find((e) => e.id && e.id === v.effort)?.id ?? '',
  };
}

/** 말풍선에 붙이는 짧은 글 - 'Opus · 노력 높음'. 둘 다 기본이면 '' */
export function claudeRunLabel(run: ClaudeRun): string {
  const model = CLAUDE_MODELS.find((m) => m.id === run.model);
  const effort = CLAUDE_EFFORTS.find((e) => e.id === run.effort);
  return [run.model && model?.label, run.effort && effort && `노력 ${effort.label}`].filter(Boolean).join(' · ');
}

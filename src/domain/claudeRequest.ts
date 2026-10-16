// 메모로 Claude에게 고칠 것 보내기 - 메모 카드의 진행 표시 (사용자 요청 10-16, docs/CLAUDE-REQUEST.md).
// 서버 함수(functions/index.js v5ClaudeRequest·매분 확인)가 spaces/{sid}/claudeRequests/{itemId}에 적은 것을 읽기만 한다.

export type ClaudeRequestState = 'queued' | 'sending' | 'sent' | 'working' | 'merged' | 'deployed' | 'nochange' | 'failed';

export interface ClaudeRequest {
  state: ClaudeRequestState;
  issue: number | null;
  url: string | null;
  note: string;
}

const STATES: readonly ClaudeRequestState[] = ['queued', 'sending', 'sent', 'working', 'merged', 'deployed', 'nochange', 'failed'];

/** 줄에 있거나 도는 중 - '🤖 요청' 단추를 숨긴다 (합친 뒤 배포 중도 - 끝나면 '다시 요청') */
export function isClaudeRequestOpen(state: ClaudeRequestState): boolean {
  return state !== 'deployed' && state !== 'nochange' && state !== 'failed';
}

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
  };
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

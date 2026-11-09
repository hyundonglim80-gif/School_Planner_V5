// 메모로 Claude 요청 - 마지막에 고른 모델·노력 (11-08 사용자 요청). 이 기기에만(sp5-claude-run) - 다음 요청도 같은 값으로 시작한다.
// 보낼 때 그 값을 메모(claudeRun)에 함께 적는다 - notes/actions askClaude·askClaudeMore.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CLAUDE_RUN, readClaudeRun, type ClaudeRun } from '../../domain/claudeRequest';

export const useClaudeRunPrefs = create<ClaudeRun>()(
  persist((): ClaudeRun => ({ ...DEFAULT_CLAUDE_RUN }), {
    name: 'sp5-claude-run',
    // 옛 값·손댄 값이 이상하면 기본으로
    merge: (persisted, current) => ({ ...current, ...readClaudeRun(persisted) }),
  }),
);

export function setClaudeRun(change: Partial<ClaudeRun>) {
  useClaudeRunPrefs.setState(readClaudeRun({ ...useClaudeRunPrefs.getState(), ...change }));
}

/** 보낼 때 메모에 함께 적는 값 (at = claudeAskAt) */
export function claudeRunField(at: number): { at: number; model: string; effort: string } {
  const { model, effort } = useClaudeRunPrefs.getState();
  return { at, model, effort };
}

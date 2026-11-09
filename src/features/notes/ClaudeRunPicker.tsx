// 메모로 Claude 요청 - 모델·노력 고르기 (11-08 사용자 요청). 🤖 요청 단추 옆·이어서 요청 글 칸 아래.
// 고른 값은 이 기기에 남아 다음 요청도 그 값으로 시작한다(claudeRunPrefs). '기본' = 워크플로가 아무것도 붙이지 않는다(계정 기본 모델·노력).
import { CLAUDE_EFFORTS, CLAUDE_MODELS, type ClaudeEffort, type ClaudeModel } from '../../domain/claudeRequest';
import { setClaudeRun, useClaudeRunPrefs } from './claudeRunPrefs';

const SELECT =
  'rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-2xs font-semibold text-slate-600 cursor-pointer hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50 disabled:cursor-not-allowed';

export default function ClaudeRunPicker({ disabled }: { disabled?: boolean }) {
  const { model, effort } = useClaudeRunPrefs();
  return (
    <span data-claude-run className="inline-flex items-center gap-1">
      <select
        data-claude-run-model={model || 'default'}
        aria-label="Claude 모델"
        title="Claude 모델 - 기본은 계정에 정해진 모델"
        value={model}
        disabled={disabled}
        onChange={(e) => setClaudeRun({ model: e.target.value as ClaudeModel })}
        className={SELECT}
      >
        {CLAUDE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            모델 {m.label}
          </option>
        ))}
      </select>
      <select
        data-claude-run-effort={effort || 'default'}
        aria-label="노력 정도"
        title="노력 정도 - 높을수록 더 깊이 생각하지만 오래 걸리고 사용 한도를 더 씁니다"
        value={effort}
        disabled={disabled}
        onChange={(e) => setClaudeRun({ effort: e.target.value as ClaudeEffort })}
        className={SELECT}
      >
        {CLAUDE_EFFORTS.map((x) => (
          <option key={x.id} value={x.id}>
            노력 {x.label}
          </option>
        ))}
      </select>
    </span>
  );
}

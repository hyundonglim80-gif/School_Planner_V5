// '🤖 요청' 단추 (P13 10-16 사용자 요청) - 'Claude요청' 라벨 메모에서 보낼 때를 사용자가 정한다(저장으로는 보내지 않는다).
// 서버가 정한 계정에만 만드는 잠긴 라벨(system: 'claudeRequest')이 붙은 메모에만 보인다 - 다른 사람에게는 나오지 않는다.
// 요청이 줄에 있거나 도는 동안은 숨고 진행 표시(ClaudeRequestBadge)만, 끝나면 '다시 요청'.
import { isClaudeRequestOpen } from '../../domain/claudeRequest';
import { useClaudeRequests } from '../../data/claudeRequestStore';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import type { ItemDoc } from '../events/eventOps';
import { askClaude } from './actions';

export default function ClaudeAskButton({ item, compact = false }: { item: ItemDoc; compact?: boolean }) {
  const sid = useCurrentSpaceId();
  const labels = useDocs('labels', sid);
  const req = useClaudeRequests((s) => s.byId[item.id]);
  const tagged = (item.labelIds ?? []).some((id) => labels[id]?.system === 'claudeRequest' && !labels[id]?.deletedAt);
  if (!sid || !tagged || !(item.text ?? '').trim() || (req && isClaudeRequestOpen(req.state))) return null;
  const again = !!req;
  return (
    <button
      type="button"
      data-entry-claude-ask
      onClick={(e) => {
        e.stopPropagation();
        if (!window.confirm('이 메모를 Claude에게 보낼까요?\n고친 것은 확인(테스트·빌드)을 통과하면 바로 실제 화면에 배포됩니다.')) return;
        void askClaude(sid, item).catch(() => {});
      }}
      title="이 메모의 글을 Claude에게 보냅니다 (앞 요청이 있으면 차례를 기다립니다)"
      className={`font-bold rounded border whitespace-nowrap shrink-0 cursor-pointer bg-violet-600 text-white border-violet-700 hover:bg-violet-700 ${
        compact ? 'text-2xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      }`}
    >
      🤖 {again ? '다시 요청' : '요청'}
    </button>
  );
}

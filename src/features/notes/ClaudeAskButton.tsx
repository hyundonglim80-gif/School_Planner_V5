// '🤖 요청' 단추 (P13 10-16 사용자 요청) - 메모 수정 칸 아래(삭제 옆). 'Claude요청' 라벨 메모를 보낼 때를 사용자가 정한다(저장으로는 보내지 않는다).
// 서버가 정한 계정에만 만드는 잠긴 라벨(system: 'claudeRequest')이 저장된 메모에 붙어 있을 때만 보인다 - 다른 사람에게는 나오지 않는다.
// 한 번 보낸 메모에는 단추 대신 진행 표시만(다시 요청은 없다 - 사용자 결정 10-16). 저장하지 않은 고침이 있으면 누를 수 없다(저장된 글이 간다).
import { useClaudeRequests } from '../../data/claudeRequestStore';
import { useDocs } from '../../data/select';
import type { ItemDoc } from '../events/eventOps';
import { askClaude } from './actions';
import ClaudeRequestBadge from './ClaudeRequestBadge';

export default function ClaudeAskButton({ sid, item, dirty }: { sid: string; item: ItemDoc; dirty: boolean }) {
  const labels = useDocs('labels', sid);
  const req = useClaudeRequests((s) => s.byId[item.id]);
  const tagged = (item.labelIds ?? []).some((id) => labels[id]?.system === 'claudeRequest' && !labels[id]?.deletedAt);
  if (req) return <ClaudeRequestBadge itemId={item.id} />;
  if (item.claudeAskAt)
    return (
      <span data-note-claude-asked className="text-2xs font-bold text-violet-700" title="보냈습니다 - 곧 진행 표시가 뜹니다">
        🤖 요청함
      </span>
    );
  if (!tagged || !(item.text ?? '').trim()) return null;
  return (
    <button
      type="button"
      data-note-claude-ask
      disabled={dirty}
      onClick={() => {
        if (!window.confirm('이 메모를 Claude에게 보낼까요?\n고친 것은 확인(테스트·빌드)을 통과하면 바로 실제 화면에 배포됩니다.')) return;
        void askClaude(sid, item).catch(() => {});
      }}
      title={dirty ? '고친 것을 먼저 저장하세요 - 저장된 글을 보냅니다' : '저장된 메모 글을 Claude에게 보냅니다 (앞 요청이 있으면 차례를 기다립니다)'}
      className="px-3 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      🤖 요청
    </button>
  );
}

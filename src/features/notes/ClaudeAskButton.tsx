// '🤖 요청' 단추 (P13 10-16 사용자 요청) - 메모 수정 칸 아래(삭제 옆). 'Claude요청' 라벨 메모를 보낼 때를 사용자가 정한다(저장으로는 보내지 않는다).
// 서버가 정한 계정에만 만드는 잠긴 라벨(system: 'claudeRequest')이 저장된 메모에 붙어 있을 때만 보인다 - 다른 사람에게는 나오지 않는다.
// 첫 요청만 - 보낸 뒤로는 메모 칸 안 대화(ClaudeThread·ClaudeFollowBox)에서 진행을 보고 이어서 요청한다(P23 - 10-20 #69 '🤖 다시 요청'을 글 칸으로 바꿈).
// 저장하지 않은 고침이 있으면 누를 수 없다(저장된 글이 간다).
import { useClaudeRequests } from '../../data/claudeRequestStore';
import type { ItemDoc } from '../events/eventOps';
import { askClaude } from './actions';
import { useClaudeTagged } from './useClaudeThread';

export default function ClaudeAskButton({ sid, item, dirty }: { sid: string; item: ItemDoc; dirty: boolean }) {
  const req = useClaudeRequests((s) => s.byId[item.id]);
  const tagged = useClaudeTagged(sid, item);
  if (req) return null;
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
        // 확인 창 없이 바로 보낸다(10-20 사용자 요청 #76) - 누르는 것이 곧 보낼 때다.
        void askClaude(sid, item).catch(() => {});
      }}
      title={dirty ? '고친 것을 먼저 저장하세요 - 저장된 글을 보냅니다' : '저장된 메모 글을 Claude에게 보냅니다 (앞 요청이 있으면 차례를 기다립니다)'}
      className="px-3 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      🤖 요청
    </button>
  );
}

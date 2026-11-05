// 메모 칸 안 Claude 대화의 자료 (P23). 한 번이라도 보낸 메모(요청 표시가 있는 개인 공간 메모)만 턴을 듣는다.
import { useClaudeRequests } from '../../data/claudeRequestStore';
import { useClaudeTurns } from '../../data/claudeRequests';
import { useDocs } from '../../data/select';
import { claudeBusy, turnsForView, type ClaudeTurn } from '../../domain/claudeRequest';
import type { ItemDoc } from '../events/eventOps';

/** 서버가 정한 계정에만 만드는 잠긴 라벨이 이 메모에 붙어 있나 */
export function useClaudeTagged(sid: string, item: ItemDoc | undefined): boolean {
  const labels = useDocs('labels', sid);
  return (item?.labelIds ?? []).some((id) => labels[id]?.system === 'claudeRequest' && !labels[id]?.deletedAt);
}

export interface ClaudeThreadView {
  /** 말풍선으로 그릴 턴 - 턴을 받는 동안은 비어 있다 */
  turns: ClaudeTurn[];
  /** 앞 요청이 아직 끝나지 않아 보내지 못한다 (글은 쓸 수 있다) */
  busy: boolean;
}

/** 대화가 없는 메모는 null */
export function useClaudeThread(sid: string, item: ItemDoc | undefined): ClaudeThreadView | null {
  const req = useClaudeRequests((s) => (item ? s.byId[item.id] : undefined));
  const on = !!item && !!req && sid.startsWith('u_');
  const turns = useClaudeTurns(on ? sid : null, on ? item.id : null);
  if (!on) return null;
  const view = turnsForView(turns, req, item);
  return { turns: view, busy: claudeBusy(req, turns, view) };
}

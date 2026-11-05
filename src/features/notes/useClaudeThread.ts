// 메모 칸 안 Claude 대화의 자료 (P23). 한 번이라도 보낸 메모(요청 표시가 있는 개인 공간 메모)만 턴을 듣는다.
import { useEffect, useRef } from 'react';
import { useClaudeRequests } from '../../data/claudeRequestStore';
import { markClaudeSeen, useClaudeTurns } from '../../data/claudeRequests';
import { useDocs } from '../../data/select';
import { claudeBusy, claudeNewAnswerAt, turnsForView, type ClaudeTurn } from '../../domain/claudeRequest';
import { usePageVisible } from '../../ui/usePageVisible';
import type { ItemDoc } from '../events/eventOps';
import { useShownNoteId } from './open';

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

/** 이 메모 칸을 보고 있으면 새 답을 본 것으로 적는다 (P23-3). 숨은 탭·다른 앱을 보는 동안은 아직 안 본 것이다 */
function useClaudeSeen(sid: string, itemId: string | undefined) {
  const answeredAt = useClaudeRequests((s) => (itemId ? claudeNewAnswerAt(s.byId[itemId]) : null));
  const shown = useShownNoteId(sid) === itemId;
  const visible = usePageVisible();
  // 답 하나에 한 번만 - 쓰기가 거부되면 되돌림이 같은 값으로 여기를 다시 부른다
  const marked = useRef<number | null>(null);
  useEffect(() => {
    if (!itemId || answeredAt === null || !shown || !visible || marked.current === answeredAt) return;
    marked.current = answeredAt;
    void markClaudeSeen(sid, itemId, answeredAt);
  }, [sid, itemId, answeredAt, shown, visible]);
}

/** 대화가 없는 메모는 null */
export function useClaudeThread(sid: string, item: ItemDoc | undefined): ClaudeThreadView | null {
  useClaudeSeen(sid, item?.id);
  const req = useClaudeRequests((s) => (item ? s.byId[item.id] : undefined));
  const on = !!item && !!req && sid.startsWith('u_');
  const turns = useClaudeTurns(on ? sid : null, on ? item.id : null);
  if (!on) return null;
  const view = turnsForView(turns, req, item);
  return { turns: view, busy: claudeBusy(req, turns, view) };
}

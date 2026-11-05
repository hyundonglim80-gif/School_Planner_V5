// Claude 요청 진행 받기 (10-16 - 개인 공간 `claudeRequests/{itemId}`, 서버 함수가 쓴다 - 앱은 본 답의 표시 seenAt만, P23-3).
// 기기 사본에 넣지 않는다: 몇 개 안 되고 함수가 적는 것이라 gcalQueue처럼 바로 구독한다(없으면 읽기 하나).
import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { readClaudeRequest, readClaudeTurn, type ClaudeRequest, type ClaudeTurn } from '../domain/claudeRequest';
import { useClaudeRequests } from './claudeRequestStore';
import { db } from './firebase';
import { usePersonalSpaceId } from './session';

export function watchClaudeRequests(sid: string): () => void {
  const stop = onSnapshot(
    collection(db, 'spaces', sid, 'claudeRequests'),
    (snap) => {
      const byId: Record<string, ClaudeRequest> = {};
      for (const d of snap.docs) {
        const r = readClaudeRequest(d.data());
        if (r) byId[d.id] = r;
      }
      useClaudeRequests.setState({ byId });
    },
    (e) => console.warn('[claude] 요청 진행을 받지 못했습니다.', e),
  );
  return () => {
    stop();
    useClaudeRequests.setState({ byId: {} });
  };
}

/** Shell에 하나 - 내 개인 공간의 요청 진행 */
export function useClaudeRequestsWatch() {
  const sid = usePersonalSpaceId();
  useEffect(() => (sid ? watchClaudeRequests(sid) : undefined), [sid]);
}

/** 이 답을 봤다 (P23-3 - 카드 '새 답'을 뗀다, 다른 기기도). 못 적어도 다음에 칸을 열 때 다시 적는다 */
export async function markClaudeSeen(sid: string, itemId: string, answeredAt: number): Promise<void> {
  await updateDoc(doc(db, 'spaces', sid, 'claudeRequests', itemId), { seenAt: answeredAt }).catch((e) => console.warn('[claude] 본 표시를 적지 못했습니다.', e));
}

/** 칸에 보일 최근 턴 수 - 메모 하나의 대화가 이보다 길어지면 앞은 GitHub 이슈에 남는다 */
const TURNS_SHOWN = 50;

/** 그 메모 칸이 열린 동안만 듣는다(P23 - 부모 문서처럼 늘 들으면 앱을 열 때마다 모든 대화를 받는다). 받기 전 null, 듣지 못하면 빈 목록 */
export function useClaudeTurns(sid: string | null, itemId: string | null): ClaudeTurn[] | null {
  const key = sid && itemId ? `${sid}/${itemId}` : null;
  const [got, setGot] = useState<{ key: string; turns: ClaudeTurn[] } | null>(null);
  useEffect(() => {
    if (!sid || !itemId) return;
    const at = `${sid}/${itemId}`;
    return onSnapshot(
      query(collection(db, 'spaces', sid, 'claudeRequests', itemId, 'turns'), orderBy('n', 'desc'), limit(TURNS_SHOWN)),
      (snap) => setGot({ key: at, turns: snap.docs.flatMap((d) => readClaudeTurn(d.data()) ?? []) }),
      (e) => {
        console.warn('[claude] 대화를 받지 못했습니다.', e);
        setGot({ key: at, turns: [] });
      },
    );
  }, [sid, itemId]);
  return got && got.key === key ? got.turns : null;
}

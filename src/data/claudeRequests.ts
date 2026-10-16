// Claude 요청 진행 받기 (10-16 - 개인 공간 `claudeRequests/{itemId}`, 서버 함수만 쓴다).
// 기기 사본에 넣지 않는다: 몇 개 안 되고 함수가 적는 것이라 gcalQueue처럼 바로 구독한다(없으면 읽기 하나).
import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { readClaudeRequest, type ClaudeRequest } from '../domain/claudeRequest';
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

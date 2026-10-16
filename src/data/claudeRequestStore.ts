// Claude 요청 진행 표시 store (메모 id → 상태). Firebase를 부르지 않는다 - 카드(notes/ClaudeRequestBadge)가 읽고,
// 받기는 data/claudeRequests(Shell에 하나)가 채운다.
import { create } from 'zustand';
import type { ClaudeRequest } from '../domain/claudeRequest';

export const useClaudeRequests = create<{ byId: Record<string, ClaudeRequest> }>(() => ({ byId: {} }));

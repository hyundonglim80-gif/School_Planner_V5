// 대화 표시 store (P19-1 ■2). Firebase를 부르지 않는다 - 머리줄 💬 n·대화 창이 읽고, 받기는 data/chat(Shell에 하나)이 채운다.
import { create } from 'zustand';
import type { ChatRoom } from '../domain/chat';

interface ChatState {
  /** 내가 든 방 - 방 키 → 방 (그룹 전체 방은 첫 글이 오기 전에는 없다) */
  rooms: Record<string, ChatRoom>;
  /** 그룹 방 내 읽음 - 방 키 → 서버 시각(ms). 1:1 읽음은 방 문서 reads에 */
  reads: Record<string, number>;
  /** 서버에서 한 번 받았다 (끊긴 채 연 앱의 '방 없음'과 구별) */
  ready: boolean;
}

export const useChatStore = create<ChatState>(() => ({ rooms: {}, reads: {}, ready: false }));

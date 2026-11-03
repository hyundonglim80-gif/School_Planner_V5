// 대화 받기 (P19-2 ■1) - Shell에 하나(큰 창만 - 새 창(↗)으로 옮긴 대화 창은 스스로 듣는다, ChatWindow).
//   내가 든 방 듣기(data/chat useChatWatch) → store = 대화 창 목록 · 머리줄 💬 n(P19-2 ■3).
//   새 글 안내·?chat=(푸시를 눌러 연 앱)·서비스 워커 'sp5-open-chat'은 P19-2 ■3·P19-3 ■1에서 이 파일에 더한다.
import { useChatWatch } from '../../data/chat';

export function useChatReceiver(): void {
  useChatWatch();
}

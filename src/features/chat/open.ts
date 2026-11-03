// 💬 대화 창 'chat' 열기 (P19-2). 오른쪽 칸 창 하나 - 목록(1:1 · 그룹마다 그룹 전체·고른 사람 방) ↔ 방.
// 여는 길(P19-2 ■3·P19-3): 머리줄 💬 · 계정 칸 · 그룹 창 · 받은 쪽지 '💬 대화로' · 단축키 'chat' · 푸시 알림(?chat=<방 키>).
// (창 목록이 이 파일을 읽으므로 Firebase를 끌어오는 data/session·select·chat은 여기서 부르지 않는다)
import { getWindowDef, openWindow } from '../../app/windows';

export const CHAT_WINDOW = 'chat';

export interface ChatParams {
  /** 그 방을 연다 (방 키 - 그룹 방 '<sid>~<roomId>', 1:1 = pairId). 없으면 목록 */
  room?: string;
  /** 1:1을 연 곳의 그룹 (그룹 창 구성원 칩 💬) - 방이 아직 없으면 그 그룹에 만든다 */
  sid?: string;
}

export function openChat(params: ChatParams = {}) {
  // 창을 등록하지 않은 시험(그룹 창 등)에서도 던지지 않게
  if (getWindowDef(CHAT_WINDOW)) openWindow(CHAT_WINDOW, params);
}

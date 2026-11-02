// 쪽지 표시 store (P15-1 ■2). Firebase를 부르지 않는다 - 머리줄 ✉ n·쪽지 창이 읽고, 받기는 data/mail(Shell에 하나)이 채운다.
import { create } from 'zustand';

interface MailState {
  /** 안 읽은 받은 쪽지 수 - UNREAD_MAX(100)까지만 센다 */
  unread: number;
  /** 서버에서 한 번 받았다 (끊긴 채 연 앱의 0과 구별) */
  ready: boolean;
}

export const useMailStore = create<MailState>(() => ({ unread: 0, ready: false }));

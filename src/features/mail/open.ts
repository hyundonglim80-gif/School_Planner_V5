// ✉ 쪽지 창 'mail' 열기 (P15-2). 오른쪽 칸 창 하나 - 탭: 받은 쪽지 · 보낸 쪽지 · ✏️ 쓰기.
// 여는 길: 머리줄 ✉ · 계정 칸 '✉ 쪽지' · 그룹 창 구성원 칩 ✉(쓰기) · 단축키 'mail' · 푸시 알림(?mail=<id>).
// (창 목록이 이 파일을 읽으므로 Firebase를 끌어오는 data/session·select·mail은 여기서 부르지 않는다)
import { getWindowDef, openWindow } from '../../app/windows';

export const MAIL_WINDOW = 'mail';

export type MailTabId = 'in' | 'sent' | 'write';

export interface MailParams {
  tab?: MailTabId;
  /** 그 쪽지를 펼친다 (푸시 알림을 눌러 열 때 - 받은 쪽지) */
  id?: string;
  /** 쓰기: 그룹 · 받는 사람 (그룹 창 구성원 칩 ✉) */
  sid?: string;
  to?: string[];
}

export function openMail(params: MailParams = {}) {
  // 창을 등록하지 않은 시험(그룹 창 등)에서도 던지지 않게
  if (getWindowDef(MAIL_WINDOW)) openWindow(MAIL_WINDOW, params);
}

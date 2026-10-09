// 알림장 칸 열기 (V4 NoticeDrawer - 오른쪽 쓰는 칸, 공간마다 하나). 쓰는 칸 'notices' = { sid, date, tab? }.
//   sid = 칸을 연 순간의 공간 - 그 공간의 알림장에 저장한다(여는 쪽이 지금 공간을 넣는다).
//   하루 수업 머리줄 📢 = 그날 쓰기 · 학급 화면 도구 카드 = 오늘 쓰기 · 단축키 '알림장 모아 보기'(shortcuts.ts) = 모아 보기.
//   (창 목록이 이 파일을 읽으므로 Firebase를 끌어오는 data/session은 여기서 부르지 않는다 - 시험에서 진짜 Firebase가 뜬다)
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';

export const NOTICE_PANEL = 'notices';

export type NoticeTab = 'write' | 'list';

export interface NoticePanelParams {
  sid?: string;
  date: string;
  tab?: NoticeTab;
}

/** 같은 공간이면 같은 칸 */
export const sameNoticePanel = (a: NoticePanelParams, b: NoticePanelParams) => (a.sid ?? '') === (b.sid ?? '');

export function openNotices(params: NoticePanelParams & { sid: string }) {
  if (!getWindowDef(NOTICE_PANEL)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(NOTICE_PANEL, params);
}

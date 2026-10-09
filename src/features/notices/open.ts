// 알림장 칸 열기 (V4 NoticeDrawer - 오른쪽 쓰는 칸, 공간마다 하나). 쓰는 칸 'notices' = { sid?, date, tab? }.
//   sid = 칸을 연 순간의 공간(없으면 그때 보던 공간) - 그 공간의 알림장에 저장한다.
//   하루 수업 머리줄 📢 = 그날 쓰기 · 학급 화면 도구 카드 = 오늘 쓰기 · 단축키 '알림장 모아 보기' = 모아 보기.
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { useNav } from '../../app/nav';
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';
import { currentSpaceId } from '../../data/session';

export const NOTICE_PANEL = 'notices';

export type NoticeTab = 'write' | 'list';

export interface NoticePanelParams {
  sid?: string;
  date: string;
  tab?: NoticeTab;
}

/** 같은 공간이면 같은 칸 (sid가 없으면 지금 공간) */
export const sameNoticePanel = (a: NoticePanelParams, b: NoticePanelParams) => (a.sid ?? currentSpaceId()) === (b.sid ?? currentSpaceId());

export function openNotices(params: NoticePanelParams) {
  if (!getWindowDef(NOTICE_PANEL)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(NOTICE_PANEL, { ...params, sid: params.sid ?? currentSpaceId() ?? undefined });
}

/** 껍데기에서 한 번 - 단축키 '알림장 모아 보기' = 보는 날의 모아 보기 */
export function useNoticeShortcuts() {
  useEffect(() => setShortcutAction('notices', () => openNotices({ date: useNav.getState().date, tab: 'list' })), []);
}

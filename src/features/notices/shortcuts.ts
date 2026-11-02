// 알림장 단축키 - 껍데기(Shell)가 한 번 건다. '알림장 모아 보기' = 지금 공간·보는 날의 모아 보기
//   창 안 탭 단축키(P18-2 '알림장 → 쓰기') = 지금 공간·보는 날 그 탭
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { useNav } from '../../app/nav';
import { setTabOpener } from '../../app/tabShortcuts';
import { currentSpaceId } from '../../data/session';
import { NOTICE_PANEL, openNotices, type NoticeTab } from './open';

function openAt(tab: NoticeTab) {
  const sid = currentSpaceId();
  if (sid) openNotices({ sid, date: useNav.getState().date, tab });
}

export function useNoticeShortcuts() {
  useEffect(() => setShortcutAction('notices', () => openAt('list')), []);
  useEffect(() => setTabOpener(NOTICE_PANEL, (tab) => openAt(tab as NoticeTab)), []);
}

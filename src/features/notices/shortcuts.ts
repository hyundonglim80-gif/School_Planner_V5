// 알림장 단축키 - 껍데기(Shell)가 한 번 건다. '알림장 모아 보기' = 지금 공간·보는 날의 모아 보기
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { useNav } from '../../app/nav';
import { currentSpaceId } from '../../data/session';
import { openNotices } from './open';

export function useNoticeShortcuts() {
  useEffect(
    () =>
      setShortcutAction('notices', () => {
        const sid = currentSpaceId();
        if (sid) openNotices({ sid, date: useNav.getState().date, tab: 'list' });
      }),
    [],
  );
}

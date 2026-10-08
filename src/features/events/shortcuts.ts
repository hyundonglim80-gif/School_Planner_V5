// 일정 단축키·＋ 새로 (MENU.md 3-8 새 id). 껍데기(Shell)가 한 번 건다 - 단축키 한 곳(app/keys)에 하는 일만 더한다.
//   newEvent = 새 일정 칸 (지금 보는 날 - 메모·학급 화면이면 오늘). 칸을 연 순간의 공간에 저장한다.
//   forwarding = 하루 화면 오늘로 가서 '📥 지난 일정' 줄을 편다 (V4는 창 - MENU 3-8 '여는 곳이 바뀜').
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { goToday, setScope, useNav } from '../../app/nav';
import { showToast } from '../../app/toast';
import { isDatelessScope } from '../../app/route';
import { todayStr } from '../../domain/dateUtils';
import { currentSpaceId } from '../../data/session';
import { setPastRowOpen, staleCountNow } from './forward';
import { openEventPanel } from './open';

export function openNewEvent() {
  const sid = currentSpaceId();
  if (!sid) return;
  const { scope, date } = useNav.getState();
  openEventPanel({ sid, date: isDatelessScope(scope) ? todayStr() : date });
}

export function openPastEvents() {
  const sid = currentSpaceId();
  if (!sid) return;
  setScope('day');
  goToday();
  setPastRowOpen(true);
  if (staleCountNow(sid) === 0) showToast('📥 끝내지 않은 지난 일정이 없습니다. (이월 일정은 오늘 칸에 따라옵니다)');
}

export function useEventShortcuts() {
  useEffect(() => {
    const offs = [setShortcutAction('newEvent', openNewEvent), setShortcutAction('forwarding', openPastEvents)];
    return () => offs.forEach((off) => off());
  }, []);
}

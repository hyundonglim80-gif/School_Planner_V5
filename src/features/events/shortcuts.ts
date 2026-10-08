// 일정 단축키·＋ 새로 (MENU.md 3-8 새 id). 껍데기(Shell)가 한 번 건다 - 단축키 한 곳(app/keys)에 하는 일만 더한다.
//   newEvent = 새 일정 칸 (지금 보는 날 - 메모·학급 화면이면 오늘). 칸을 연 순간의 공간에 저장한다.
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { useNav } from '../../app/nav';
import { isDatelessScope } from '../../app/route';
import { todayStr } from '../../domain/dateUtils';
import { currentSpaceId } from '../../data/session';
import { openEventPanel } from './open';

export function openNewEvent() {
  const sid = currentSpaceId();
  if (!sid) return;
  const { scope, date } = useNav.getState();
  openEventPanel({ sid, date: isDatelessScope(scope) ? todayStr() : date });
}

export function useEventShortcuts() {
  useEffect(() => setShortcutAction('newEvent', openNewEvent), []);
}

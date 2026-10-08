// 메모·기록 단축키·＋ 새로 (MENU.md 3-8 새 id). 껍데기(Shell)가 한 번 건다 - 단축키 한 곳(app/keys)에 하는 일만 더한다.
//   newNote = 새 기록 칸 (지금 보는 날 - 메모·학급 화면이면 오늘) · newMemo = 새 메모 칸 (날짜 없음). 칸을 연 순간의 공간에 저장한다.
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { useNav } from '../../app/nav';
import { isDatelessScope } from '../../app/route';
import { todayStr } from '../../domain/dateUtils';
import { currentSpaceId } from '../../data/session';
import { openNotePanel } from './open';

export function openNewNote() {
  const sid = currentSpaceId();
  if (!sid) return;
  const { scope, date } = useNav.getState();
  openNotePanel({ sid, date: isDatelessScope(scope) ? todayStr() : date });
}

export function openNewMemo() {
  const sid = currentSpaceId();
  if (sid) openNotePanel({ sid, date: null });
}

export function useNoteShortcuts() {
  useEffect(() => {
    const offs = [setShortcutAction('newNote', openNewNote), setShortcutAction('newMemo', openNewMemo)];
    return () => offs.forEach((off) => off());
  }, []);
}

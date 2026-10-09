// 시간표 단축키 - 껍데기(Shell)가 한 번 건다. '시간표'는 창 목록이 바로 잇는다(창 id = 단축키 id).
//   teachingMode = 시간표 창을 '교사 유형' 탭으로 (V4 단축키 '교사 유형 바꾸기')
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { openWindow } from '../../app/windows';

export function useTimetableShortcuts() {
  useEffect(() => setShortcutAction('teachingMode', () => openWindow('timetable', { tab: 'teaching' })), []);
}

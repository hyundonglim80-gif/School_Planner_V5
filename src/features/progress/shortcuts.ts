// 진도 단축키 - 껍데기(Shell)가 한 번 건다. '진도 관리'는 창 목록이 바로 잇는다(창 id = 단축키 id).
//   newCourse = 새 과정(과목 + 여러 반)으로 진도 관리 창 (V4 단축키 '진도 만들기 (여러 반)')
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { openProgress } from './open';

export function useProgressShortcuts() {
  useEffect(() => setShortcutAction('newCourse', () => openProgress({ course: true })), []);
}

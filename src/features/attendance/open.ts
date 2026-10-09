// 출석부 칸 열기 (V4 AttendanceDrawer - 오른쪽 쓰는 칸, 하나만). 쓰는 칸 'attendance' = { date, classId?, tab? }.
//   하루 수업 머리줄 📋 = 그날 · 학급 화면 도구 카드·오늘 출결 줄·단축키 '출석부' = 보는 날(학급 화면에서 고른 학급).
//   이미 열려 있으면 그 탭을 보이고 날짜·학급을 바꾼다(적던 것은 먼저 저장 - AttendancePanel).
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { useNav } from '../../app/nav';
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';

export const ATTENDANCE_PANEL = 'attendance';

export type AttendanceTab = 'check' | 'summary';

export interface AttendancePanelParams {
  date: string;
  /** 처음 고를 학급 (없으면 교과 + 담임의 담임반 → 학급 화면에서 고른 학급 → 올해 학급) */
  classId?: string;
  tab?: AttendanceTab;
}

export function openAttendance(params: AttendancePanelParams) {
  if (!getWindowDef(ATTENDANCE_PANEL)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(ATTENDANCE_PANEL, params);
}

/** 껍데기에서 한 번 - 단축키 '출석부' = 보는 날 */
export function useAttendanceShortcuts() {
  useEffect(() => setShortcutAction('attendance', () => openAttendance({ date: useNav.getState().date })), []);
}

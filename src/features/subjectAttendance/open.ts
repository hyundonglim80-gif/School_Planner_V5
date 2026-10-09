// 교과 출결 열기 (V4 SubjectAttendancePanel·SubjectAttendanceSummaryModal).
//   쓰는 칸 'subjectAttendanceCell' = { classId, date, n, subject? } - 교과 모드 하루 수업 칸의 🙋(그 반·그 교시). 같은 반·날·교시면 그 탭.
//   창 'subjectAttendance' = 교과 출결 누계 { classId? } - 학급 도구 카드·칸의 📊 누계·단축키 '교과 출결 누계'(창 id = 단축키 id).
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';

export const SUBJECT_ATT_CELL = 'subjectAttendanceCell';
export const SUBJECT_ATT_SUMMARY = 'subjectAttendance';

export interface SubjectAttendanceCellParams {
  classId: string;
  date: string;
  n: number;
  /** 칸 글자의 과목 ('과학') - 머리줄에만 */
  subject?: string;
}

export interface SubjectAttendanceSummaryParams {
  classId?: string;
}

export const sameSubjectCell = (a: SubjectAttendanceCellParams, b: SubjectAttendanceCellParams) => a.classId === b.classId && a.date === b.date && a.n === b.n;

export function openSubjectAttendanceCell(params: SubjectAttendanceCellParams) {
  if (!getWindowDef(SUBJECT_ATT_CELL)) return showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
  openWindow(SUBJECT_ATT_CELL, params);
}

export function openSubjectAttendanceSummary(params: SubjectAttendanceSummaryParams = {}) {
  if (!getWindowDef(SUBJECT_ATT_SUMMARY)) return showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
  openWindow(SUBJECT_ATT_SUMMARY, params);
}

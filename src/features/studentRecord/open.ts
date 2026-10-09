// 학생 기록(누가기록) 열기 (V4 StudentRecordModal) - 창 'studentRecord' = { classId?, sid?, at? } (창 id = 단축키 id).
//   학급 화면의 학생 이름·도구 카드, 자리표 학생 칸의 '🧑‍🎓 누가기록', 단축키. 이미 열려 있으면 그 탭을 보이고 학급·학생을 바꾼다(at).
import { showToast } from '../../app/toast';
import { getWindowDef, openWindow } from '../../app/windows';

export const STUDENT_RECORD = 'studentRecord';

export interface StudentRecordParams {
  classId?: string;
  /** 학생 sid */
  sid?: string;
  at?: number;
}

export function openStudentRecord(params: Omit<StudentRecordParams, 'at'> = {}) {
  if (!getWindowDef(STUDENT_RECORD)) return showToast('🚧 학생 기록(누가기록)은 아직 V5로 옮기지 않았습니다.');
  openWindow(STUDENT_RECORD, { ...params, at: Date.now() });
}

// 출석부 저장 (저장 도우미 merge + 안내의 되돌리기). 무엇을 적을지는 domain/attendance marksChanges(바뀐 학생 칸만).
import { merge } from '../../data/repo';
import type { Changes } from '../../data/repo/ops';
import type { DocPath, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { attendanceDocId, marksChanges, type AttendanceMarks } from '../../domain/attendance';
import { shortDateLabel } from '../../domain/dateUtils';

export const attendancePath = (sid: string, classId: string, date: string): DocPath<'attendance'> => ({ sid, coll: 'attendance', id: attendanceDocId(classId, date) });

/** 그날 출결 저장. 바뀐 것이 없으면 false (실패는 안내하고 던진다 - 적던 것은 칸에 남는다) */
export async function saveAttendance(
  sid: string,
  classId: string,
  date: string,
  stored: Stored<'attendance'> | undefined,
  before: AttendanceMarks,
  after: AttendanceMarks,
  /** quiet = 안내 없이 Ctrl+Z 더미에만 (자리표 학생 칸 - 누를 때마다 저장) */
  opts?: { quiet?: boolean },
): Promise<boolean> {
  const changes = marksChanges(before, after);
  if (Object.keys(changes).length === 0) return false;
  // 날짜 문서 - 처음이면 만든다(학급·날짜 칸도 함께, 학생 칸은 그 학생만)
  const undo = await merge(attendancePath(sid, classId, date), { classId, date, ...changes } as Changes<'attendance'>, stored ?? null, {
    fail: '출석부를 저장하지 못했습니다. 적던 것은 그대로 두었으니 다시 저장해 주세요.',
  });
  const n = Object.keys(after).length;
  recordUndo(sid, n ? `✅ ${shortDateLabel(date)} 출결 ${n}건을 저장했습니다.` : `✅ ${shortDateLabel(date)} 모두 출석으로 저장했습니다.`, undo, { what: '출결 저장', quiet: opts?.quiet });
  return true;
}

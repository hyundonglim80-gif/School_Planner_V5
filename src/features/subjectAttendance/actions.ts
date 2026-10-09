// 교과 출결 저장 - 누를 때마다 학생 한 칸만(domain/subjectAttendance subjectCellChanges). 되돌리기는 Ctrl+Z 더미에만(누를 때마다 안내가 뜨면 시끄럽다).
import { merge } from '../../data/repo';
import type { Changes } from '../../data/repo/ops';
import type { DocPath, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { subjectAttendanceDocId, subjectCellChanges, type SubjectMark } from '../../domain/subjectAttendance';

export const subjectAttendancePath = (sid: string, classId: string, date: string): DocPath<'subjectAttendance'> => ({
  sid,
  coll: 'subjectAttendance',
  id: subjectAttendanceDocId(classId, date),
});

/** 학생 한 칸 저장 (null = 출석으로). 실패는 안내하고 던진다 */
export async function saveSubjectCell(
  sid: string,
  classId: string,
  date: string,
  n: number,
  student: string,
  stored: Stored<'subjectAttendance'> | undefined,
  before: SubjectMark | null | undefined,
  after: SubjectMark | null,
): Promise<boolean> {
  const changes = subjectCellChanges(n, student, before, after);
  if (Object.keys(changes).length === 0) return false;
  const undo = await merge(subjectAttendancePath(sid, classId, date), { classId, date, ...changes } as Changes<'subjectAttendance'>, stored ?? null, {
    fail: '교과 출결을 저장하지 못했습니다.',
  });
  recordUndo(sid, '교과 출결', undo, { what: '교과 출결', quiet: true });
  return true;
}

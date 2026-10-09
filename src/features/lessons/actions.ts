// 수업 칸 저장 (저장 도우미 merge + 안내의 되돌리기). 무엇을 적을지는 lessonOps(순수).
import { merge } from '../../data/repo';
import { recordUndo } from '../../data/undo';
import { shortDateLabel } from '../../domain/dateUtils';
import type { LessonCell } from '../../domain/lessons';
import { clearChanges, editChanges, lessonDayPath, swapChanges, type LessonEdit } from './lessonOps';
import type { Stored } from '../../data/types';

const KEEP = '적던 것은 그대로 두었으니 다시 저장해 주세요.';

/** 수업 칸 고치기. 바뀐 것이 없으면 false (실패는 안내하고 던진다 - 칸은 닫지 않는다) */
export async function saveLesson(sid: string, date: string, day: Stored<'lessonDays'> | undefined, cell: LessonCell, edit: LessonEdit): Promise<boolean> {
  const changes = editChanges(cell, edit);
  if (!changes) return false;
  const undo = await merge(lessonDayPath(sid, date), changes, day ?? null, { fail: `수업 내용을 저장하지 못했습니다. ${KEEP}` });
  recordUndo(sid, `✅ ${shortDateLabel(date)} ${cell.n}교시 수업 내용을 저장했습니다.`, undo, { what: '수업 고치기' });
  return true;
}

/** 그 교시 비우기 (수업 수정 창의 '삭제') */
export async function clearLesson(sid: string, date: string, day: Stored<'lessonDays'> | undefined, cell: LessonCell): Promise<boolean> {
  const changes = clearChanges(cell);
  if (!changes) return false;
  const undo = await merge(lessonDayPath(sid, date), changes, day ?? null, { fail: '수업 내용을 비우지 못했습니다.' });
  recordUndo(sid, `🗑️ ${cell.n}교시 수업 내용을 비웠습니다.`, undo, { what: '수업 비우기' });
  return true;
}

/** ▲▼ 위아래 교시와 맞바꾸기 */
export async function swapLessons(sid: string, date: string, day: Stored<'lessonDays'> | undefined, a: LessonCell, b: LessonCell): Promise<void> {
  const changes = swapChanges(a, b);
  if (!changes) return;
  const undo = await merge(lessonDayPath(sid, date), changes, day ?? null, { fail: '교시를 맞바꾸지 못했습니다.' });
  recordUndo(sid, `↕️ ${a.n}교시와 ${b.n}교시를 맞바꿨습니다.`, undo, { what: '교시 맞바꾸기' });
}

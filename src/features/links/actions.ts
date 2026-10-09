// 링크 잇기·끊기 (저장 도우미 한 묶음 + 안내의 되돌리기). 쓰기는 linkOps(순수).
import { batch } from '../../data/repo';
import { recordUndo } from '../../data/undo';
import type { ItemDoc } from '../events/eventOps';
import { lessonLinkOps, lessonUnlinkOps, linkOps, unlinkOps, type LessonEnd } from './linkOps';

/** 연결 저장 - 양쪽 linkIds를 한 묶음으로(수업이면 lessonDays의 그 칸). 새로 이은 수(이미 이은 것은 빼고) */
export async function saveLinks(sid: string, source: ItemDoc, targets: readonly ItemDoc[], lessons: readonly LessonEnd[] = []): Promise<number> {
  const ops = linkOps(sid, source, targets, lessons);
  if (ops.length === 0) return 0;
  const before = new Set(source.linkIds ?? []);
  const added = new Set([...targets.map((t) => t.id), ...lessons.map((l) => l.id)].filter((id) => !before.has(id))).size;
  const undo = await batch(ops, { fail: '연결을 저장하지 못했습니다.' });
  recordUndo(sid, `🔗 ${added}개를 연결했습니다.`, undo, { what: '링크 연결' });
  return added;
}

/** 수업에서 연결 저장 - 그 교시와 항목들 */
export async function saveLessonLinks(sid: string, source: LessonEnd, targets: readonly ItemDoc[]): Promise<number> {
  const ops = lessonLinkOps(sid, source, targets);
  if (ops.length === 0) return 0;
  const before = new Set(source.linkIds);
  const added = targets.filter((t) => !before.has(t.id)).length;
  const undo = await batch(ops, { fail: '연결을 저장하지 못했습니다.' });
  recordUndo(sid, `🔗 ${added}개를 연결했습니다.`, undo, { what: '링크 연결' });
  return added;
}

/** 연결 끊기 - 양쪽 모두에서 (항목은 그대로). 상대가 수업이면 lesson */
export async function removeLink(sid: string, source: ItemDoc, targetId: string, target?: ItemDoc, lesson?: LessonEnd | null): Promise<void> {
  const ops = unlinkOps(sid, source, targetId, target, lesson);
  if (ops.length === 0) return;
  const undo = await batch(ops, { fail: '연결을 끊지 못했습니다.' });
  recordUndo(sid, '🔗 연결을 끊었습니다 (항목은 그대로).', undo, { what: '링크 끊기' });
}

/** 수업에서 연결 끊기 */
export async function removeLessonLink(sid: string, source: LessonEnd, targetId: string, target?: ItemDoc): Promise<void> {
  const ops = lessonUnlinkOps(sid, source, targetId, target);
  if (ops.length === 0) return;
  const undo = await batch(ops, { fail: '연결을 끊지 못했습니다.' });
  recordUndo(sid, '🔗 연결을 끊었습니다 (항목은 그대로).', undo, { what: '링크 끊기' });
}

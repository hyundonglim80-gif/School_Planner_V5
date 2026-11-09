// 링크 잇기·끊기 (저장 도우미 한 묶음 + 안내의 되돌리기). 쓰기는 linkOps(순수).
import { batch } from '../../data/repo';
import { docsNow } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { showErrorToast } from '../../app/toast';
import type { ItemDoc } from '../events/eventOps';
import {
  LINK_KIND_NAME,
  lessonEndOf,
  lessonLinkOps,
  lessonUnlinkOps,
  linkKindOf,
  linkOps,
  noteToProgressOps,
  parseLessonLink,
  parseProgressLink,
  progressEndOf,
  progressLinkOps,
  progressUnlinkOps,
  unlinkOps,
  type LessonEnd,
  type ProgressEnd,
} from './linkOps';
import { linkPickOf } from './open';

/**
 * '+ 새 00 만들어 연결'로 연 쓰는 칸이 처음 저장했다 - 쪽지의 잇는 쪽(항목·수업·진도 차시)과 곧바로 잇는다(P28-1 사용자 요청 -
 * 예전에는 연결 창 🛒에 담기만 해 '연결 저장'을 또 눌러야 했다). 연결 창이 열려 있으면 알린다(닫기·안내), 닫혔어도 잇는다.
 * 던지지 않는다 - 메모·일정은 이미 저장됐다(못 이으면 저장 도우미가 알리고, 연결 창이 있으면 🛒에 담아 둔다).
 */
export async function deliverLinkPick(token: string | undefined, madeId: string): Promise<boolean> {
  const pick = linkPickOf(token);
  if (!pick) return false;
  const { sid, id } = pick;
  const items = docsNow('items', sid);
  // 방금 만든 항목은 이 기기 사본에 이미 있다(저장 도우미가 먼저 적는다). 없으면 id만으로 - 링크 칸은 비어 있다
  const made: ItemDoc = items[madeId] ?? ({ id: madeId } as ItemDoc);
  const lesson = parseLessonLink(id) ? lessonEndOf(id, docsNow('lessonDays', sid)) : null;
  const progress = parseProgressLink(id) ? progressEndOf(id, docsNow('progress', sid)) : null;
  const source = !lesson && !parseProgressLink(id) && items[id] && !items[id].deletedAt ? items[id] : undefined;
  const ops = lesson ? lessonLinkOps(sid, lesson, [made]) : progress ? progressLinkOps(sid, progress, [made]) : source ? linkOps(sid, source, [made]) : null;
  if (!ops) {
    showErrorToast('연결할 항목을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다. 새 항목은 저장됐습니다.');
    pick.onPick?.(madeId, false);
    return false;
  }
  try {
    const undo = ops.length > 0 ? await batch(ops, { fail: '연결을 저장하지 못했습니다. 새 항목은 저장됐습니다.' }) : null;
    const more = pick.onPick?.(madeId, true) ?? '';
    const what = made.kind && linkKindOf(made) === 'event' ? `${LINK_KIND_NAME.event}을` : `${LINK_KIND_NAME.note}를`;
    if (undo) recordUndo(sid, `🔗 새 ${what} 저장하고 연결했습니다.${more}`, undo, { what: '링크 연결' });
    return true;
  } catch {
    // 안내는 저장 도우미가 했다 - 연결 창이 있으면 담아 둔다('연결 저장'으로 다시)
    pick.onPick?.(madeId, false);
    return false;
  }
}

/**
 * 연결 저장 - 양쪽 linkIds를 한 묶음으로(수업이면 lessonDays의 그 칸). 새로 이은 수(이미 이은 것은 빼고).
 * progress = 메모에서 고른 진도 차시(P11-1) - 진도 쪽 그 행에만 적는다(같은 묶음).
 */
export async function saveLinks(
  sid: string,
  source: ItemDoc,
  targets: readonly ItemDoc[],
  lessons: readonly LessonEnd[] = [],
  progress: readonly ProgressEnd[] = [],
): Promise<number> {
  const ops = [...linkOps(sid, source, targets, lessons), ...noteToProgressOps(sid, source.id, progress)];
  if (ops.length === 0) return 0;
  const before = new Set(source.linkIds ?? []);
  const added =
    new Set([...targets.map((t) => t.id), ...lessons.map((l) => l.id)].filter((id) => !before.has(id))).size +
    new Set(progress.filter((p) => !p.linkIds.includes(source.id)).map((p) => p.id)).size;
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

/** 진도 차시에 메모 잇기 (진도 쪽 그 행에만 - P10-4) */
export async function saveProgressLinks(sid: string, source: ProgressEnd, targets: readonly ItemDoc[]): Promise<number> {
  const ops = progressLinkOps(sid, source, targets);
  if (ops.length === 0) return 0;
  const before = new Set(source.linkIds);
  const added = targets.filter((t) => !before.has(t.id)).length;
  const undo = await batch(ops, { fail: '연결을 저장하지 못했습니다.' });
  recordUndo(sid, `🔗 ${added}개를 진도 차시에 연결했습니다.`, undo, { what: '링크 연결' });
  return added;
}

/** 진도 차시에서 메모 끊기 */
export async function removeProgressLink(sid: string, source: ProgressEnd, noteId: string): Promise<void> {
  const ops = progressUnlinkOps(sid, source, noteId);
  if (ops.length === 0) return;
  const undo = await batch(ops, { fail: '연결을 끊지 못했습니다.' });
  recordUndo(sid, '🔗 연결을 끊었습니다 (메모는 그대로).', undo, { what: '링크 끊기' });
}

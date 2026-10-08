// 메모·기록 쓰기 (하루 화면 기록 칸·메모 화면·쓰는 칸이 함께 쓴다). 저장 도우미(data/repo)로 적고 되돌리기를 남긴다(data/undo).
// 실패는 저장 도우미가 안내하고 던진다 - 누른 단추에서 부르면 `.catch(() => {})`로 받는다(안내는 이미 나갔다).
// 쓰기마다 문서 하나(원칙 1).
import { batch, patch, remove } from '../../data/repo';
import { recordUndo } from '../../data/undo';
import { doneChanges, itemPath, type ItemDoc } from '../events/eventOps';
import { checkLineChanges, favoriteChanges, noteMoveOps, nounOf, objectOf } from './noteOps';
import { closeNotePanelsFor } from './open';

/** 완료 / 완료 풀기 (카드 ☐·쓰는 칸 머리줄). 안내 없이 Ctrl+Z 더미에만 - V4도 안내를 띄우지 않았다 */
export async function setNoteDone(sid: string, item: ItemDoc, done: boolean): Promise<void> {
  const noun = nounOf(item);
  const undo = await patch(itemPath(sid, item.id), doneChanges(done), item, {
    fail: done ? `${objectOf(noun)} 완료하지 못했습니다.` : `${noun} 완료를 풀지 못했습니다.`,
  });
  recordUndo(sid, '', undo, { what: done ? `${noun} 완료` : `${noun} 완료 풀기`, quiet: true });
}

/** 즐겨찾기 / 풀기 (카드 ☆·쓰는 칸 머리줄). 안내 없이 */
export async function setNoteFavorite(sid: string, item: ItemDoc, favorite: boolean): Promise<void> {
  const undo = await patch(itemPath(sid, item.id), favoriteChanges(favorite), item, { fail: '즐겨찾기를 저장하지 못했습니다.' });
  recordUndo(sid, '', undo, { what: favorite ? '즐겨찾기' : '즐겨찾기 풀기', quiet: true });
}

/** 보이는 목록에서 한 칸 앞·뒤로 (▲▼ - 즐겨찾기끼리, 나머지끼리). 옮긴 것의 order만 */
export async function moveNoteInList(sid: string, shown: readonly ItemDoc[], index: number, step: -1 | 1): Promise<void> {
  const ops = noteMoveOps(sid, shown, index, step);
  if (!ops) return;
  const undo = await batch(ops, { fail: '순서를 바꾸지 못했습니다.' });
  recordUndo(sid, '', undo, { what: '순서 바꾸기', quiet: true });
}

/**
 * 카드의 '☐ 우유' 줄 누르기 - 그 줄의 체크 글자만. 그새 다른 곳에서 그 줄을 고쳤으면 바꾸지 않고 false
 * (V4 toggleJournalCheckLine). 안내 없이 Ctrl+Z 더미에만.
 */
export async function toggleNoteCheckLine(sid: string, item: ItemDoc, lineIndex: number, shownLine: string): Promise<boolean> {
  const changes = checkLineChanges(item, lineIndex, shownLine);
  if (!changes) return false;
  const undo = await patch(itemPath(sid, item.id), changes, item, { fail: '체크를 저장하지 못했습니다.' });
  recordUndo(sid, '', undo, { what: '체크', quiet: true });
  return true;
}

/**
 * 지우기 = 지운 표시(원칙 5 - 휴지통에서 되살린다). 확인 창 없이 곧바로, 안내의 되돌리기·Ctrl+Z로 그 자리에 돌아온다(V4 그대로).
 * 그 항목을 고치던 칸은 닫는다. 못 지웠으면 던진다 - 칸은 닫지 않는다.
 */
export async function deleteNote(sid: string, item: ItemDoc): Promise<void> {
  const noun = nounOf(item);
  const undo = await remove(itemPath(sid, item.id), { fail: `${objectOf(noun)} 지우지 못했습니다.` });
  closeNotePanelsFor(sid, item.id);
  recordUndo(sid, `🗑️ ${objectOf(noun)} 삭제했습니다. 휴지통에서 복원할 수 있습니다.`, undo, { what: `${noun} 지우기` });
}

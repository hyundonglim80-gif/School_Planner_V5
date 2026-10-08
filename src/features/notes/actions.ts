// 메모·기록 쓰기 (하루 화면 기록 칸·메모 화면·쓰는 칸이 함께 쓴다). 저장 도우미(data/repo)로 적고 되돌리기를 남긴다(data/undo).
// 실패는 저장 도우미가 안내하고 던진다 - 누른 단추에서 부르면 `.catch(() => {})`로 받는다(안내는 이미 나갔다).
// 쓰기마다 문서 하나(원칙 1).
import { shortDateLabel } from '../../domain/dateUtils';
import { ensureLabelOps } from '../../data/labels';
import { batch, newPath, patch, remove, writeOp, type WriteOp } from '../../data/repo';
import type { LabelTree } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { doneChanges, itemPath, type ItemDoc } from '../events/eventOps';
import { createNoteData, noteEditChanges, savePlanOf, type NoteForm } from './noteForm';
import { checkLineChanges, favoriteChanges, noteMoveOps, nounOf, objectOf, type NoteNoun } from './noteOps';
import { closeNotePanelsFor } from './open';

const KEEP = '적은 내용은 칸에 남아 있습니다.';

/** 저장한 것 - 칸이 '#라벨'을 뗀 글과 붙은 라벨로 바뀐다 (V4 그대로) */
export interface NoteSaved {
  id: string;
  text: string;
  labelIds: string[];
}

/** '#라벨'·'+ 새 라벨' → 라벨 id (없는 이름은 새 라벨 - 항목과 한 묶음으로 적을 쓰기) */
function labelsFor(sid: string, form: NoteForm, tree: LabelTree): { text: string; labelIds: string[]; ops: WriteOp[] } {
  const plan = savePlanOf(form);
  const made = ensureLabelOps(sid, 'note', plan.names, tree.list);
  // 칸에 보이지 않는 라벨(지운 라벨)도 그대로 둔다 - 라벨을 되살리면 다시 붙어 보인다(손대지 않은 칸을 바꾸지 않는다)
  const labelIds = [...form.labelIds];
  for (const id of made.ids) if (!labelIds.includes(id)) labelIds.push(id);
  return { text: plan.text, labelIds, ops: made.ops };
}

/** 새 메모·기록 (그 자리 목록의 맨 뒤 - order는 부르는 쪽이). 새 라벨과 한 묶음 */
export async function createNote(sid: string, form: NoteForm, tree: LabelTree, order: string): Promise<NoteSaved> {
  const noun: NoteNoun = form.date ? '기록' : '메모';
  const at = newPath(sid, 'items');
  const { text, labelIds, ops } = labelsFor(sid, form, tree);
  const undo = await batch([...ops, writeOp.create(at, createNoteData(form, text, labelIds, order))], {
    fail: `${objectOf(noun)} 저장하지 못했습니다. ${KEEP}`,
  });
  recordUndo(sid, `✅ ${objectOf(noun)} 저장했습니다.`, undo, { what: `${noun} 추가` });
  return { id: at.id, text, labelIds };
}

/** 옮긴 안내 ('📅 기록을 10/8 → 10/9로', '메모로', '10/9 기록으로') */
function moveMessage(from: string | null, to: string | null): string {
  if (!to) return '🗒️ 메모로 옮겼습니다.';
  if (!from) return `📔 ${shortDateLabel(to)} 기록으로 옮겼습니다.`;
  return `📅 기록을 ${shortDateLabel(from)} → ${shortDateLabel(to)}로 옮겼습니다.`;
}

/**
 * 고친 메모·기록 저장 = 바뀐 칸만(새 라벨과 한 묶음). 바뀐 것이 없으면 null (쓰지 않는다).
 * 📅 날짜를 바꿨으면 옮기기 - 안내의 되돌리기는 **자리만** 원래대로(함께 고친 글은 그대로 - V4 '원래 자리로 돌아옵니다').
 */
export async function saveNote(sid: string, item: ItemDoc, form: NoteForm, tree: LabelTree): Promise<NoteSaved | null> {
  const { text, labelIds, ops } = labelsFor(sid, form, tree);
  const changes = noteEditChanges(item, form, text, labelIds);
  if (Object.keys(changes).length === 0 && ops.length === 0) return null;
  const at = itemPath(sid, item.id);
  const noun = nounOf(item);
  const moved = Object.hasOwn(changes, 'date');
  const writes = Object.keys(changes).length > 0 ? [...ops, writeOp.patch(at, changes, item)] : ops;
  const undo = await batch(writes, { fail: `${moved ? `${objectOf(noun)} 옮기지 못했습니다.` : `${objectOf(noun)} 저장하지 못했습니다.`} ${KEEP}` });
  if (moved) {
    const to = changes.date ?? null;
    const placeNow = { date: to, fromDate: Object.hasOwn(changes, 'fromDate') ? changes.fromDate : item.fromDate };
    recordUndo(sid, moveMessage(item.date ?? null, to), [writeOp.patch(at, { date: item.date ?? null, fromDate: item.fromDate }, placeNow)], {
      what: `${noun} 옮기기`,
    });
  } else {
    recordUndo(sid, `✅ ${objectOf(noun)} 저장했습니다.`, undo, { what: `${noun} 고치기` });
  }
  return { id: item.id, text, labelIds };
}

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

/** 완료된 메모 모두 지우기 (메모 화면 '🗑️ 전체 비우기') - 지운 표시 여럿을 한 묶음, 안내의 되돌리기 하나로 모두 (V4는 묻고 휴지통으로) */
export async function deleteNotes(sid: string, list: readonly ItemDoc[]): Promise<void> {
  if (list.length === 0) return;
  const undo = await batch(
    list.map((d) => writeOp.remove(itemPath(sid, d.id))),
    { fail: '메모를 지우지 못했습니다.' },
  );
  for (const d of list) closeNotePanelsFor(sid, d.id);
  recordUndo(sid, `🗑️ 완료된 메모 ${list.length}개를 삭제했습니다. 휴지통에서 복원할 수 있습니다.`, undo, { what: '완료된 메모 지우기' });
}

/** 라벨이 없는 메모에 한 라벨 붙이기 (메모 화면 - 라벨로 보기에서 찾을 수 있게, V4 '메모' 라벨 붙이기). 없는 라벨이면 함께 만든다(한 묶음) */
export async function labelNotes(sid: string, list: readonly ItemDoc[], name: string, tree: LabelTree): Promise<void> {
  if (list.length === 0) return;
  const { ids, ops } = ensureLabelOps(sid, 'note', [name], tree.list);
  const undo = await batch(
    [...ops, ...list.map((d) => writeOp.patch(itemPath(sid, d.id), { labelIds: [...(d.labelIds ?? []), ids[0]] }, d))],
    { fail: '라벨을 붙이지 못했습니다.' },
  );
  recordUndo(sid, `🏷️ 메모 ${list.length}개에 '${name}' 라벨을 붙였습니다.`, undo, { what: '라벨 붙이기' });
}

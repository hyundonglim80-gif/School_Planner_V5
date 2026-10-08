// 일정 쓰기 (하루·주간·월간·년간이 함께 쓴다). 저장 도우미(data/repo)로 적고 되돌리기를 남긴다(data/undo).
// 실패는 저장 도우미가 안내하고 던진다 - 누른 단추에서 부르면 `.catch(() => {})`로 받는다(안내는 이미 나갔다).
// 쓰기마다 문서 하나(원칙 1).
import { shortDateLabel } from '../../domain/dateUtils';
import { batch, create, newPath, patch, writeOp } from '../../data/repo';
import type { LabelTree } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { createData, editChanges, type EventForm } from './eventForm';
import { doneChanges, itemPath, reorderOps, type ItemDoc } from './eventOps';

const KEEP = '적은 내용은 칸에 남아 있습니다.';

/** 완료 / 완료 풀기 (☐·라벨 칩). 안내 없이 Ctrl+Z 더미에만 - V4도 안내를 띄우지 않았다 */
export async function setEventDone(sid: string, item: ItemDoc, done: boolean): Promise<void> {
  const undo = await patch(itemPath(sid, item.id), doneChanges(done), item, {
    fail: done ? '일정을 완료하지 못했습니다.' : '일정 완료를 풀지 못했습니다.',
  });
  recordUndo(sid, '', undo, { what: done ? '일정 완료' : '일정 완료 풀기', quiet: true });
}

/** 보이는 목록에서 한 칸 옮기기 (▲▼). 옮긴 것의 order만 */
export async function moveEventInList(sid: string, list: readonly ItemDoc[], from: number, to: number): Promise<void> {
  const ops = reorderOps(sid, list, from, to);
  if (ops.length === 0) return;
  const undo = await batch(ops, { fail: '일정 순서를 바꾸지 못했습니다.' });
  recordUndo(sid, '', undo, { what: '일정 순서 바꾸기', quiet: true });
}

/** 새 일정 (그날 목록의 맨 뒤 - order는 부르는 쪽이). 만든 id */
export async function createEvent(sid: string, form: EventForm, tree: LabelTree, order: string): Promise<string> {
  const at = newPath(sid, 'items');
  const undo = await create(at, createData(form, tree, order), { fail: `일정을 저장하지 못했습니다. ${KEEP}` });
  recordUndo(sid, '✅ 일정을 추가했습니다.', undo, { what: '일정 추가' });
  return at.id;
}

/**
 * 고친 일정 저장 = 바뀐 칸만. 날짜를 바꿨으면 옮기기 - 안내의 되돌리기는 **날짜만** 원래대로(함께 고친 내용은 그대로 - V4).
 * 바뀐 것이 없으면 false (쓰지 않는다).
 */
export async function saveEvent(sid: string, item: ItemDoc, form: EventForm, tree: LabelTree): Promise<boolean> {
  const changes = editChanges(item, form, tree);
  if (Object.keys(changes).length === 0) return false;
  const at = itemPath(sid, item.id);
  const to = changes.date;
  const undo = await patch(at, changes, item, { fail: `${to ? '일정을 옮기지 못했습니다.' : '일정을 저장하지 못했습니다.'} ${KEEP}` });
  if (to && item.date) {
    recordUndo(sid, `📅 일정을 ${shortDateLabel(item.date)} → ${shortDateLabel(to)}로 옮겼습니다.`, [writeOp.patch(at, { date: item.date }, { date: to })], {
      what: '일정 옮기기',
    });
  } else {
    recordUndo(sid, '✅ 일정을 저장했습니다.', undo, { what: '일정 고치기' });
  }
  return true;
}

/** 알림 시각 바꾸기·끄기 (하루 카드의 ⏰ - 누르는 즉시 저장). '' = 끄기 */
export async function setEventAlarm(sid: string, item: ItemDoc, time: string): Promise<void> {
  const undo = await patch(
    itemPath(sid, item.id),
    { time: time || undefined, ...(item.alarmDone ? { alarmDone: undefined } : {}) },
    item,
    { fail: time ? '알림을 저장하지 못했습니다.' : '알림을 끄지 못했습니다.' },
  );
  recordUndo(sid, '', undo, { what: time ? '알림 바꾸기' : '알림 끄기', quiet: true });
}

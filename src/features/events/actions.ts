// 일정 쓰기 (하루·주간·월간·년간이 함께 쓴다). 저장 도우미(data/repo)로 적고 되돌리기를 남긴다(data/undo).
// 실패는 저장 도우미가 안내하고 던진다 - 누른 단추에서 부르면 `.catch(() => {})`로 받는다(안내는 이미 나갔다).
import { batch, patch } from '../../data/repo';
import { recordUndo } from '../../data/undo';
import { doneChanges, itemPath, reorderOps, type ItemDoc } from './eventOps';

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

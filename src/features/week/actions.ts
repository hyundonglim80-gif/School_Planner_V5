// 작년 이맘때 가져오기 (한 묶음 + 안내의 되돌리기 = 만든 것만 지운 표시)
import { batch } from '../../data/repo';
import type { Docs } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { importedMessage, lastYearImportPlan, type LastYearPick } from './lastYear';

/** 고른 것을 올해 같은 요일로. 만든 수 */
export async function importLastYear(sid: string, items: Docs<'items'>, picks: readonly LastYearPick[]): Promise<number> {
  const plan = lastYearImportPlan(sid, items, picks);
  if (plan.ops.length === 0) {
    recordUndo(sid, importedMessage(plan), []);
    return 0;
  }
  const undo = await batch(plan.ops, { fail: '작년 것을 가져오지 못했습니다.' });
  recordUndo(sid, importedMessage(plan), undo, { what: '작년 이맘때 가져오기' });
  return plan.ops.length;
}

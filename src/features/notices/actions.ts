// 알림장 저장 (저장 도우미 merge + 안내의 되돌리기). 그 날짜만의 문서라 줄 칸을 통째로 쓴다.
import { merge } from '../../data/repo';
import type { DocPath, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { shortDateLabel } from '../../domain/dateUtils';
import { readNoticeLines } from '../../domain/notices';

export const noticePath = (sid: string, date: string): DocPath<'notices'> => ({ sid, coll: 'notices', id: date });

/** 그날 알림장 저장 (빈 줄이면 비우기). 바뀐 것이 없으면 false (실패는 안내하고 던진다) */
export async function saveNotice(sid: string, date: string, stored: Stored<'notices'> | undefined, lines: string[]): Promise<boolean> {
  if (JSON.stringify(readNoticeLines(stored?.lines)) === JSON.stringify(lines)) return false;
  const undo = await merge(noticePath(sid, date), { date, lines }, stored ?? null, { fail: '알림장을 저장하지 못했습니다. 적던 것은 그대로 두었으니 다시 저장해 주세요.' });
  recordUndo(sid, lines.length ? `✅ ${shortDateLabel(date)} 알림장을 저장했습니다.` : `🗑️ ${shortDateLabel(date)} 알림장을 비웠습니다.`, undo, { what: '알림장 저장' });
  return true;
}

// 관찰 한 줄 (V4 SeatStudentCard·classHubStore.addJournalLine) - 개인 공간 오늘 기록에 학생을 붙여 한 줄.
//   V4는 글 끝에 학생 태그('#26040305')를 붙였다 - V5는 글은 그대로 두고 studentIds('{classId}/{sid}')에 든다(학생 기록이 모은다, P7-1).
//   새 기록은 맨 위 라벨(쓰는 칸의 새 기록과 같다), 그날 기록 맨 뒤 차례. 안내의 되돌리기로 바로 뺀다.
import { create, newPath } from '../../data/repo';
import type { LabelTree } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { orderAfter } from '../events/eventOps';
import { createNoteData, newNoteForm } from '../notes/noteForm';

/** 관찰 한 줄의 글 (빈칸 하나로·한 줄) - 빈 글이면 '' */
export const observationText = (raw: string) => raw.replace(/\s+/g, ' ').trim();

export async function addObservation(
  sid: string,
  date: string,
  text: string,
  studentKey: string,
  tree: LabelTree,
  dayNotes: readonly { order?: string }[],
): Promise<string | null> {
  const line = observationText(text);
  if (!line) return null;
  const at = newPath(sid, 'items');
  const form = { ...newNoteForm(date, tree), text: line, studentIds: [studentKey] };
  const undo = await create(at, createNoteData(form, line, form.labelIds, orderAfter(dayNotes)), { fail: '기록에 남기지 못했습니다. 네트워크를 확인해 주세요.' });
  recordUndo(sid, `📝 오늘 기록에 남겼습니다: ${line}`, undo, { what: '관찰 한 줄' });
  return at.id;
}

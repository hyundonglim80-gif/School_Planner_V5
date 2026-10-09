// 수업 칸 쓰기 규칙 (순수 - 시험한다). lessonDays에는 **그날 바꾼 것만** 적는다(DESIGN 4-5):
//   - 과목이 그날 시간표(수업 없는 날이면 '')와 같으면 subject 칸을 뺀다 - 시간표를 고치면 따라가게.
//     다르면 적는다(빈 글자 = 그 교시 수업 없음).
//   - 메모·준비물은 비우면 칸을 뺀다. 남은 것이 없으면 그 교시 칸을 통째로 뺀다.
//   - 고칠 때는 'periods.3.memo'처럼 그 칸만(merge - 그날 문서가 없으면 만든다). 다른 기기가 같은 날 다른 교시를 고쳐도 덮지 않는다.
import type { Changes } from '../../data/repo/ops';
import type { DocPath } from '../../data/types';
import { cellHasContent, type LessonCell, type LessonCellDoc } from '../../domain/lessons';

export const lessonDayPath = (sid: string, date: string): DocPath<'lessonDays'> => ({ sid, coll: 'lessonDays', id: date });

/** 수업 칸에서 고치는 것 */
export interface LessonEdit {
  subject: string;
  memo: string;
  supplies: string;
}

type CellKey = 'subject' | 'memo' | 'supplies' | 'attachments';

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 칸 하나를 이렇게 바꾸는 쓰기 (바뀐 것이 없으면 null) */
function cellChanges(n: number, before: LessonCellDoc | undefined, next: Partial<Record<CellKey, unknown>>): Changes<'lessonDays'> | null {
  const after: Record<string, unknown> = { ...(before ?? {}) };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) delete after[k];
    else after[k] = v;
  }
  if (!cellHasContent(after as LessonCellDoc)) {
    // 남은 것이 없다 - 칸을 통째로 뺀다 (없던 칸이면 적을 것이 없다)
    return before && Object.keys(before).length > 0 ? ({ [`periods.${n}`]: undefined } as Changes<'lessonDays'>) : null;
  }
  const changes: Record<string, unknown> = {};
  for (const k of Object.keys(next)) {
    if (!same(before?.[k as CellKey], after[k])) changes[`periods.${n}.${k}`] = after[k];
  }
  return Object.keys(changes).length > 0 ? (changes as Changes<'lessonDays'>) : null;
}

/** 과목: 그날 시간표와 같으면 undefined(칸을 뺀다), 다르면 그 글자 */
export const subjectToStore = (cell: Pick<LessonCell, 'base'>, subject: string): string | undefined => {
  const s = subject.trim();
  return s === cell.base ? undefined : s;
};

/** 수업 칸 고치기 (과목·준비물·메모) */
export function editChanges(cell: LessonCell, edit: LessonEdit): Changes<'lessonDays'> | null {
  return cellChanges(cell.n, cell.doc, {
    subject: subjectToStore(cell, edit.subject),
    memo: edit.memo.trim() || undefined,
    supplies: edit.supplies.trim() || undefined,
  });
}

/** 고친 것이 있나 (배경을 누르면 저장하고 닫을지) */
export function isEdited(cell: LessonCell, edit: LessonEdit): boolean {
  return edit.subject.trim() !== cell.subject || edit.memo.trim() !== cell.memo.trim() || edit.supplies.trim() !== cell.supplies.trim();
}

/** 칸 비우기 (V4 '삭제' - 그 교시 수업 없음, 메모·준비물 지움). 링크·첨부는 그대로 */
export function clearChanges(cell: LessonCell): Changes<'lessonDays'> | null {
  return cellChanges(cell.n, cell.doc, { subject: subjectToStore(cell, ''), memo: undefined, supplies: undefined });
}

/**
 * ▲▼ 위아래 교시와 맞바꾸기 (V4 onReorderPeriods). 과목·메모·준비물·첨부를 바꾼다.
 * 링크는 교시 자리에 남는다 - 링크 id가 'lesson:날짜:교시'라 상대 항목이 그 자리를 가리킨다(DESIGN 4-2).
 */
export function swapChanges(a: LessonCell, b: LessonCell): Changes<'lessonDays'> | null {
  const move = (to: LessonCell, from: LessonCell) =>
    cellChanges(to.n, to.doc, {
      subject: subjectToStore(to, from.subject),
      memo: from.memo || undefined,
      supplies: from.supplies || undefined,
      attachments: from.attachments.length ? from.attachments : undefined,
    });
  const all = { ...(move(a, b) ?? {}), ...(move(b, a) ?? {}) };
  return Object.keys(all).length > 0 ? (all as Changes<'lessonDays'>) : null;
}

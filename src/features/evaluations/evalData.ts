// 조사표 읽기·쓰기 (V4 hooks/useEvaluation·lib/classHubStore의 조사표 부분) - 공간마다 `evaluations/{id}`, 한 장 = 문서 하나.
//   V4는 날짜 문서 하나에 그날 조사표를 배열로 담아 트랜잭션으로 고쳤다(두 기기가 함께 쓰면 덮였다) - V5는 조사표마다 문서라 그럴 일이 없다.
//   값 저장 = 바뀐 학생 칸만(`values.{sid}`), 기본 정보 = 바뀐 칸만, 날짜·자리를 바꾸면 같은 문서의 date·period만 바뀐다(옮기기).
//   지우기 = 지운 표시(휴지통 '조사표' - 안내의 되돌리기). 명렬표와 맞춘 명단은 조용히(되돌리기 없이) 고친다.
import { useMemo } from 'react';
import { batch, create, newPath, patch, remove, writeOp, writeOps } from '../../data/repo';
import type { Changes } from '../../data/repo/ops';
import { isLive, useDocs } from '../../data/select';
import type { DocPath, Editable, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { cleanEvalValue, evalValuesChanges, withEvalValue, type EvalDoc, type EvalStudent, type EvalValue, type EvalValues } from '../../domain/evaluation';

export type EvalItem = Stored<'evaluations'>;

export const evalPath = (sid: string, id: string): DocPath<'evaluations'> => ({ sid, coll: 'evaluations', id });

/** 문서 → 셈에 쓰는 모양 (옛 모양·손으로 고친 칸을 믿지 않는다) */
export function readEval(d: EvalItem): EvalItem {
  return {
    ...d,
    period: typeof d.period === 'number' ? d.period : null,
    type: d.type === 'check' || d.type === 'memo' ? d.type : 'eval',
    title: d.title ?? '',
    students: Array.isArray(d.students) ? d.students : [],
    values: d.values && typeof d.values === 'object' ? d.values : {},
    ...(Array.isArray(d.steps) ? {} : { steps: [] }),
  };
}

/** 그 공간의 살아 있는 조사표 (날짜·교시 차례가 아니다 - 부르는 쪽이 고른다) */
export function useEvaluations(sid?: string | null): EvalItem[] {
  const docs = useDocs('evaluations', sid);
  return useMemo(() => Object.values(docs).filter(isLive).map(readEval), [docs]);
}

/** 그날 조사표 */
export function useEvalsOn(date: string, sid?: string | null): EvalItem[] {
  const all = useEvaluations(sid);
  return useMemo(() => all.filter((e) => e.date === date), [all, date]);
}

/** 그 날들 조사표 수 (주간·월간·년간 📊 n) */
export function useEvalCountsByDate(sid?: string | null): Record<string, number> {
  const all = useEvaluations(sid);
  return useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of all) out[e.date] = (out[e.date] ?? 0) + 1;
    return out;
  }, [all]);
}

export type NewEval = Omit<EvalDoc, 'values'> & { values?: EvalValues };

const dataOf = (e: NewEval): Editable<'evaluations'> => ({
  date: e.date,
  period: e.period,
  classId: e.classId,
  title: e.title,
  type: e.type,
  ...(e.subject ? { subject: e.subject } : {}),
  ...(e.type === 'eval' ? { indiv: !!e.indiv, group: !!e.group, steps: e.steps ?? [], ...(e.group ? { groups: e.groups ?? [] } : {}) } : {}),
  students: e.students,
  values: e.values ?? {},
});

/** 새 조사표 (같은 과정의 다른 반에도 - more) - 한 묶음. 만든 id들 (첫 것이 base) */
export async function createEvaluations(sid: string, list: readonly NewEval[]): Promise<string[]> {
  const ats = list.map(() => newPath(sid, 'evaluations'));
  const undo = await batch(
    list.map((e, i) => writeOp.create(ats[i], dataOf(e))),
    { fail: '조사표를 만들지 못했습니다. 적은 것은 그대로 두었으니 다시 눌러 주세요.' },
  );
  recordUndo(sid, list.length > 1 ? `✅ 조사표 ${list.length}장을 만들었습니다.` : '✅ 조사표를 만들었습니다.', undo, { what: '조사표 만들기', quiet: list.length === 1 });
  return ats.map((a) => a.id);
}

/** 학생 값 저장 = 바뀐 학생 칸만. 바뀐 것이 없으면 false */
export async function saveEvalValues(sid: string, stored: EvalItem, after: EvalValues): Promise<boolean> {
  const changes = evalValuesChanges(stored.values ?? {}, after);
  if (Object.keys(changes).length === 0) return false;
  const undo = await patch(evalPath(sid, stored.id), changes as Changes<'evaluations'>, stored, { fail: '조사표를 저장하지 못했습니다. 적은 것은 그대로 두었으니 다시 저장해 주세요.' });
  recordUndo(sid, '✅ 조사표를 저장했습니다.', undo, { what: '조사표 저장' });
  return true;
}

/** 한 학생 한 칸만 곧바로 (자리표 학생 칸 - 안내 없이 Ctrl+Z 더미에) */
export async function saveEvalStudentValue(sid: string, stored: EvalItem, student: string, p: EvalValue): Promise<void> {
  const next = cleanEvalValue(withEvalValue(stored.values ?? {}, student, p)[student]);
  const undo = await patch(evalPath(sid, stored.id), { [`values.${student}`]: next ?? undefined } as Changes<'evaluations'>, stored, { fail: '조사표를 저장하지 못했습니다. 네트워크를 확인해 주세요.' });
  recordUndo(sid, '조사표', undo, { what: '조사표 값', quiet: true });
}

export type EvalMeta = Partial<Pick<EvalDoc, 'title' | 'subject' | 'date' | 'period' | 'classId' | 'students'>>;

/** 기본 정보 (제목·학급·날짜·자리·교과) - 바뀐 칸만. 적던 값(values)도 함께 받으면 한 번에 */
export async function saveEvalMeta(sid: string, stored: EvalItem, meta: EvalMeta, values?: EvalValues): Promise<void> {
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const cur = (stored as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(cur ?? null) !== JSON.stringify(v ?? null)) changes[k] = k === 'subject' && !v ? undefined : v;
  }
  if (values) Object.assign(changes, evalValuesChanges(stored.values ?? {}, values));
  if (Object.keys(changes).length === 0) return;
  const moved = Object.hasOwn(changes, 'date') || Object.hasOwn(changes, 'period');
  const undo = await patch(evalPath(sid, stored.id), changes as Changes<'evaluations'>, stored, { fail: '기본 정보를 저장하지 못했습니다.' });
  recordUndo(sid, moved ? '✅ 조사표를 옮겼습니다.' : '✅ 기본 정보를 바꿨습니다.', undo, { what: '조사표 기본 정보' });
}

/** 명렬표와 맞춘 명단 (열 때 - 안내·되돌리기 없이, 못 적으면 다음에 열 때 다시) */
export async function syncEvalRoster(sid: string, stored: EvalItem, students: EvalStudent[]): Promise<void> {
  await writeOps([writeOp.patch(evalPath(sid, stored.id), { students } as Changes<'evaluations'>, stored)]).catch(() => {});
}

/** 지우기 = 지운 표시 (휴지통 '조사표') */
export async function deleteEvaluation(sid: string, stored: EvalItem): Promise<void> {
  const undo = await remove(evalPath(sid, stored.id), { fail: '조사표를 지우지 못했습니다.' });
  recordUndo(sid, '🗑️ 조사표를 지웠습니다. 휴지통에서 복원할 수 있습니다.', undo, { what: '조사표 지우기' });
}

/** 하나만 만들기 (가져오기·점검용) */
export async function createEvaluation(sid: string, e: NewEval): Promise<string> {
  const at = newPath(sid, 'evaluations');
  await create(at, dataOf(e), { fail: '조사표를 만들지 못했습니다.' });
  return at.id;
}


// 진도 저장 (저장 도우미 + 안내의 되돌리기). 개인 공간 progress/{planId}.
//   저장 = 바뀐 칸만(칸 글자·과목·반·시작일·차시 목록) - 밀기(bumps)는 건드리지 않는다(다른 기기에서 민 것을 덮지 않게, V4 그대로).
//   밀기 = bumps 한 칸 더하기·빼기(누르는 대로 바로) · 지우기 = 지운 표시(휴지통 '기타'에 '진도').
import { create, patch, remove } from '../../data/repo';
import type { Changes } from '../../data/repo/ops';
import type { DocPath, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { shortDateLabel } from '../../domain/dateUtils';
import { isCourse, planKeys, planLabel, toggleBump, type ProgressLesson } from '../../domain/progress';

export const progressPath = (sid: string, id: string): DocPath<'progress'> => ({ sid, coll: 'progress', id });

export interface PlanToSave {
  id: string;
  /** 옛 '칸 글자 하나' 진도의 그 글자 (과정이면 '') */
  key: string;
  startDate: string;
  lessons: ProgressLesson[];
  subject?: string;
  classes?: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 진도 저장 - 새것은 만들고, 있던 것은 바뀐 칸만. 바뀐 것이 없으면 false */
export async function saveProgressPlan(sid: string, next: PlanToSave, before: Stored<'progress'> | undefined): Promise<boolean> {
  const course = isCourse(next);
  const key = course ? planKeys(next)[0] : next.key.trim();
  const lessons = next.lessons.map((l) => ({ unit: l.unit, no: l.no, content: l.content, page: l.page, supplies: l.supplies }));
  const label = planLabel({ ...next, key });
  if (!before || before.deletedAt) {
    const undo = await create(
      progressPath(sid, next.id),
      { key, ...(course ? { subject: (next.subject ?? '').trim(), classes: next.classes } : {}), startDate: next.startDate, lessons, bumps: [] },
      { fail: '진도를 저장하지 못했습니다. 고친 것은 그대로 두었으니 다시 저장해 주세요.' },
    );
    recordUndo(sid, `✅ '${label}' 진도를 저장했습니다.`, undo, { what: '진도 저장' });
    return true;
  }
  const changes: Record<string, unknown> = {};
  if (key !== before.key) changes.key = key;
  if (course) {
    if ((next.subject ?? '').trim() !== (before.subject ?? '')) changes.subject = (next.subject ?? '').trim();
    if (!same(next.classes, before.classes)) changes.classes = next.classes;
  } else {
    if (before.subject !== undefined) changes.subject = undefined;
    if (before.classes !== undefined) changes.classes = undefined;
  }
  if (next.startDate !== before.startDate) changes.startDate = next.startDate;
  if (!same(lessons, before.lessons)) changes.lessons = lessons;
  if (Object.keys(changes).length === 0) return false;
  const undo = await patch(progressPath(sid, next.id), changes as Changes<'progress'>, before, {
    fail: '진도를 저장하지 못했습니다. 고친 것은 그대로 두었으니 다시 저장해 주세요.',
  });
  recordUndo(sid, `✅ '${label}' 진도를 저장했습니다.`, undo, { what: '진도 저장' });
  return true;
}

/** 그 교시를 밀거나(on) 되돌린다 */
export async function setProgressBump(sid: string, plan: Stored<'progress'>, date: string, period: string | number, on: boolean, who = ''): Promise<void> {
  const bumps = plan.bumps ?? [];
  const has = bumps.includes(`${date}#${period}`);
  if (has === on) return;
  const undo = await patch(progressPath(sid, plan.id), { bumps: toggleBump(bumps, date, period) }, plan, {
    fail: on ? '이 교시를 밀지 못했습니다.' : '밀기를 되돌리지 못했습니다.',
  });
  recordUndo(
    sid,
    on
      ? `⏭ ${who}${shortDateLabel(date)} ${period}교시를 밀었습니다. 뒤 차시가 한 칸씩 밀립니다.`
      : `↩ ${shortDateLabel(date)} ${period}교시 밀기를 되돌렸습니다. 뒤 차시가 한 칸씩 당겨집니다.`,
    undo,
    { what: on ? '진도 밀기' : '밀기 되돌리기' },
  );
}

/** 진도 지우기 = 지운 표시 (휴지통에서 되살린다) */
export async function deleteProgressPlan(sid: string, plan: Stored<'progress'>): Promise<void> {
  const undo = await remove(progressPath(sid, plan.id), { fail: '진도를 지우지 못했습니다.' });
  recordUndo(sid, `🗑️ '${planLabel(plan)}' 진도를 지웠습니다. 휴지통에서 되살릴 수 있습니다.`, undo, { what: '진도 지우기' });
}

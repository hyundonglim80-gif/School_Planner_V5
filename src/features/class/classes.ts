// 학급(명렬표) 읽기·쓰기 (V4 hooks/useRoster). 개인 공간 classes/{classId} - classId = '{학년도}-{학년}-{반}'(DESIGN 4-6).
//   읽기: 기기 사본(지운 것 빼고, 학년도 최근 것부터 · 학년·반 차례).
//   쓰기: 명렬표의 💾 저장 한 번 = 바뀐 학급만 한 묶음 - 새 학급은 만들기, 학생·이름은 그 칸만, 학년도·학년·반을 고친 학급은 새 id로 옮기고 옛 것은 지운 표시,
//         지운 학급은 지운 표시(휴지통 '기타'). 되돌리기는 안내·Ctrl+Z.
//   고른 학급은 이 기기에 남긴다(학급 화면 - 학급 도구가 그 학급으로 연다, V4 classMemory).
import { create } from 'zustand';
import { batch, writeOp, type WriteOp } from '../../data/repo';
import { isLive, useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import type { DocPath, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { classIdOf, cleanStudent, compareClasses, describeClass, type RosterClass } from '../../domain/roster';
import { useMemo } from 'react';

export type ClassItem = RosterClass & { id: string };

export const classPath = (sid: string, id: string): DocPath<'classes'> => ({ sid, coll: 'classes', id });

/** 학급 목록 (개인 공간 - 그룹 공간을 보고 있어도 내 학급) */
export function useClasses(): { classes: ClassItem[]; sid: string | null; docs: Readonly<Record<string, Stored<'classes'>>> } {
  const sid = usePersonalSpaceId();
  const docs = useDocs('classes', sid);
  const classes = useMemo(
    () =>
      Object.values(docs)
        .filter(isLive)
        .map((d) => ({ id: d.id, year: d.year, grade: d.grade, num: d.num, ...(d.name ? { name: d.name } : {}), students: d.students ?? [] }))
        .sort(compareClasses),
    [docs],
  );
  return { classes, sid, docs };
}

// ── 고른 학급 (이 기기) ──

const HUB_KEY = 'sp5-class-hub';
const readHub = (): string | null => {
  try {
    return localStorage.getItem(HUB_KEY);
  } catch {
    return null;
  }
};

/** 학급 화면에서 고른 학급 id - 학급 도구(출석부·자리표…)도 처음에 이 학급으로 연다 */
export const useHubClass = create<{ id: string | null }>(() => ({ id: readHub() }));

export function rememberHubClass(id: string) {
  try {
    localStorage.setItem(HUB_KEY, id);
  } catch {
    // 이 기기에 남기지 못할 뿐
  }
  useHubClass.setState({ id });
}

// ── 저장 ──

/** 명렬표에서 고치는 학급 - origId = 저장된 학급(없으면 새것) */
export type ClassDraft = RosterClass & { origId?: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 고친 학급들 → 쓰기 (바뀐 것만) */
export function rosterOps(sid: string, drafts: readonly ClassDraft[], docs: Readonly<Record<string, Stored<'classes'>>>): WriteOp[] {
  const ops: WriteOp[] = [];
  const kept = new Set<string>();
  for (const d of drafts) {
    const id = classIdOf(d);
    const students = d.students.map(cleanStudent).sort((a, b) => a.num - b.num);
    const name = d.name?.trim();
    const data = { year: d.year, grade: d.grade, num: d.num, ...(name ? { name } : {}), students };
    kept.add(id);
    const cur = docs[id];
    if (!cur || cur.deletedAt) {
      ops.push(writeOp.create(classPath(sid, id), data));
      continue;
    }
    const changes: Record<string, unknown> = {};
    if (!same(students, cur.students)) changes.students = students;
    if ((name ?? '') !== (cur.name ?? '')) changes.name = name || undefined;
    if (Object.keys(changes).length) ops.push(writeOp.patch(classPath(sid, id), changes, cur));
  }
  // 지운 학급·학년도·학년·반을 고쳐 옮긴 학급의 옛 자리
  for (const doc of Object.values(docs)) {
    if (!doc.deletedAt && !kept.has(doc.id)) ops.push(writeOp.remove(classPath(sid, doc.id)));
  }
  return ops;
}

/** 저장 - 바뀐 것이 없으면 false. 실패하면 던진다(고친 것은 그대로) */
export async function saveRoster(sid: string, drafts: readonly ClassDraft[], docs: Readonly<Record<string, Stored<'classes'>>>): Promise<boolean> {
  const ops = rosterOps(sid, drafts, docs);
  if (ops.length === 0) return false;
  const undo = await batch(ops, { fail: '명렬표를 저장하지 못했습니다. 고친 것은 그대로 두었으니 다시 저장해 주세요.' });
  const removed = ops.filter((o) => o.type === 'remove').length;
  recordUndo(sid, removed > 0 ? `✅ 명렬표를 저장했습니다. 지운 학급 ${removed}개는 휴지통에서 되살릴 수 있습니다.` : '✅ 명렬표를 저장했습니다.', undo, { what: '명렬표 저장' });
  return true;
}

/** 휴지통 글 '🏫 2026학년도 5학년 2반 (학생 25명)' */
export const classTrashText = (c: Pick<RosterClass, 'year' | 'grade' | 'num'> & { students?: readonly unknown[] }) => `🏫 ${describeClass(c)} (학생 ${c.students?.length ?? 0}명)`;

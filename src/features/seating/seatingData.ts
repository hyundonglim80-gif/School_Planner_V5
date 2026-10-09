// 자리표·학급 허브 읽기·쓰기 (V4 lib/seatingStore.ts) - 개인 공간.
//   seating/{id} = 자리표 한 장(학급 id·자리 sid) - 고칠 때마다 곧바로 저장(바뀐 칸만 - 자리는 한 덩어리라 seats 통째로), 지우기 = 지운 표시(휴지통 '기타').
//   classHub/{classId} = 떨어뜨릴 학생(apart)·발표자 뽑기 이번 판(draw)·저장한 모둠(groupSets - 한 벌씩 칸으로 써서 다른 벌을 덮지 않는다).
//   섞기·번호 차례·지우기는 안내의 되돌리기, 손으로 바꾸기는 Ctrl+Z 더미에만.
import { useMemo } from 'react';
import { create, merge, newPath, patch, remove } from '../../data/repo';
import type { Changes, Undo } from '../../data/repo/ops';
import { isLive, useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import type { DocPath, Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { sanitizeDraw, type DrawState } from '../../domain/draw';
import { sanitizeGroupSets, type GroupSet, type StudentGroup } from '../../domain/groups';
import { pushHistory, sanitizeChart, type SeatingChart } from '../../domain/seating';

export const seatingPath = (sid: string, id: string): DocPath<'seating'> => ({ sid, coll: 'seating', id });
export const hubPath = (sid: string, classId: string): DocPath<'classHub'> => ({ sid, coll: 'classHub', id: classId });

export interface ClassHubView {
  apart: string[];
  draw: DrawState;
  groupSets: GroupSet[];
}

export function sanitizeHub(raw: Partial<Stored<'classHub'>> | undefined | null): ClassHubView {
  const apart = Array.isArray(raw?.apart) ? [...new Set(raw.apart.filter((p): p is string => typeof p === 'string' && p.includes('|')))] : [];
  return { apart, draw: sanitizeDraw(raw?.draw), groupSets: sanitizeGroupSets(raw?.groupSets) };
}

/** 그 학급의 자리표 (만든 차례) + 저장된 문서 */
export function useSeatingCharts(classId: string | null): { charts: SeatingChart[]; docs: Readonly<Record<string, Stored<'seating'>>>; sid: string | null } {
  const sid = usePersonalSpaceId();
  const docs = useDocs('seating', sid);
  const charts = useMemo(
    () =>
      Object.values(docs)
        .filter((d) => isLive(d) && d.classId === classId)
        .map((d) => ({ ...sanitizeChart(d.id, d), createdAt: d.createdAt }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.name.localeCompare(b.name, 'ko')),
    [docs, classId],
  );
  return { charts, docs, sid };
}

/** 학급 허브 (없으면 빈 것) */
export function useClassHub(classId: string | null): { hub: ClassHubView; stored: Stored<'classHub'> | undefined } {
  const sid = usePersonalSpaceId();
  const docs = useDocs('classHub', sid);
  const stored = classId ? docs[classId] : undefined;
  const hub = useMemo(() => sanitizeHub(stored), [stored]);
  return { hub, stored };
}

const FAIL = '자리표를 저장하지 못했습니다. 네트워크를 확인해 주세요.';

/** 새 자리표 - 새 id */
export async function createChart(sid: string, chart: Omit<SeatingChart, 'id'>): Promise<string> {
  const at = newPath(sid, 'seating');
  const { createdAt: _c, updatedAt: _u, ...data } = chart;
  void _c;
  void _u;
  await create(at, data, { fail: '자리표를 만들지 못했습니다.' });
  return at.id;
}

type ChartFields = Partial<Omit<SeatingChart, 'id' | 'classId' | 'createdAt' | 'updatedAt'>>;

/** 칸 몇 개 고치기 - 되돌리기는 message가 있으면 안내로, 없으면 Ctrl+Z 더미에만 */
export async function updateChart(sid: string, stored: Stored<'seating'>, fields: ChartFields, message?: string): Promise<void> {
  const undo = await patch(seatingPath(sid, stored.id), fields as Changes<'seating'>, stored, { fail: FAIL });
  recordUndo(sid, message ?? '자리표', undo, { what: '자리표 고치기', quiet: !message });
}

/** 섞은 자리 저장 - 섞기 전 짝을 지난 짝 기록에 넣고, 안내의 되돌리기로 섞기 전 자리로 */
export async function saveShuffled(sid: string, stored: Stored<'seating'>, chart: SeatingChart, seats: Record<string, string>, message: string): Promise<void> {
  await updateChart(sid, stored, { seats, history: pushHistory(chart, Date.now()) }, message);
}

/** 자리표 지우기 = 지운 표시 (휴지통 '기타') */
export async function deleteChart(sid: string, chart: SeatingChart): Promise<void> {
  const undo = await remove(seatingPath(sid, chart.id), { fail: '자리표를 지우지 못했습니다.' });
  recordUndo(sid, `🗑️ 자리표 '${chart.name}'를 지웠습니다. 휴지통에서 복원할 수 있습니다.`, undo, { what: '자리표 지우기' });
}

/** 떨어뜨릴 학생 목록 바꾸기 */
export async function saveApart(sid: string, classId: string, stored: Stored<'classHub'> | undefined, apart: string[]): Promise<void> {
  const undo = await merge(hubPath(sid, classId), { apart } as Changes<'classHub'>, stored ?? null, { fail: '떨어뜨릴 학생을 저장하지 못했습니다.' });
  recordUndo(sid, '떨어뜨릴 학생', undo, { what: '떨어뜨릴 학생', quiet: true });
}

/** 발표자 뽑기 이번 판 (되돌리는 쓰기를 돌려준다 - 새 판의 안내 되돌리기) */
export async function saveDraw(sid: string, classId: string, stored: Stored<'classHub'> | undefined, draw: DrawState): Promise<Undo> {
  return merge(hubPath(sid, classId), { draw } as Changes<'classHub'>, stored ?? null, { fail: '뽑기를 저장하지 못했습니다.' });
}

/** 모둠 한 벌 저장 (null = 지우기) - 그 벌의 칸만 */
export async function saveGroupSet(
  sid: string,
  classId: string,
  stored: Stored<'classHub'> | undefined,
  id: string,
  set: { name: string; groups: StudentGroup[]; createdAt?: number } | null,
  message?: string,
): Promise<void> {
  const now = Date.now();
  // 새 모둠이면 만든 때 = 지금
  const value = set ? { name: set.name, groups: set.groups.map((g) => ({ name: g.name, members: g.members })), createdAt: set.createdAt ?? now, updatedAt: now } : undefined;
  const undo = await merge(hubPath(sid, classId), { [`groupSets.${id}`]: value } as Changes<'classHub'>, stored ?? null, { fail: '모둠을 저장하지 못했습니다.' });
  recordUndo(sid, message ?? '모둠', undo, { what: '모둠', quiet: !message });
}

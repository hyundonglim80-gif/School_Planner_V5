// 시간표 창의 고친 것 (순수 - 시험한다). 창은 고친 시간표만 들고 사본 위에 얹는다(라벨 관리 창과 같다) - 💾 저장(Ctrl+S)에 한 묶음으로.
//   시간표 한 장 = 문서 하나 timetables/{id} { name, from, to, grid } (DESIGN 4-5). 기간이 겹치면 늦게 시작한 것이 이긴다.
//   '적용' 단추는 없다 - 저장하면 그 기간의 날이 저절로 따라간다(domain/lessons). 그날 바꾼 칸(lessonDays)은 그대로.
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { DocPath, Stored, TimetableGrid } from '../../data/types';
import { schoolYearSpan } from '../../domain/semester';

export interface TimetableDraft {
  id: string;
  name: string;
  from: string;
  to: string;
  grid: TimetableGrid;
}

export const WEEKDAYS = ['1', '2', '3', '4', '5'] as const;

export const timetablePath = (sid: string, id: string): DocPath<'timetables'> => ({ sid, coll: 'timetables', id });

/** 빈 칸을 빼고 글자를 다듬은 표 (요일 '1'~'5', 교시 1~count만) */
export function cleanGrid(grid: TimetableGrid, count?: number): TimetableGrid {
  const out: TimetableGrid = {};
  for (const wd of WEEKDAYS) {
    const row: Record<string, string> = {};
    for (const [n, v] of Object.entries(grid[wd] ?? {})) {
      const text = typeof v === 'string' ? v.trim() : '';
      const num = Number(n);
      if (!text || !Number.isInteger(num) || num < 1 || (count !== undefined && num > count)) continue;
      row[String(num)] = text;
    }
    if (Object.keys(row).length) out[wd] = row;
  }
  return out;
}

export const gridIsEmpty = (grid: TimetableGrid) => Object.keys(cleanGrid(grid)).length === 0;

const sameGrid = (a: TimetableGrid, b: TimetableGrid) => JSON.stringify(cleanGrid(a)) === JSON.stringify(cleanGrid(b));

export const draftOf = (t: Stored<'timetables'>): TimetableDraft => ({ id: t.id, name: t.name, from: t.from, to: t.to, grid: t.grid ?? {} });

/** 저장 전에 고칠 것 (없으면 null) */
export function draftProblem(list: readonly TimetableDraft[]): string | null {
  for (const t of list) {
    const name = t.name.trim() || '이름 없는 시간표';
    if (!t.from || !t.to) return `'${name}'의 기간(시작·끝 날)을 정해 주세요.`;
    if (t.from > t.to) return `'${name}'의 시작 날이 끝 날보다 늦습니다.`;
  }
  return null;
}

/**
 * 고친 것 → 쓰기. edited = 고쳤거나 새로 만든 시간표(사본에 없으면 새것), removed = 지울 시간표.
 * 새것인데 표가 비었으면 만들지 않는다(처음 열 때 보이는 빈 시간표 - 아무것도 적지 않고 저장해도 빈 문서가 생기지 않게).
 */
export function timetableOps(
  sid: string,
  docs: Readonly<Record<string, Stored<'timetables'>>>,
  edited: Readonly<Record<string, TimetableDraft>>,
  removed: readonly string[],
  count: number,
): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const d of Object.values(edited)) {
    if (removed.includes(d.id)) continue;
    const before = docs[d.id] && !docs[d.id].deletedAt ? docs[d.id] : undefined;
    const grid = cleanGrid(d.grid, count);
    const name = d.name.trim() || '시간표';
    if (!before) {
      if (!docs[d.id] && gridIsEmpty(grid)) continue;
      ops.push(writeOp.create(timetablePath(sid, d.id), { name, from: d.from, to: d.to, grid }));
      continue;
    }
    const changes: Record<string, unknown> = {};
    if (name !== before.name) changes.name = name;
    if (d.from !== before.from) changes.from = d.from;
    if (d.to !== before.to) changes.to = d.to;
    if (!sameGrid(grid, before.grid ?? {})) changes.grid = grid;
    if (Object.keys(changes).length) ops.push(writeOp.patch(timetablePath(sid, d.id), changes, before));
  }
  for (const id of removed) {
    if (docs[id] && !docs[id].deletedAt) ops.push(writeOp.remove(timetablePath(sid, id)));
  }
  return ops;
}

/** 처음 시간표 (아무것도 없을 때 창에 보이는 빈 표) - 그 학년도 3월 1일 ~ 이듬해 2월 끝 */
export function firstTimetable(id: string, year: number): TimetableDraft {
  const span = schoolYearSpan(year);
  return { id, name: '1학기 시간표', from: span.start, to: span.end, grid: {} };
}

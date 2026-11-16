// 시간표 창의 고친 것 (순수 - 시험한다). 창은 고친 시간표만 들고 사본 위에 얹는다(라벨 관리 창과 같다).
//   P37(11-16 사용자 요청) - 저장과 적용을 나눴다(domain/timetableApply):
//   💾 저장(Ctrl+S) = **저장된 시간표**(이름·표만, `kind: 'saved'`) 한 묶음 - 지워도 이미 적용한 날은 그대로.
//   ✅ 적용 = 고른 기간에 지금 표를 **적용된 시간표**(기간 + 그때의 표)로 - 겹친 날만 새 표, 앞뒤 날은 그대로. 그날 바꾼 칸(lessonDays)은 그대로.
import { newId } from '../../data/id';
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { DocPath, Stored, TimetableGrid } from '../../data/types';
import { effectiveSegments, FAR_END, isAppliedTimetable, isSavedTimetable, planApplied, type Piece } from '../../domain/timetableApply';

/** 저장된 시간표 하나 (창이 고치는 것 - 이름·표만) */
export interface TimetableDraft {
  id: string;
  name: string;
  grid: TimetableGrid;
}

type Docs = Readonly<Record<string, Stored<'timetables'>>>;

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

export const sameGrid = (a: TimetableGrid, b: TimetableGrid) => JSON.stringify(cleanGrid(a)) === JSON.stringify(cleanGrid(b));

const nameOf = (name: string | undefined) => name?.trim() || '시간표';

export const draftOf = (t: Pick<Stored<'timetables'>, 'id' | 'name' | 'grid'>): TimetableDraft => ({ id: t.id, name: t.name, grid: t.grid ?? {} });

/**
 * 고친 것 → 쓰기 (저장된 시간표만 - 적용된 날은 건드리지 않는다).
 * edited = 고쳤거나 새로 만든 시간표(사본에 없으면 새것), removed = 지울 시간표.
 * 새것인데 표가 비었으면 만들지 않는다(처음 열 때 보이는 빈 시간표 - 아무것도 적지 않고 저장해도 빈 문서가 생기지 않게).
 */
export function timetableOps(sid: string, docs: Docs, edited: Readonly<Record<string, TimetableDraft>>, removed: readonly string[], count: number): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const d of Object.values(edited)) {
    if (removed.includes(d.id)) continue;
    const before = docs[d.id] && !docs[d.id].deletedAt ? docs[d.id] : undefined;
    const grid = cleanGrid(d.grid, count);
    const name = nameOf(d.name);
    if (!before) {
      if (!docs[d.id] && gridIsEmpty(grid)) continue;
      ops.push(writeOp.create(timetablePath(sid, d.id), { kind: 'saved', name, from: '', to: '', grid }));
      continue;
    }
    const changes: Record<string, unknown> = {};
    if (name !== before.name) changes.name = name;
    if (!sameGrid(grid, before.grid ?? {})) changes.grid = grid;
    if (Object.keys(changes).length) ops.push(writeOp.patch(timetablePath(sid, d.id), changes, before));
  }
  for (const id of removed) {
    if (docs[id] && !docs[id].deletedAt) ops.push(writeOp.remove(timetablePath(sid, id)));
  }
  return ops;
}

/** 적용할 표 */
export interface ApplyInput {
  name: string;
  grid: TimetableGrid;
  /** 어느 저장된 시간표에서 왔나 */
  saveId: string;
}

/**
 * ✅ 적용(input 있음) / 적용 빼기(input 없음) → 쓰기. cut = 그 기간(끝 FAR_END = 끝 날 없음).
 * 겹친 적용된 문서는 cut 밖의 날만 남긴다(줄이기 · 둘로 나누면 뒤 조각은 같은 표로 새 문서 · 다 덮이면 지운다).
 * 새 적용은 다 덮인 문서가 있으면 그 문서를 새 기간·표로 고쳐 쓴다(같은 기간에 다시 적용할 때마다 휴지통이 쌓이지 않게).
 */
export function applyOps(
  sid: string,
  docs: Docs,
  cut: Piece,
  input: ApplyInput | null,
  count: number,
  makeId: () => string = newId,
): WriteOp[] {
  const live = Object.values(docs).filter((d) => !d.deletedAt);
  const plan = planApplied(live, cut);
  const field = (to: string) => (to === FAR_END ? '' : to);
  const ops: WriteOp[] = [];
  for (const { id, pieces } of plan.reshape) {
    const before = docs[id];
    const [first, ...rest] = pieces;
    const changes: Record<string, unknown> = {};
    if (first.from !== before.from) changes.from = first.from;
    if (field(first.to) !== (before.to ?? '')) changes.to = field(first.to);
    if (Object.keys(changes).length) ops.push(writeOp.patch(timetablePath(sid, id), changes, before));
    for (const p of rest) {
      ops.push(
        writeOp.create(timetablePath(sid, makeId()), {
          name: before.name,
          from: p.from,
          to: field(p.to),
          grid: before.grid ?? {},
          ...(before.saveId ? { saveId: before.saveId } : {}),
        }),
      );
    }
  }
  const reuse = input ? plan.drop[0] : undefined;
  for (const id of plan.drop) if (id !== reuse) ops.push(writeOp.remove(timetablePath(sid, id)));
  if (input) {
    const data = { name: nameOf(input.name), from: cut.from, to: field(cut.to), grid: cleanGrid(input.grid, count), saveId: input.saveId };
    if (reuse) ops.push(writeOp.patch(timetablePath(sid, reuse), data, docs[reuse]));
    else ops.push(writeOp.create(timetablePath(sid, makeId()), data));
  }
  return ops;
}

/** P37 전 자료의 저장된 시간표 베끼기 - 같은 이름·표는 하나로 */
export interface SavedCopy {
  /** `<첫 적용된 문서 id>-saved` (기기 둘이 함께 열어도 같은 문서) 또는 이미 있는 같은 저장된 시간표 */
  id: string;
  name: string;
  grid: TimetableGrid;
  /** 이 저장된 시간표에서 왔다고 이을 적용된 문서들 */
  of: string[];
  /** 이미 문서가 있다 (잇기만) */
  exists: boolean;
}

/**
 * P37 전에는 시간표 한 장이 저장과 적용을 함께 맡았다 - 그 표들이 저장된 시간표 칩에도 보이게 베낄 것.
 * 어디에서 왔는지 모르는(saveId 없는) 적용된 문서 가운데 실제로 쓰이는 날이 있는 것만(늘 가려져 쓰이지 않던 옛 표는 뺀다).
 * 창이 열려 서버에서 받은 뒤 한 번 쓴다(savedCopyOps) - 그 전에도 칩에는 보인다(같은 id).
 */
export function savedCopies(docs: Docs): SavedCopy[] {
  const live = Object.values(docs).filter((d) => !d.deletedAt);
  const saved = live.filter(isSavedTimetable);
  const used = new Set(effectiveSegments(live).map((s) => s.id));
  const groups = new Map<string, SavedCopy>();
  const legacy = live
    .filter((t) => isAppliedTimetable(t) && !t.saveId && used.has(t.id))
    .sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id));
  for (const t of legacy) {
    const name = nameOf(t.name);
    const grid = cleanGrid(t.grid ?? {});
    const key = `${name}\n${JSON.stringify(grid)}`;
    let g = groups.get(key);
    if (!g) {
      const same = saved.find((s) => nameOf(s.name) === name && sameGrid(s.grid ?? {}, grid));
      const id = same?.id ?? `${t.id}-saved`;
      g = { id, name, grid, of: [], exists: !!docs[id] };
      groups.set(key, g);
    }
    g.of.push(t.id);
  }
  return [...groups.values()];
}

/** 위 베끼기의 쓰기 - 저장된 시간표를 만들고(없으면) 적용된 문서에 saveId를 잇는다 */
export function savedCopyOps(sid: string, docs: Docs): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const c of savedCopies(docs)) {
    if (!c.exists) ops.push(writeOp.create(timetablePath(sid, c.id), { kind: 'saved', name: c.name, from: '', to: '', grid: c.grid }));
    for (const id of c.of) ops.push(writeOp.patch(timetablePath(sid, id), { saveId: c.id }, docs[id]));
  }
  return ops;
}

/** 처음 시간표 (아무것도 없을 때 창에 보이는 빈 표) */
export function firstTimetable(id: string): TimetableDraft {
  return { id, name: '1학기 시간표', grid: {} };
}

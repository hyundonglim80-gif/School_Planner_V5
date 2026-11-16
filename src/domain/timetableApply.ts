// 시간표 적용 (P37 11-16 사용자 요청 - 순수, 시험한다).
//   시간표 문서(timetables)는 두 가지다:
//   - **저장된 시간표** = 이름·표만(`kind: 'saved'`, 기간 없음). 시간표 창 위 칩. 지워도 이미 적용한 날은 그대로다.
//   - **적용된 시간표** = 기간 + 그때의 표(`from`~`to`, `saveId` = 어느 저장된 시간표에서 왔나). 수업 칸은 이것만 따른다(domain/lessons).
//   '적용'은 그 기간에 표를 덧칠한다 - 겹친 날은 새로 적용한 표가 이기고, 앞뒤 날은 그대로(앞 문서의 기간을 줄이거나 둘로 나눈다).
//   그래서 적용한 뒤에는 적용된 문서끼리 날이 겹치지 않는다. 그 전(P37 전) 자료는 겹칠 수 있어 '늦게 시작한 것이 이긴다'(timetableOn)로 읽는다.
//   기간 없는 옛 V4 가져온 표(`from: ''`)는 어느 날에도 쓰이지 않아 저장된 시간표로 본다.
//   P39(11-16 사용자 요청): 적용 방식을 고른다 - 🖌️ 덮어쓰기(위 덧칠) / 🧩 빈 칸만 채우기(fillPieces - 앞 표의 과목은 그대로,
//   빈 칸과 적용된 표가 없는 날에만 새 표의 과목). 채운 날도 앞 문서에서 빼고 새 문서로 쓰니 겹치지 않는 것은 같다.
import { addDays } from './dateUtils';
import { timetableOn, type TimetableLike } from './lessons';

/** 끝 날 없음(`to: ''`)을 셈할 때 쓰는 먼 날 */
export const FAR_END = '9999-12-31';

export interface Piece {
  from: string;
  /** FAR_END = 끝 날 없음 */
  to: string;
}

/** 적용된 날 조각 - 그 날들이 따르는 문서 */
export interface Segment extends Piece {
  id: string;
}

type Kinded = { kind?: string; from?: string };

/** 저장된 시간표인가 (기간 없는 옛 표 포함) */
export const isSavedTimetable = (t: Kinded) => t.kind === 'saved' || !t.from;
/** 적용된 시간표인가 - 수업 칸이 따르는 것 */
export const isAppliedTimetable = (t: Kinded) => !isSavedTimetable(t);

const endOf = (t: { to?: string }) => t.to || FAR_END;

/**
 * 날마다 실제로 쓰이는 문서를 이어진 조각으로 (시작 날 차례).
 * 문서가 시작하거나 끝나는 날을 경계로 자르면 그 사이의 이기는 문서는 같다 - 경계마다 timetableOn으로 고른다(수업 칸과 같은 셈).
 */
export function effectiveSegments<T extends TimetableLike & Kinded>(list: readonly T[]): Segment[] {
  const applied = list.filter(isAppliedTimetable);
  const marks = new Set<string>();
  for (const t of applied) {
    marks.add(t.from);
    const end = endOf(t);
    if (end !== FAR_END) marks.add(addDays(end, 1));
  }
  const points = [...marks].sort();
  const out: Segment[] = [];
  points.forEach((from, i) => {
    const winner = timetableOn(from, applied);
    if (!winner) return;
    const to = i + 1 < points.length ? addDays(points[i + 1], -1) : FAR_END;
    const last = out[out.length - 1];
    if (last && last.id === winner.id && addDays(last.to, 1) === from) last.to = to;
    else out.push({ id: winner.id, from, to });
  });
  return out;
}

/** 조각에서 [cut.from, cut.to]를 뺀다 (앞·뒤가 남으면 둘로) */
export function cutPieces<P extends Piece>(pieces: readonly P[], cut: Piece): P[] {
  const out: P[] = [];
  for (const p of pieces) {
    if (p.to < cut.from || p.from > cut.to) {
      out.push(p);
      continue;
    }
    if (p.from < cut.from) out.push({ ...p, to: addDays(cut.from, -1) });
    if (p.to > cut.to) out.push({ ...p, from: addDays(cut.to, 1) });
  }
  return out;
}

type Grid = TimetableLike['grid'];

const cellText = (grid: Grid, wd: string, n: string) => {
  const v = grid[wd]?.[n];
  return typeof v === 'string' ? v.trim() : '';
};

/**
 * 빈 칸만 채우기 (P39 11-16 사용자 '기존 시간표에서 겹치지 않은 시간표만 적용').
 * 앞 표(base)에 과목이 있는 칸은 그대로, 빈 칸에만 add의 과목 - 둘 다 있으면 앞 표가 이긴다.
 * added = 채운 칸 수 (0이면 바뀐 것이 없다).
 */
export function fillGrid(base: Grid, add: Grid): { grid: Record<string, Record<string, string>>; added: number } {
  const grid: Record<string, Record<string, string>> = {};
  for (const [wd, row] of Object.entries(base)) {
    for (const n of Object.keys(row ?? {})) {
      const text = cellText(base, wd, n);
      if (text) (grid[wd] ??= {})[n] = text;
    }
  }
  let added = 0;
  for (const [wd, row] of Object.entries(add)) {
    for (const n of Object.keys(row ?? {})) {
      const text = cellText(add, wd, n);
      if (!text || grid[wd]?.[n]) continue;
      (grid[wd] ??= {})[n] = text;
      added++;
    }
  }
  return { grid, added };
}

/** 빈 칸만 채우기로 새로 쓸 조각 하나 */
export interface FillPiece extends Piece {
  /** 채운 앞 문서 (null = 적용된 표가 없던 날 - 새 표 그대로) */
  baseId: string | null;
  grid: Grid;
}

/**
 * cut 기간에 grid를 빈 칸만 채우기로 적용하면 새로 쓸 조각들 (시작 날 차례).
 * 날마다 쓰이는 앞 표마다 그 표에 grid를 채운 표(채울 칸이 없으면 그 조각은 그대로라 뺀다), 적용된 표가 없는 날은 grid 그대로.
 * 빈 배열 = 채울 것이 없다. 앞 문서에서 이 조각들을 빼는 것은 planApplied(list, 조각들).
 */
export function fillPieces<T extends TimetableLike & Kinded>(list: readonly T[], cut: Piece, grid: Grid): FillPiece[] {
  const applied = list.filter(isAppliedTimetable);
  const byId = new Map(applied.map((t) => [t.id, t]));
  const out: FillPiece[] = [];
  const empty = Object.values(grid).every((row) => Object.values(row ?? {}).every((v) => !(typeof v === 'string' && v.trim())));
  let cursor: string | null = cut.from;
  const gap = (to: string) => {
    if (cursor && cursor <= to && !empty) out.push({ from: cursor, to, baseId: null, grid });
  };
  for (const s of effectiveSegments(applied)) {
    if (!cursor || s.to < cursor || s.from > cut.to) continue;
    const from = s.from > cursor ? s.from : cursor;
    const to = s.to < cut.to ? s.to : cut.to;
    if (from > cursor) gap(addDays(from, -1));
    const filled = fillGrid(byId.get(s.id)?.grid ?? {}, grid);
    if (filled.added) out.push({ from, to, baseId: s.id, grid: filled.grid });
    cursor = to >= cut.to ? null : addDays(to, 1);
  }
  if (cursor) gap(cut.to);
  return out;
}

export interface AppliedPlan {
  /** 기간이 바뀌는 문서 - 첫 조각은 그 문서에, 나머지는 같은 표로 새 문서 (시작 날 차례) */
  reshape: Array<{ id: string; pieces: Piece[] }>;
  /** 맡을 날이 없어진 문서 (새로 적용한 기간에 다 덮였거나, 옛 자료에서 늘 가려져 쓰이지 않던 것) */
  drop: string[];
}

/**
 * 적용된 문서들이 cut 기간을 비우려면 어떻게 바뀌나 (cut이 없으면 겹친 옛 자료를 겹치지 않게 다듬기만).
 * 새로 적용할 때 = 이것 + cut 기간의 새 문서 하나. 적용 빼기 = 이것만. 빈 칸만 채우기 = cut에 채울 조각들(fillPieces)을 주고 + 조각마다 새 문서.
 * 날마다 쓰이는 문서는 cut 밖에서 그대로다(조각이 그날의 이기는 문서를 그대로 옮긴다).
 */
export function planApplied<T extends TimetableLike & Kinded>(list: readonly T[], cut: Piece | readonly Piece[] | null): AppliedPlan {
  const applied = list.filter(isAppliedTimetable);
  const segments = effectiveSegments(applied);
  const cuts: readonly Piece[] = !cut ? [] : 'from' in cut ? [cut] : cut;
  const left = cuts.reduce<Segment[]>((pieces, c) => cutPieces(pieces, c), segments);
  const byId = new Map<string, Piece[]>();
  for (const s of left) byId.set(s.id, [...(byId.get(s.id) ?? []), { from: s.from, to: s.to }]);
  const reshape: AppliedPlan['reshape'] = [];
  const drop: string[] = [];
  for (const t of applied) {
    const pieces = byId.get(t.id);
    if (!pieces?.length) {
      drop.push(t.id);
      continue;
    }
    const same = pieces.length === 1 && pieces[0].from === t.from && pieces[0].to === endOf(t);
    if (!same) reshape.push({ id: t.id, pieces });
  }
  return { reshape, drop };
}

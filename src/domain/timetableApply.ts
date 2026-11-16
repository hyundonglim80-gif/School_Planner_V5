// 시간표 적용 (P37 11-16 사용자 요청 - 순수, 시험한다).
//   시간표 문서(timetables)는 두 가지다:
//   - **저장된 시간표** = 이름·표만(`kind: 'saved'`, 기간 없음). 시간표 창 위 칩. 지워도 이미 적용한 날은 그대로다.
//   - **적용된 시간표** = 기간 + 그때의 표(`from`~`to`, `saveId` = 어느 저장된 시간표에서 왔나). 수업 칸은 이것만 따른다(domain/lessons).
//   '적용'은 그 기간에 표를 덧칠한다 - 겹친 날은 새로 적용한 표가 이기고, 앞뒤 날은 그대로(앞 문서의 기간을 줄이거나 둘로 나눈다).
//   그래서 적용한 뒤에는 적용된 문서끼리 날이 겹치지 않는다. 그 전(P37 전) 자료는 겹칠 수 있어 '늦게 시작한 것이 이긴다'(timetableOn)로 읽는다.
//   기간 없는 옛 V4 가져온 표(`from: ''`)는 어느 날에도 쓰이지 않아 저장된 시간표로 본다.
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

export interface AppliedPlan {
  /** 기간이 바뀌는 문서 - 첫 조각은 그 문서에, 나머지는 같은 표로 새 문서 (시작 날 차례) */
  reshape: Array<{ id: string; pieces: Piece[] }>;
  /** 맡을 날이 없어진 문서 (새로 적용한 기간에 다 덮였거나, 옛 자료에서 늘 가려져 쓰이지 않던 것) */
  drop: string[];
}

/**
 * 적용된 문서들이 cut 기간을 비우려면 어떻게 바뀌나 (cut이 없으면 겹친 옛 자료를 겹치지 않게 다듬기만).
 * 새로 적용할 때 = 이것 + cut 기간의 새 문서 하나. 적용 빼기 = 이것만.
 * 날마다 쓰이는 문서는 cut 밖에서 그대로다(조각이 그날의 이기는 문서를 그대로 옮긴다).
 */
export function planApplied<T extends TimetableLike & Kinded>(list: readonly T[], cut: Piece | null): AppliedPlan {
  const applied = list.filter(isAppliedTimetable);
  const segments = effectiveSegments(applied);
  const left = cut ? cutPieces(segments, cut) : segments;
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

// 메모 쓰기에서 '무엇을 적나' (순수 - 서버 없이 시험한다). 적는 것은 actions.ts.
//
// - 메모는 한 종류(kind 'note')다. 날짜 링크(P10-3 - domain/noteDates)가 있으면 그 날마다 하루 '메모' 칸에도.
// - 쓰기마다 문서 하나(원칙 1): 완료 = done·doneAt, 즐겨찾기 = favorite, 체크 줄 = text, 순서 = 옮긴 것의 order(대개 하나).
// - 차례·완료·자리(itemPath)는 일정과 같은 셈을 쓴다(features/events/eventOps).
import { toggleCheckLine } from '../../domain/checkLines';
import { noteDates } from '../../domain/noteDates';
import { compareOrder, rekeyOrders } from '../../domain/order';
import { writeOp, type Changes, type WriteOp } from '../../data/repo/ops';
import { itemPath, orderBefore, reorderOps, type ItemDoc } from '../events/eventOps';

/** 기록 카드 머리줄의 쓴 시각 (V4 그대로 '오후 03:12') */
export const timeLabel = (ms: number | undefined) =>
  ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';

/** 즐겨찾기 / 풀기에 바꿀 칸 (풀면 칸을 지운다 - 켠 것만 적는다) */
export function favoriteChanges(favorite: boolean): Changes<'items'> {
  return { favorite: favorite ? true : undefined };
}

/**
 * 보이는 차례 = 즐겨찾기 먼저, 그 안에서는 저장된 차례(V4 - 즐겨찾기한 기록은 그날 기록의 맨 위).
 * 받은 목록은 이미 차례대로다(data/select) - 즐겨찾기만 앞으로 모은다.
 */
export function favoriteFirst(list: readonly ItemDoc[]): ItemDoc[] {
  return [...list.filter((d) => d.favorite), ...list.filter((d) => !d.favorite)];
}

/**
 * 보이는 목록에서 한 칸 앞(-1)·뒤(+1)로. 즐겨찾기는 늘 위에 모이므로 즐겨찾기끼리, 나머지끼리만 바꾼다(V4 메모 그대로).
 * 옮길 수 없으면 null. 같은 무리 안은 차례대로라 옮긴 것의 order만 고친다(reorderOps).
 */
export function noteMoveOps(sid: string, shown: readonly ItemDoc[], index: number, step: -1 | 1): WriteOp[] | null {
  const item = shown[index];
  if (!item) return null;
  const group = shown.filter((d) => !!d.favorite === !!item.favorite).sort(compareOrder);
  const from = group.findIndex((d) => d.id === item.id);
  const to = from + step;
  if (to < 0 || to >= group.length) return null;
  const ops = reorderOps(sid, group, from, to);
  return ops.length > 0 ? ops : null;
}

/**
 * 끌어 놓기: 보이는 목록의 from 번째를 to 번째 자리로. ▲▼처럼 즐겨찾기끼리, 나머지끼리만(다르면 null).
 * 같은 무리 안 차례로 바꿔 옮긴 것의 order만 고친다.
 */
export function noteDragOps(sid: string, shown: readonly ItemDoc[], from: number, to: number): WriteOp[] | null {
  const a = shown[from];
  const b = shown[to];
  if (!a || !b || a.id === b.id || !!a.favorite !== !!b.favorite) return null;
  const group = shown.filter((d) => !!d.favorite === !!a.favorite).sort(compareOrder);
  const ops = reorderOps(
    sid,
    group,
    group.findIndex((d) => d.id === a.id),
    group.findIndex((d) => d.id === b.id),
  );
  return ops.length > 0 ? ops : null;
}

/** 앞·뒤로 옮길 수 있나 (▲▼ 단추를 흐리게) */
export function canMoveNote(shown: readonly ItemDoc[], index: number, step: -1 | 1): boolean {
  const item = shown[index];
  const next = shown[index + step];
  return !!item && !!next && !!item.favorite === !!next.favorite;
}

/**
 * 카드의 '☐ 우유' 줄 누르기 = 그 줄의 체크 글자만 바꾼 글. 그새 그 줄이 바뀌었으면(다른 기기에서 고쳤다) null - 엉뚱한 줄을 바꾸지 않는다.
 * 글 전체를 다시 적지만 바뀐 것은 그 글자 하나다(누른 사람이 고른 것 - 읽기·저장 길에서 본문을 바꾸는 것이 아니다).
 */
export function checkLineChanges(item: ItemDoc, lineIndex: number, shownLine: string): Changes<'items'> | null {
  const text = toggleCheckLine(item.text ?? '', lineIndex, shownLine);
  return text === null ? null : { text };
}

/** 가장 늦은 날짜 링크 (없으면 '') */
const latestDate = (d: ItemDoc) => noteDates(d).at(-1) ?? '';

/**
 * 메모 화면 차례 값을 적는 칸 (#140): 날짜 없는 메모 = order(메모 화면에만 보인다),
 * 날짜 링크 메모 = memoOrder(order는 하루 메모 칸 차례 - 메모 화면에서 옮겨도 하루 칸 차례는 그대로).
 */
export const memoKeyField = (d: ItemDoc): 'order' | 'memoOrder' => (noteDates(d).length > 0 ? 'memoOrder' : 'order');

/** 메모 화면 차례 값. 메모 화면에서 옮긴 적 없는 날짜 링크 메모는 null - 값이 있는 메모 뒤에 날짜 차례로 선다 */
export const memoKey = (d: ItemDoc): string | null => (noteDates(d).length > 0 ? (d.memoOrder ?? null) : d.order);

/** 차례 값이 없는 날짜 링크 메모끼리: 가장 늦은 날이 최근인 것부터, 같으면 하루 칸 차례 */
const byDate = (a: ItemDoc, b: ItemDoc) => latestDate(b).localeCompare(latestDate(a)) || compareOrder(a, b);
const byMemoKey = (a: ItemDoc, b: ItemDoc) => compareOrder({ order: memoKey(a) ?? '', id: a.id }, { order: memoKey(b) ?? '', id: b.id });

/**
 * 메모 화면 차례 (P10-3 - 날짜 링크 메모도 함께): 즐겨찾기 먼저, 그 안에서 차례 값이 있는 메모(날짜 없는 메모와 메모 화면에서 옮긴 날짜 링크 메모 - 값 차례)
 * → 옮긴 적 없는 날짜 링크 메모(가장 늦은 날이 최근인 것부터, 같으면 차례). 옮긴 메모가 없으면 예전 그대로 '날짜 없는 메모 → 날짜 링크 메모'다.
 */
export function memoScreenOrder(list: readonly ItemDoc[]): ItemDoc[] {
  const rank = (d: ItemDoc) => (d.favorite ? 0 : 2) + (memoKey(d) === null ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b) || (memoKey(a) === null ? byDate(a, b) : byMemoKey(a, b)));
}

/**
 * 메모 화면에서 보이는 목록(memoScreenOrder 차례)의 from 번째를 to 번째 자리로 (▲▼는 to = from ± 1, #140 - 날짜 링크 메모도 옮긴다).
 * 즐겨찾기끼리·나머지끼리만(다르면 null). 쓰는 칸은 memoKeyField - 날짜 링크 메모는 memoOrder라 하루 메모 칸 차례는 그대로다.
 * 맨 뒤에 남은 '옮긴 적 없는 날짜 링크 메모'가 날짜 차례 그대로면 값을 적지 않는다(옛 기록이 많아도 옮긴 자리까지만 적는다).
 */
export function memoReorderOps(sid: string, shown: readonly ItemDoc[], from: number, to: number): WriteOp[] | null {
  const a = shown[from];
  const b = shown[to];
  if (!a || !b || a.id === b.id || !!a.favorite !== !!b.favorite) return null;
  const next = shown.filter((d) => !!d.favorite === !!a.favorite);
  const at = next.indexOf(b);
  next.splice(next.indexOf(a), 1);
  next.splice(at, 0, a);
  let tail = next.length;
  while (tail > 0 && memoKey(next[tail - 1]) === null && (tail === next.length || byDate(next[tail - 1], next[tail]) <= 0)) tail--;
  const head = next.slice(0, tail);
  const keys = rekeyOrders(head.map(memoKey));
  const ops: WriteOp[] = [];
  head.forEach((d, i) => {
    const changes: Changes<'items'> = memoKeyField(d) === 'order' ? { order: keys[i] } : { memoOrder: keys[i] };
    if (keys[i] !== memoKey(d)) ops.push(writeOp.patch(itemPath(sid, d.id), changes, d));
  });
  return ops.length > 0 ? ops : null;
}

/** 메모 화면 맨 앞 차례 값 (메모 화면에서 쓴 새 메모 - 옮겨 올린 날짜 링크 메모보다도 위, P11-1) */
export const memoOrderBefore = (list: readonly ItemDoc[]) => orderBefore(list.map((d) => ({ order: memoKey(d) ?? undefined })));

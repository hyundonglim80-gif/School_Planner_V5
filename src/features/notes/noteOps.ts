// 메모·기록 쓰기에서 '무엇을 적나' (순수 - 서버 없이 시험한다). 적는 것은 actions.ts.
//
// - 메모·기록은 한 종류(kind 'note')다. 날짜가 있으면 그날 기록, 없으면 메모(DESIGN 4-2 - V4 '날짜 칸 = 자리').
// - 쓰기마다 문서 하나(원칙 1): 완료 = done·doneAt, 즐겨찾기 = favorite, 체크 줄 = text, 순서 = 옮긴 것의 order(대개 하나).
// - 차례·완료·자리(itemPath)는 일정과 같은 셈을 쓴다(features/events/eventOps).
import { toggleCheckLine } from '../../domain/checkLines';
import { compareOrder } from '../../domain/order';
import type { Changes, WriteOp } from '../../data/repo/ops';
import { reorderOps, type ItemDoc } from '../events/eventOps';

export type NoteNoun = '메모' | '기록';

/** 메모인가 기록인가 (날짜 칸 = 자리) */
export const nounOf = (item: { date?: string | null }): NoteNoun => (item.date ? '기록' : '메모');

/** '기록을'·'메모를' (안내 글) */
export const objectOf = (noun: NoteNoun) => (noun === '기록' ? '기록을' : '메모를');

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

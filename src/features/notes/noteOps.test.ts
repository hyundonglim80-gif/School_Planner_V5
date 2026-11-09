import { describe, expect, it } from 'vitest';
import type { ItemDoc } from '../events/eventOps';
import {
  canMoveNote,
  checkLineChanges,
  favoriteChanges,
  favoriteFirst,
  memoKey,
  memoOrderBefore,
  memoReorderOps,
  memoScreenOrder,
  noteDragOps,
  noteMoveOps,
} from './noteOps';

const note = (id: string, order: string, more: Partial<ItemDoc> = {}): ItemDoc =>
  ({ id, order, kind: 'note', date: '2026-10-08', text: id, labelIds: [], ...more }) as unknown as ItemDoc;

/** 쓰기를 적용한 뒤의 차례 */
function orderAfterOps(list: ItemDoc[], ops: ReturnType<typeof noteMoveOps>): string[] {
  const orders = new Map(list.map((d) => [d.id, d.order]));
  for (const op of ops ?? []) if (op.type === 'patch') orders.set(op.at.id, op.changes.order as string);
  return [...orders.entries()].sort((x, y) => (x[1] < y[1] ? -1 : 1)).map(([id]) => id);
}

describe('메모 셈', () => {
  it('메모 화면 차례: 즐겨찾기 → 날짜 없는 메모(차례) → 날짜 링크 메모(가장 늦은 날이 최근인 것부터)', () => {
    const list = [
      note('m2', 'a2', { date: null }),
      note('d1', 'a0', { date: '2026-10-01' }),
      note('m1', 'a1', { date: null }),
      note('d2', 'a5', { date: '2026-09-01', dates: ['2026-09-01', '2026-10-09'] }),
      note('fd', 'a9', { date: '2026-10-02', favorite: true }),
      note('fm', 'a9', { date: null, favorite: true }),
    ];
    expect(memoScreenOrder(list).map((d) => d.id)).toEqual(['fm', 'fd', 'm1', 'm2', 'd2', 'd1']);
  });

  it('즐겨찾기는 켠 것만 적는다 (풀면 칸을 지운다)', () => {
    expect(favoriteChanges(true)).toEqual({ favorite: true });
    expect(favoriteChanges(false)).toEqual({ favorite: undefined });
  });

  it('즐겨찾기 먼저, 그 안에서는 차례 그대로', () => {
    const list = [note('a', 'a0'), note('b', 'a1', { favorite: true }), note('c', 'a2'), note('d', 'a3', { favorite: true })];
    expect(favoriteFirst(list).map((d) => d.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('▲▼는 즐겨찾기끼리·나머지끼리만 - 옮긴 것의 order 하나', () => {
    const list = [note('a', 'a0'), note('b', 'a1', { favorite: true }), note('c', 'a2'), note('d', 'a3', { favorite: true })];
    const shown = favoriteFirst(list); // b d a c
    // 즐겨찾기 끝(d)에서 뒤로는 못 간다 (다음이 즐겨찾기 아닌 a)
    expect(canMoveNote(shown, 1, 1)).toBe(false);
    expect(noteMoveOps('u_me', shown, 1, 1)).toBeNull();
    expect(canMoveNote(shown, 0, -1)).toBe(false);
    // c를 a 앞으로 = 문서 하나
    expect(canMoveNote(shown, 3, -1)).toBe(true);
    const ops = noteMoveOps('u_me', shown, 3, -1)!;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: 'patch' });
    expect(orderAfterOps(list, ops).filter((id) => id === 'a' || id === 'c')).toEqual(['c', 'a']);
    // 즐겨찾기 d를 b 앞으로
    const fav = noteMoveOps('u_me', shown, 1, -1)!;
    expect(orderAfterOps(list, fav).filter((id) => id === 'b' || id === 'd')).toEqual(['d', 'b']);
  });

  it('체크 줄 누르기 = 그 줄의 글자만, 그새 바뀐 줄이면 null', () => {
    const item = note('a', 'a0', { text: '장보기\n☐ 우유\n☑ 빵' });
    expect(checkLineChanges(item, 1, '☐ 우유')).toEqual({ text: '장보기\n☑ 우유\n☑ 빵' });
    expect(checkLineChanges(item, 2, '☑ 빵')).toEqual({ text: '장보기\n☐ 우유\n☐ 빵' });
    expect(checkLineChanges(item, 1, '☐ 두유')).toBeNull();
    expect(checkLineChanges(item, 0, '장보기')).toBeNull();
  });
});

describe('메모 화면에서 날짜 링크 메모도 옮긴다 (#140)', () => {
  /** 쓰기를 적용한 문서들 */
  function applied(list: ItemDoc[], ops: ReturnType<typeof memoReorderOps>): ItemDoc[] {
    const byId = new Map(list.map((d) => [d.id, { ...d }]));
    for (const op of ops ?? []) if (op.type === 'patch') Object.assign(byId.get(op.at.id)!, op.changes);
    return [...byId.values()];
  }
  const list = [
    note('m1', 'a1', { date: null }),
    note('m2', 'a2', { date: null }),
    note('d1', 'a0', { date: '2026-10-09' }),
    note('d2', 'a5', { date: '2026-10-05' }),
    note('d3', 'a3', { date: '2026-10-01' }),
  ];
  const shown = memoScreenOrder(list); // m1 m2 d1 d2 d3

  it('날짜 링크 메모를 맨 위로 = 그 메모의 memoOrder 하나 (하루 칸 차례 order는 그대로)', () => {
    expect(shown.map((d) => d.id)).toEqual(['m1', 'm2', 'd1', 'd2', 'd3']);
    const ops = memoReorderOps('u_me', shown, 3, 0)!;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: 'patch', at: { id: 'd2' } });
    expect(Object.keys((ops[0] as { changes: object }).changes)).toEqual(['memoOrder']);
    const after = applied(list, ops);
    expect(memoScreenOrder(after).map((d) => d.id)).toEqual(['d2', 'm1', 'm2', 'd1', 'd3']);
    expect(after.find((d) => d.id === 'd2')?.order).toBe('a5');
  });

  it('▲ 한 칸 - 날짜 링크 메모끼리도 바뀌고, 뒤에 날짜 차례대로 남은 메모는 적지 않는다', () => {
    // d2를 d1 위로 = d2만 값을 받는다 (d1·d3은 날짜 차례 그대로 뒤에)
    const ops = memoReorderOps('u_me', shown, 3, 2)!;
    expect(ops.map((o) => (o as { at: { id: string } }).at.id)).toEqual(['d2']);
    expect(memoScreenOrder(applied(list, ops)).map((d) => d.id)).toEqual(['m1', 'm2', 'd2', 'd1', 'd3']);
  });

  it('날짜 없는 메모를 날짜 메모 사이로 - 날짜 없는 메모는 order, 날짜 메모는 memoOrder', () => {
    const ops = memoReorderOps('u_me', shown, 0, 3)!;
    const after = applied(list, ops);
    expect(memoScreenOrder(after).map((d) => d.id)).toEqual(['m2', 'd1', 'd2', 'm1', 'd3']);
    expect(after.find((d) => d.id === 'd3')?.memoOrder).toBeUndefined();
    expect(after.find((d) => d.id === 'd1')?.order).toBe('a0');
  });

  it('즐겨찾기와 나머지 사이·같은 자리는 옮기지 않는다', () => {
    const withFav = memoScreenOrder([...list, note('f', 'a9', { date: '2026-10-02', favorite: true })]);
    expect(memoReorderOps('u_me', withFav, 0, 1)).toBeNull();
    expect(memoReorderOps('u_me', shown, 2, 2)).toBeNull();
  });

  it('메모 화면 새 메모는 옮겨 올린 날짜 메모보다도 앞', () => {
    const after = applied(list, memoReorderOps('u_me', shown, 3, 0));
    const first = memoOrderBefore(after);
    expect(after.every((d) => memoKey(d) === null || first < memoKey(d)!)).toBe(true);
  });
});

describe('끌어 놓아 순서 바꾸기', () => {
  const shown = [note('a', 'a1'), note('b', 'a2'), note('c', 'a3'), note('f', 'a4', { favorite: true })];

  it('같은 무리 안에서 끌어 놓은 자리로 옮긴다', () => {
    const ops = noteDragOps('u_me', shown, 0, 2)!;
    expect(orderAfterOps(shown, ops)).toEqual(['b', 'c', 'a', 'f']);
  });

  it('즐겨찾기와 나머지 사이·같은 자리는 옮기지 않는다', () => {
    expect(noteDragOps('u_me', shown, 0, 3)).toBeNull();
    expect(noteDragOps('u_me', shown, 1, 1)).toBeNull();
  });
});

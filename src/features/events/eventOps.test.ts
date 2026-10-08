import { describe, expect, it } from 'vitest';
import { carriedDoneChanges, doneChanges, orderAfter, reorderOps, type ItemDoc } from './eventOps';

const ev = (id: string, order: string): ItemDoc => ({ id, order, kind: 'event', date: '2026-10-08', text: id, labelIds: [] }) as unknown as ItemDoc;

describe('reorderOps', () => {
  const list = [ev('a', 'a0'), ev('b', 'a1'), ev('c', 'a2')];

  it('한 칸 옮기기는 문서 하나의 order만', () => {
    const ops = reorderOps('u_me', list, 2, 1);
    expect(ops).toHaveLength(1);
    const op = ops[0] as Extract<(typeof ops)[0], { type: 'patch' }>;
    expect(op.type).toBe('patch');
    expect(Object.keys(op.changes)).toEqual(['order']);
    // 옮긴 뒤 차례가 b < c < … 가 아니라 a, c, b 가 되게
    // 되돌리기에 쓸 고치기 전 값
    expect((op.before as { order: string }).order).toBe(list.find((d) => d.id === op.at.id)!.order);
    const orders = new Map(list.map((d) => [d.id, d.order]));
    orders.set(op.at.id, op.changes.order as string);
    const sorted = [...orders.entries()].sort((x, y) => (x[1] < y[1] ? -1 : 1)).map(([id]) => id);
    expect(sorted).toEqual(['a', 'c', 'b']);
  });

  it('맨 위로·맨 아래로', () => {
    for (const [from, to, want] of [
      [2, 0, ['c', 'a', 'b']],
      [0, 2, ['b', 'c', 'a']],
    ] as const) {
      const ops = reorderOps('u_me', list, from, to);
      expect(ops).toHaveLength(1);
      const orders = new Map(list.map((d) => [d.id, d.order]));
      for (const op of ops) if (op.type === 'patch') orders.set(op.at.id, op.changes.order as string);
      expect([...orders.entries()].sort((x, y) => (x[1] < y[1] ? -1 : 1)).map(([id]) => id)).toEqual(want);
    }
  });

  it('제자리·범위 밖은 쓰지 않는다', () => {
    expect(reorderOps('u_me', list, 1, 1)).toEqual([]);
    expect(reorderOps('u_me', list, 0, -1)).toEqual([]);
    expect(reorderOps('u_me', list, 0, 3)).toEqual([]);
  });

  it('차례 값이 같은 줄(두 기기가 함께 끼움)도 풀린다', () => {
    const same = [ev('a', 'a0'), ev('b', 'a0'), ev('c', 'a0')];
    const ops = reorderOps('u_me', same, 2, 0);
    const orders = new Map(same.map((d) => [d.id, d.order]));
    for (const op of ops) if (op.type === 'patch') orders.set(op.at.id, op.changes.order as string);
    const sorted = [...orders.entries()].sort((x, y) => (x[1] !== y[1] ? (x[1] < y[1] ? -1 : 1) : x[0] < y[0] ? -1 : 1)).map(([id]) => id);
    expect(sorted).toEqual(['c', 'a', 'b']);
  });
});

describe('doneChanges · orderAfter', () => {
  it('완료는 done·doneAt, 풀면 doneAt을 지운다', () => {
    expect(doneChanges(true, 5)).toEqual({ done: true, doneAt: 5 });
    expect(doneChanges(false)).toEqual({ done: false, doneAt: undefined });
  });
  it('새 일정은 맨 뒤', () => {
    expect(orderAfter([])).toBe('a0');
    expect(orderAfter([{ order: 'a0' }, { order: 'a2' }, { order: 'a1' }]) > 'a2').toBe(true);
  });
});

describe('carriedDoneChanges - 오늘 칸에서 따라오던 일정 끝내기', () => {
  it('그날로 옮겨 적고 처음 날을 남긴다, carrying은 걷는다', () => {
    const item = { ...ev('x', 'a3'), date: '2026-10-05', carrying: true } as ItemDoc;
    expect(carriedDoneChanges(item, '2026-10-08', 'b0', 7)).toEqual({
      done: true,
      doneAt: 7,
      date: '2026-10-08',
      order: 'b0',
      carriedFrom: '2026-10-05',
      carrying: undefined,
    });
  });
  it('끝냈다 푼 일정은 처음 날을 그대로 (다시 적지 않는다)', () => {
    const item = { ...ev('x', 'a3'), date: '2026-10-07', carriedFrom: '2026-10-01' } as ItemDoc;
    expect(carriedDoneChanges(item, '2026-10-08', 'b0', 7)).toEqual({ done: true, doneAt: 7, date: '2026-10-08', order: 'b0' });
  });
});

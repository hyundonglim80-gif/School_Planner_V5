import { describe, it, expect } from 'vitest';
import { compareOrder, isOrderKey, orderBetween, ordersBetween, rekeyOrders } from './order';

describe('orderBetween', () => {
  // 원래 라이브러리(rocicorp/fractional-indexing)의 시험 값 그대로
  it.each([
    [null, null, 'a0'],
    [null, 'a0', 'Zz'],
    [null, 'Zz', 'Zy'],
    ['a0', null, 'a1'],
    ['a1', null, 'a2'],
    ['a0', 'a1', 'a0V'],
    ['a1', 'a2', 'a1V'],
    ['a0V', 'a1', 'a0l'],
    ['Zz', 'a0', 'ZzV'],
    ['Zz', 'a1', 'a0'],
    [null, 'Y00', 'Xzzz'],
    ['bzz', null, 'c000'],
    ['a0', 'a0V', 'a0G'],
    ['a0', 'a0G', 'a08'],
    ['b125', 'b129', 'b127'],
    ['a0', 'a1V', 'a1'],
    ['Zz', 'a01', 'a0'],
    [null, 'a0V', 'a0'],
    [null, 'b999', 'b99'],
    [null, 'A000000000000000000000000001', 'A000000000000000000000000000V'],
    ['zzzzzzzzzzzzzzzzzzzzzzzzzzy', null, 'zzzzzzzzzzzzzzzzzzzzzzzzzzz'],
    ['zzzzzzzzzzzzzzzzzzzzzzzzzzz', null, 'zzzzzzzzzzzzzzzzzzzzzzzzzzzV'],
  ])('%s ~ %s → %s', (a, b, want) => {
    expect(orderBetween(a, b)).toBe(want);
  });

  it.each([
    [null, 'A00000000000000000000000000'],
    ['a00', null],
    ['a00', 'a1'],
    ['0', '1'],
    ['a1', 'a0'],
    ['a1', 'a1'],
  ])('틀린 값·차례가 거꾸로면 던진다: %s ~ %s', (a, b) => {
    expect(() => orderBetween(a, b)).toThrow();
  });

  it('맨 뒤에 잇달아 더하면 짧게 늘어난다', () => {
    let k: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 100; i++) keys.push((k = orderBetween(k, null)));
    expect(keys.slice(0, 3)).toEqual(['a0', 'a1', 'a2']);
    expect(Math.max(...keys.map((x) => x.length))).toBeLessThanOrEqual(3);
    expect([...keys].sort()).toEqual(keys);
  });

  it('아무 데나 끼워도 차례가 맞고 값이 늘 올바르다 (무작위 2000번)', () => {
    // 고정된 씨앗의 간단한 난수 - 실패하면 같은 순서로 다시 볼 수 있게
    let seed = 12345;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const list: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const at = rand(list.length + 1);
      const k = orderBetween(list[at - 1] ?? null, list[at] ?? null);
      expect(isOrderKey(k)).toBe(true);
      list.splice(at, 0, k);
    }
    expect(new Set(list).size).toBe(list.length);
    expect([...list].sort()).toEqual(list);
  });

  it('같은 자리에 거듭 끼워도(맨 앞·한 곳) 차례가 맞다', () => {
    const front: string[] = ['a0'];
    for (let i = 0; i < 200; i++) front.unshift(orderBetween(null, front[0]));
    expect([...front].sort()).toEqual(front);
    const mid: string[] = ['a0', 'a1'];
    for (let i = 0; i < 200; i++) mid.splice(1, 0, orderBetween(mid[0], mid[1]));
    expect([...mid].sort()).toEqual(mid);
  });
});

describe('ordersBetween', () => {
  it.each([
    [null, null, 5],
    ['a0', null, 5],
    [null, 'a0', 5],
    ['a0', 'a1', 7],
    ['a0', 'a0V', 30],
  ])('%s ~ %s 사이 %i개가 차례대로', (a, b, n) => {
    const keys = ordersBetween(a, b, n);
    expect(keys).toHaveLength(n);
    const all = [a, ...keys, b].filter((x): x is string => x !== null);
    expect([...all].sort()).toEqual(all);
    expect(new Set(all).size).toBe(all.length);
  });

  it('0개면 빈 목록', () => {
    expect(ordersBetween(null, null, 0)).toEqual([]);
  });
});

describe('isOrderKey', () => {
  it.each(['a0', 'Zz', 'a0V', 'b127', 'A000000000000000000000000000V'])('%s 는 올바르다', (k) => {
    expect(isOrderKey(k)).toBe(true);
  });
  it.each(['', 'a', 'a00', 'a0V0', '0', 'a0-', 'A00000000000000000000000000', 3, null])('%s 는 틀렸다', (k) => {
    expect(isOrderKey(k)).toBe(false);
  });
});

describe('compareOrder', () => {
  it('차례 값으로, 같으면 id로', () => {
    const list = [
      { order: 'a1', id: 'x' },
      { order: 'a0', id: 'z' },
      { order: 'a1', id: 'b' },
    ];
    expect([...list].sort(compareOrder).map((x) => x.id)).toEqual(['z', 'b', 'x']);
  });
});

describe('rekeyOrders - 다시 세운 줄의 값 (옮긴 것만 고친다)', () => {
  const sorted = (keys: string[]) => keys.every((k, i) => i === 0 || keys[i - 1] < k);

  it('그대로면 하나도 바꾸지 않는다', () => {
    expect(rekeyOrders(['a0', 'a1', 'a2'])).toEqual(['a0', 'a1', 'a2']);
    expect(rekeyOrders([])).toEqual([]);
  });

  it('이웃 둘을 바꾸면 하나만 새 값', () => {
    const out = rekeyOrders(['a1', 'a0', 'a2']);
    expect(sorted(out)).toBe(true);
    expect(out.filter((k, i) => k !== ['a1', 'a0', 'a2'][i]).length).toBe(1);
  });

  it('맨 뒤를 맨 앞으로 옮기면 그것만', () => {
    const before = ['a3', 'a0', 'a1', 'a2'];
    const out = rekeyOrders(before);
    expect(sorted(out)).toBe(true);
    expect(out.slice(1)).toEqual(['a0', 'a1', 'a2']);
  });

  it('값이 없거나 같은 것(두 기기가 동시에 끼움)도 줄이 선다', () => {
    const out = rekeyOrders(['a0', null, 'a1', 'a1', 'bad!']);
    expect(sorted(out)).toBe(true);
    expect(out.every(isOrderKey)).toBe(true);
    expect(out[0]).toBe('a0');
  });
});

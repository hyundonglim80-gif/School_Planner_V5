import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { compareTime, decodeDoc, encodeDoc } from './codec';

describe('사본 모양 (Timestamp 지키기)', () => {
  it('시각을 표시한 모양으로 넣고 Timestamp로 되살린다 (배열·맵 속까지)', () => {
    const doc = {
      text: '글',
      updatedAt: new Timestamp(100, 5),
      deletedAt: null,
      deep: { at: new Timestamp(7, 0), list: [new Timestamp(8, 1), 'x'] },
      tags: ['a'],
    };
    const stored = structuredClone(encodeDoc(doc));
    expect(stored.updatedAt).toEqual({ $ts: [100, 5] });
    const back = decodeDoc(stored);
    expect(back.updatedAt).toBeInstanceOf(Timestamp);
    expect((back.updatedAt as Timestamp).isEqual(new Timestamp(100, 5))).toBe(true);
    expect(((back.deep as { list: unknown[] }).list[0] as Timestamp).nanoseconds).toBe(1);
    expect(back).toMatchObject({ text: '글', deletedAt: null, tags: ['a'] });
  });

  it('IndexedDB가 그냥 담으면 Timestamp 모양을 잃는다 (그래서 표시한다)', () => {
    const lost = structuredClone({ at: new Timestamp(1, 2) });
    expect(lost.at).not.toBeInstanceOf(Timestamp);
  });

  it('시각 견주기: 없는 쪽이 앞', () => {
    expect(compareTime(new Timestamp(2, 0), new Timestamp(1, 9))).toBeGreaterThan(0);
    expect(compareTime(new Timestamp(1, 1), new Timestamp(1, 2))).toBeLessThan(0);
    expect(compareTime(null, new Timestamp(0, 0))).toBeLessThan(0);
    expect(compareTime(new Timestamp(0, 0), undefined)).toBeGreaterThan(0);
    expect(compareTime(null, null)).toBe(0);
  });
});

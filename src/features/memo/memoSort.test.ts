import { describe, expect, it } from 'vitest';
import type { ItemDoc } from '../events/eventOps';
import { sortMemos } from './memoSort';

const doc = (id: string, o: Partial<ItemDoc>): ItemDoc =>
  ({ id, kind: 'note', date: null, text: '', labelIds: [], order: id, createdAt: 0, ...o }) as unknown as ItemDoc;
const ids = (l: ItemDoc[]) => l.map((d) => d.id);
const rank = (id: string) => ({ L1: 0, L2: 1 })[id as 'L1'] ?? -1;

describe('sortMemos', () => {
  const list = [
    doc('a', { text: '다람쥐', createdAt: 3, labelIds: ['L2'] }),
    doc('b', { title: '가방', text: 'x', createdAt: 1, labelIds: ['L1'] }),
    doc('c', { text: '', createdAt: 2 }),
  ];
  it('제목: 가나다 순, 제목 없는(빈 글) 것은 맨 뒤', () => {
    expect(ids(sortMemos(list, 'title', 'asc', rank))).toEqual(['b', 'a', 'c']);
    expect(ids(sortMemos(list, 'title', 'desc', rank))).toEqual(['a', 'b', 'c']);
  });
  it('만든 날', () => {
    expect(ids(sortMemos(list, 'created', 'desc', rank))).toEqual(['a', 'c', 'b']);
    expect(ids(sortMemos(list, 'created', 'asc', rank))).toEqual(['b', 'c', 'a']);
  });
  it('라벨: 트리 차례, 라벨 없는 것은 맨 뒤', () => {
    expect(ids(sortMemos(list, 'label', 'asc', rank))).toEqual(['b', 'a', 'c']);
  });
  it('내 차례는 기존 차례', () => {
    expect(ids(sortMemos(list, 'manual', 'asc', rank))).toEqual(['a', 'b', 'c']);
  });
});

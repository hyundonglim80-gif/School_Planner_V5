import { describe, expect, it } from 'vitest';
import { layoutMasonry } from './masonry';

describe('layoutMasonry', () => {
  it('가장 짧은 열에 차례로, 같으면 왼쪽', () => {
    const { positions, total } = layoutMasonry([100, 50, 30, 40], 2, 10);
    expect(positions).toEqual([
      { col: 0, top: 0 },
      { col: 1, top: 0 },
      { col: 1, top: 60 },
      { col: 1, top: 100 },
    ]);
    expect(total).toBe(140);
  });
  it('카드가 없으면 높이 0', () => {
    expect(layoutMasonry([], 3, 16).total).toBe(0);
  });
});

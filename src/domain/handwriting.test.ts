import { describe, expect, it } from 'vitest';
import { acceptsPointer, handwritingName, hasInk, inkBounds, isEraserPress, penWidth, type PenStroke } from './handwriting';

const stroke = (points: [number, number, number][], erase = false): PenStroke => ({ color: '#000', erase, points: points.map(([x, y, w]) => ({ x, y, w })) });

describe('손글씨 셈', () => {
  it('펜은 누르는 힘에 따라 굵기가 바뀌고, 마우스·손가락은 그대로', () => {
    expect(penWidth(4, 0.5, 'pen')).toBe(4);
    expect(penWidth(4, 1, 'pen')).toBe(6.4);
    expect(penWidth(4, 0.1, 'pen')).toBeCloseTo(2.08);
    expect(penWidth(4, 0, 'pen')).toBe(4);
    expect(penWidth(4, 0.5, 'mouse')).toBe(4);
    expect(penWidth(4, 1, 'touch')).toBe(4);
  });

  it('펜을 쓴 뒤로는 손가락(손바닥)으로 그리지 않는다', () => {
    expect(acceptsPointer('touch', false)).toBe(true);
    expect(acceptsPointer('touch', true)).toBe(false);
    expect(acceptsPointer('pen', true)).toBe(true);
    expect(acceptsPointer('mouse', true)).toBe(true);
  });

  it('펜 옆 단추·펜 뒤 지우개는 지우개', () => {
    expect(isEraserPress('pen', 1)).toBe(false);
    expect(isEraserPress('pen', 2)).toBe(true);
    expect(isEraserPress('pen', 32)).toBe(true);
    expect(isEraserPress('mouse', 2)).toBe(false);
  });

  it('그린 것이 있나 - 지우개만이면 없다', () => {
    expect(hasInk([])).toBe(false);
    expect(hasInk([stroke([[1, 1, 4]], true)])).toBe(false);
    expect(hasInk([stroke([[1, 1, 4]])])).toBe(true);
  });

  it('그린 줄 둘레만 잘라 낸다 (지우개는 빼고, 화면 안으로)', () => {
    const s = [stroke([[100, 50, 4], [200, 80, 6]]), stroke([[0, 0, 30]], true)];
    expect(inkBounds(s, 10, 1000, 1000)).toEqual({ x: 88, y: 38, w: 125, h: 55 });
    expect(inkBounds([stroke([[5, 5, 4]])], 20, 15, 1000)).toEqual({ x: 0, y: 0, w: 15, h: 27 });
    expect(inkBounds([], 10, 100, 100)).toBeNull();
  });

  it('첨부 이름', () => {
    expect(handwritingName(new Date(2026, 9, 21, 9, 5, 7))).toBe('손글씨_20261021_090507.png');
  });
});

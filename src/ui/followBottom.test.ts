import { describe, expect, it } from 'vitest';
import { followsBottom } from './followBottom';

describe('맨 아래 따라가기 (P44-1)', () => {
  it('맨 아래 가까이면 따라간다', () => {
    expect(followsBottom(false, { gap: 10, top: 500, lastTop: 400 }, 60)).toBe(true);
  });
  it('맨 아래로 내린 바로 뒤 위가 늘어 틈이 생겨도(scrollTop 그대로) 따라가기를 멈추지 않는다', () => {
    expect(followsBottom(true, { gap: 2006, top: 900, lastTop: 900 }, 60)).toBe(true);
  });
  it('위로 올리면 멈춘다', () => {
    expect(followsBottom(true, { gap: 300, top: 600, lastTop: 900 }, 60)).toBe(false);
  });
  it('멈춘 채 아래로 조금 내려도(맨 아래가 아니면) 그대로 멈춤', () => {
    expect(followsBottom(false, { gap: 300, top: 700, lastTop: 600 }, 60)).toBe(false);
  });
});

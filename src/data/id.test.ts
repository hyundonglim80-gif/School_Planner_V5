import { describe, it, expect } from 'vitest';
import { ID_LENGTH, newId } from './id';

describe('newId', () => {
  it('영문 대소문자·숫자 20자', () => {
    for (let i = 0; i < 200; i++) expect(newId()).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(ID_LENGTH).toBe(20);
  });

  it('부를 때마다 다르다', () => {
    const ids = new Set(Array.from({ length: 5000 }, newId));
    expect(ids.size).toBe(5000);
  });

  it('글자가 고르게 나온다 (한쪽으로 쏠리지 않는다)', () => {
    const count = new Map<string, number>();
    for (let i = 0; i < 2000; i++) for (const ch of newId()) count.set(ch, (count.get(ch) ?? 0) + 1);
    expect(count.size).toBe(62);
    // 글자마다 평균 645번 - 넉넉히 절반~1.5배 안
    for (const n of count.values()) {
      expect(n).toBeGreaterThan(320);
      expect(n).toBeLessThan(970);
    }
  });
});

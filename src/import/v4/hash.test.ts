import { describe, expect, it } from 'vitest';
import { base32, hashText, sameValue, sha1, stableStringify } from './hash';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('sha1', () => {
  it('알려진 값', () => {
    expect(hex(sha1(''))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(hex(sha1('abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('node crypto로 셈한 값과 같다 - 한글·묶음 경계(55·56·64바이트)·긴 글', () => {
    const cases: Array<[string, string]> = [
      ['학년 협의회', '6ff1806bda5bfbfc94a655005f27c07860260995'],
      ['a'.repeat(55), 'c1c8bbdc22796e28c0e15163d20899b65621d65a'],
      ['a'.repeat(56), 'c2db330f6083854c99d4b5bfb6e8f29f201be699'],
      ['a'.repeat(64), '0098ba824b5c16427bd7a1122a5a442a25ec644d'],
      ['x'.repeat(1000), 'c3efa690fa3fdd2e2526853eed670538ea127638'],
      ['2026-03-02|청소|#2', 'af4007ee7577f7c5dfbe981465768b6a76d02809'],
      ['😀 [이월] 숙제', '8f0acbf3259151f88b0c41d2501ba3076f9350d2'],
    ];
    for (const [t, want] of cases) expect(hex(sha1(t))).toBe(want);
  });
});

describe('base32', () => {
  it('RFC 4648 (소문자, 채움 없음)', () => {
    const b = (s: string) => base32(new TextEncoder().encode(s));
    expect(b('')).toBe('');
    expect(b('f')).toBe('my');
    expect(b('fo')).toBe('mzxq');
    expect(b('foobar')).toBe('mzxw6ytboi');
  });

  it('hashText는 영문 소문자·숫자 n자', () => {
    expect(hashText('라벨', 20)).toMatch(/^[a-z2-7]{20}$/);
    expect(hashText('라벨', 20)).toBe(hashText('라벨', 20));
    expect(hashText('라벨', 20)).not.toBe(hashText('라벨 ', 20));
  });
});

describe('stableStringify', () => {
  it('칸 차례가 달라도 같은 글자, undefined 칸은 없는 것과 같다', () => {
    expect(stableStringify({ b: 1, a: { d: [1, 2], c: null } })).toBe(stableStringify({ a: { c: null, d: [1, 2] }, b: 1 }));
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue(undefined, null)).toBe(true);
    expect(sameValue('a', 'b')).toBe(false);
  });
});

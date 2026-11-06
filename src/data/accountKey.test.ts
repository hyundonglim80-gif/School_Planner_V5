import { beforeEach, describe, expect, it } from 'vitest';
import { accountKey } from './accountKey';

beforeEach(() => localStorage.clear());

describe('이 기기 저장 열쇠를 계정마다 (P22-4 - 공용 PC)', () => {
  it('계정마다 다른 열쇠', () => {
    expect(accountKey('sp5-x', 'a')).toBe('sp5-x-a');
    expect(accountKey('sp5-x', 'b')).toBe('sp5-x-b');
  });

  it('계정 구분 없던 옛 값은 처음 읽은 계정이 받고, 다음 계정에는 없다', () => {
    localStorage.setItem('sp5-x', '옛 글');
    expect(localStorage.getItem(accountKey('sp5-x', 'a'))).toBe('옛 글');
    expect(localStorage.getItem('sp5-x')).toBeNull();
    expect(localStorage.getItem(accountKey('sp5-x', 'b'))).toBeNull();
  });

  it('이미 그 계정 값이 있으면 옛 값으로 덮지 않는다', () => {
    localStorage.setItem('sp5-x-a', '새 글');
    localStorage.setItem('sp5-x', '옛 글');
    expect(localStorage.getItem(accountKey('sp5-x', 'a'))).toBe('새 글');
    expect(localStorage.getItem('sp5-x')).toBeNull();
  });
});

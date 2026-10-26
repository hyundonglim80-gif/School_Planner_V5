import { describe, expect, it } from 'vitest';
import { firstTextLine, ownTitle, titleKey } from './noteTitle';

describe('noteTitle', () => {
  it('보여 줄 제목은 적은 것만 - 없으면 빈칸 (10-26)', () => {
    expect(ownTitle({ title: ' 회의 ' })).toBe('회의');
    expect(ownTitle({})).toBe('');
    expect(ownTitle({ title: '  ' })).toBe('');
  });
  it('기준으로 쓸 때는 적은 제목이 먼저', () => {
    expect(titleKey({ title: ' 회의 ', text: '내용' })).toBe('회의');
  });
  it('제목이 없으면 첫 줄 전체 (자르지 않는다)', () => {
    expect(titleKey({ text: '\n  안녕하세요\n둘째 줄' })).toBe('안녕하세요');
    expect(titleKey({ text: '가나다라마바사아자차카타파하가나다라마바사아자차' })).toBe('가나다라마바사아자차카타파하가나다라마바사아자차');
  });
  it('체크 표시는 뗀다', () => {
    expect(firstTextLine('☐ 우유 사기\n☐ 빵')).toBe('우유 사기');
  });
  it('빈 글은 빈 값', () => {
    expect(titleKey({ title: '  ', text: '' })).toBe('');
  });
});

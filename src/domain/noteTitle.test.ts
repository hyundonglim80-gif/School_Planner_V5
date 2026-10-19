import { describe, expect, it } from 'vitest';
import { autoTitle, noteTitle } from './noteTitle';

describe('noteTitle', () => {
  it('적은 제목이 먼저', () => {
    expect(noteTitle({ title: ' 회의 ', text: '내용' })).toBe('회의');
  });
  it('제목이 없으면 첫 줄의 앞 20글자', () => {
    expect(noteTitle({ text: '\n  안녕하세요\n둘째 줄' })).toBe('안녕하세요');
    expect(autoTitle('가나다라마바사아자차카타파하가나다라마바사아자차')).toBe('가나다라마바사아자차카타파하가나다라마바…');
  });
  it('체크 표시는 뗀다', () => {
    expect(autoTitle('☐ 우유 사기\n☐ 빵')).toBe('우유 사기');
  });
  it('빈 글은 빈 제목', () => {
    expect(noteTitle({ title: '  ', text: '' })).toBe('');
  });
});

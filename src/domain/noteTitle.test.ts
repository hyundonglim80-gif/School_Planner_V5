import { describe, expect, it } from 'vitest';
import { bodyAfterHeading, firstTextLine, foldTitle, noteHeading, ownTitle, titleKey } from './noteTitle';

describe('noteTitle', () => {
  it('예전에 적은 제목 (앞뒤 빈칸을 뗀다)', () => {
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

describe('보이는 제목 = 첫 줄 (P35)', () => {
  it('첫 줄(빈 줄은 건너뜀)이 제목, 그 줄 번호', () => {
    expect(noteHeading({ text: '\n  회의 준비 \n자료 복사' })).toEqual({ title: '회의 준비', line: 1 });
    expect(noteHeading({ text: '한 줄뿐' })).toEqual({ title: '한 줄뿐', line: 0 });
  });
  it('첫 줄이 체크 줄이면 제목 없이 본문 전체 (들여 쓴 체크 줄도)', () => {
    expect(noteHeading({ text: '☐ 우유\n☐ 빵' })).toEqual({ title: '', line: null });
    expect(noteHeading({ text: '  ☑ 끝낸 것\n글' })).toEqual({ title: '', line: null });
    // 둘째 줄부터 체크 줄이면 첫 줄이 제목
    expect(noteHeading({ text: '장보기\n☐ 우유' })).toEqual({ title: '장보기', line: 0 });
  });
  it('예전에 적은 제목이 있으면 그것 (본문은 전체)', () => {
    expect(noteHeading({ title: ' 연수 ', text: '첫 줄\n둘째' })).toEqual({ title: '연수', line: null });
  });
  it('글이 없으면 제목 없음', () => {
    expect(noteHeading({ text: ' \n ' })).toEqual({ title: '', line: null });
    expect(noteHeading({})).toEqual({ title: '', line: null });
  });
  it('본문 = 제목 줄 아래부터 (앞 빈 줄도 뗀다), 제목 줄이 없으면 그대로', () => {
    expect(bodyAfterHeading('\n회의 준비\n\n자료 복사\n\n끝', 1)).toBe('자료 복사\n\n끝');
    expect(bodyAfterHeading('한 줄뿐', 0)).toBe('');
    expect(bodyAfterHeading('☐ 우유', null)).toBe('☐ 우유');
  });
  it('고치는 칸 = 예전 제목을 글 첫 줄로', () => {
    expect(foldTitle({ title: ' 연수 ', text: '내용' })).toBe('연수\n내용');
    expect(foldTitle({ title: '연수', text: '' })).toBe('연수');
    expect(foldTitle({ text: '내용' })).toBe('내용');
    expect(foldTitle({ title: '  ', text: '내용' })).toBe('내용');
  });
});

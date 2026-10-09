// V4 lib/notices.test.ts - V5는 계산한 수업 칸(lessonsOn)과 일정 항목을 받는다
import { describe, expect, it } from 'vitest';
import { appendFresh, draftLinesFrom, mealNoticeLines, nextClassDay, noticeMessage, numberedNotice, readNoticeLines, splitNoticeLines } from './notices';

describe('알림장', () => {
  it('줄 앞의 번호·글머리표는 떼고 빈 줄은 뺀다', () => {
    expect(splitNoticeLines('1. 색연필\n\n2) 리코더\n- 동의서\n  • 우유 ')).toEqual(['색연필', '리코더', '동의서', '우유']);
  });
  it('번호를 붙여 적는다·보내는 글은 날짜 머리', () => {
    expect(numberedNotice(['색연필', '리코더'])).toBe('1. 색연필\n2. 리코더');
    expect(noticeMessage('2026-10-02', ['색연필'])).toBe('[10/2(금) 알림장]\n1. 색연필');
  });
  it('다음 수업일은 주말과 쉬는 날을 건너뛴다', () => {
    expect(nextClassDay('2026-10-02', () => false)).toBe('2026-10-05');
    expect(nextClassDay('2026-10-02', (d) => d === '2026-10-05')).toBe('2026-10-06');
    expect(nextClassDay('2026-10-02', () => true)).toBeNull();
  });
  it('준비물과 일정으로 초안을 만든다 (수업 메모·끝낸 일정은 뺀다)', () => {
    const cells = [
      { n: 1, subject: '국어', supplies: '' },
      { n: 2, subject: '미술', supplies: '색연필' },
      { n: 3, subject: '음악', supplies: '리코더' },
    ];
    const events = [
      { text: '현장체험학습 동의서 제출', done: false },
      { text: '끝난 일', done: true },
    ];
    expect(draftLinesFrom(cells, events)).toEqual(['미술 준비물: 색연필', '음악 준비물: 리코더', '현장체험학습 동의서 제출']);
  });
  it('진도의 차시 준비물을 그 교시 줄에 합친다 (같은 것은 한 번)', () => {
    const cells = [
      { n: 1, subject: '국어', supplies: '공책' },
      { n: 2, subject: '수학', supplies: '' },
      { n: 3, subject: '과학', supplies: '' },
      { n: 4, subject: '미술', supplies: '색연필' },
    ];
    expect(draftLinesFrom(cells, [], { 1: '교과서', 2: '자', 3: '돋보기', 4: '색연필' })).toEqual(['국어 준비물: 공책, 교과서', '수학 준비물: 자', '과학 준비물: 돋보기', '미술 준비물: 색연필']);
  });
  it('없는 것만 더하기·저장된 줄 읽기', () => {
    expect(appendFresh(['a', 'b'], ['b', 'c'])).toEqual({ lines: ['a', 'b', 'c'], added: 1 });
    expect(readNoticeLines(['a', 3, ' ', 'b'])).toEqual(['a', 'b']);
    expect(readNoticeLines(undefined)).toEqual([]);
  });
});

describe('알림장 급식 줄 (나이스)', () => {
  const dish = (name: string, allergies: number[] = []) => ({ name, allergies });
  it('그날 급식을 한 줄로, 알레르기 번호는 뺀다', () => {
    const meals = [
      { date: '2026-10-01', kind: '중식', dishes: [dish('흑미밥')] },
      { date: '2026-10-02', kind: '중식', dishes: [dish('현미밥'), dish('꽃게된장국', [5, 6, 8])] },
    ];
    expect(mealNoticeLines(meals, '2026-10-02')).toEqual(['10/2(금) 급식: 현미밥, 꽃게된장국']);
  });
  it('조식·석식이 있으면 끼니를 붙이고, 급식이 없으면 빈 목록', () => {
    const meals = [
      { date: '2026-10-02', kind: '조식', dishes: [dish('토스트')] },
      { date: '2026-10-02', kind: '중식', dishes: [dish('비빔밥')] },
    ];
    expect(mealNoticeLines(meals, '2026-10-02')).toEqual(['10/2(금) 조식: 토스트', '10/2(금) 중식: 비빔밥']);
    expect(mealNoticeLines(meals, '2026-10-03')).toEqual([]);
  });
});

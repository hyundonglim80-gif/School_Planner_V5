import { describe, expect, it } from 'vitest';
import type { LessonCell } from '../../domain/lessons';
import { clearChanges, editChanges, isEdited, subjectToStore, swapChanges } from './lessonOps';

const cell = (n: number, over: Partial<LessonCell> = {}): LessonCell => ({
  n,
  subject: '',
  base: '',
  changed: false,
  memo: '',
  supplies: '',
  attachments: [],
  linkIds: [],
  ...over,
});
const edit = (subject: string, memo = '', supplies = '') => ({ subject, memo, supplies });

describe('수업 칸 고치기 - 그날 바꾼 것만', () => {
  it('시간표와 같은 과목은 적지 않는다, 다르면 적는다', () => {
    expect(editChanges(cell(3, { subject: '과학', base: '과학' }), edit('과학'))).toBeNull();
    expect(editChanges(cell(3, { subject: '과학', base: '과학' }), edit('체육'))).toEqual({ 'periods.3.subject': '체육' });
    expect(subjectToStore({ base: '과학' }, ' 과학 ')).toBeUndefined();
  });

  it('과목을 비우면 그 교시 수업 없음(빈 글자)', () => {
    expect(editChanges(cell(2, { subject: '수학', base: '수학' }), edit(''))).toEqual({ 'periods.2.subject': '' });
  });

  it('시간표로 되돌리면 그 칸이 빠진다 (남은 것이 없으면 교시 칸째)', () => {
    const changed = cell(1, { subject: '체육', base: '국어', changed: true, doc: { subject: '체육', memo: '운동장' }, memo: '운동장' });
    expect(editChanges(changed, edit('국어', '운동장'))).toEqual({ 'periods.1.subject': undefined });
    const only = cell(1, { subject: '체육', base: '국어', changed: true, doc: { subject: '체육' } });
    expect(editChanges(only, edit('국어'))).toEqual({ 'periods.1': undefined });
  });

  it('메모·준비물은 다듬어 적고, 비우면 뺀다', () => {
    expect(editChanges(cell(4, { subject: '음악', base: '음악' }), edit('음악', ' 리코더 ', '악보'))).toEqual({
      'periods.4.memo': '리코더',
      'periods.4.supplies': '악보',
    });
    const had = cell(4, { subject: '음악', base: '음악', memo: '리코더', supplies: '악보', doc: { memo: '리코더', supplies: '악보' } });
    expect(editChanges(had, edit('음악', '리코더', ''))).toEqual({ 'periods.4.supplies': undefined });
  });

  it('링크가 남은 칸은 통째로 빼지 않는다', () => {
    const linked = cell(5, { subject: '미술', base: '미술', memo: 'x', linkIds: ['abc'], doc: { memo: 'x', linkIds: ['abc'] } });
    expect(editChanges(linked, edit('미술'))).toEqual({ 'periods.5.memo': undefined });
  });

  it('고친 것이 있나', () => {
    expect(isEdited(cell(1, { subject: '국어', base: '국어' }), edit(' 국어 '))).toBe(false);
    expect(isEdited(cell(1, { subject: '국어', base: '국어' }), edit('국어', '메모'))).toBe(true);
  });
});

describe('비우기·맞바꾸기', () => {
  it("비우기 = 그 교시 수업 없음 + 메모·준비물 지움", () => {
    expect(clearChanges(cell(2, { subject: '수학', base: '수학', memo: 'm', doc: { memo: 'm' } }))).toEqual({
      'periods.2.subject': '',
      'periods.2.memo': undefined,
    });
    // 시간표에도 없는 칸이면 적을 것이 없다
    expect(clearChanges(cell(6))).toBeNull();
  });

  it('▲▼ 맞바꾸기: 과목은 저마다의 시간표와 견주고, 메모·준비물은 옮긴다', () => {
    const a = cell(1, { subject: '국어', base: '국어', memo: '받아쓰기', doc: { memo: '받아쓰기' } });
    const b = cell(2, { subject: '수학', base: '수학' });
    expect(swapChanges(a, b)).toEqual({
      'periods.1.subject': '수학',
      'periods.1.memo': undefined,
      'periods.2.subject': '국어',
      'periods.2.memo': '받아쓰기',
    });
  });

  it('맞바꿔 시간표대로 돌아오면 칸이 빠진다', () => {
    const a = cell(1, { subject: '수학', base: '국어', changed: true, doc: { subject: '수학' } });
    const b = cell(2, { subject: '국어', base: '수학', changed: true, doc: { subject: '국어' } });
    expect(swapChanges(a, b)).toEqual({ 'periods.1': undefined, 'periods.2': undefined });
  });
});

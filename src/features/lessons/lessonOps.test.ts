import { describe, expect, it } from 'vitest';
import { lessonNote, type LessonCell, type LessonCellDoc } from '../../domain/lessons';
import { clearChanges, editChanges, isEdited, subjectToStore, swapChanges } from './lessonOps';

const cell = (n: number, over: Partial<LessonCell> = {}): LessonCell => ({
  n,
  subject: '',
  base: '',
  changed: false,
  note: lessonNote(over.doc),
  attachments: [],
  linkIds: [],
  ...over,
});
const withDoc = (n: number, doc: LessonCellDoc, over: Partial<LessonCell> = {}) => cell(n, { doc, note: lessonNote(doc), ...over });
const edit = (subject: string, note = '') => ({ subject, note });

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
    const changed = withDoc(1, { subject: '체육', supplies: '운동장' }, { subject: '체육', base: '국어', changed: true });
    expect(editChanges(changed, edit('국어', '운동장'))).toEqual({ 'periods.1.subject': undefined });
    const only = withDoc(1, { subject: '체육' }, { subject: '체육', base: '국어', changed: true });
    expect(editChanges(only, edit('국어'))).toEqual({ 'periods.1': undefined });
  });

  it('비고(준비물)는 다듬어 supplies 한 칸에, 비우면 뺀다', () => {
    expect(editChanges(cell(4, { subject: '음악', base: '음악' }), edit('음악', ' 리코더 '))).toEqual({ 'periods.4.supplies': '리코더' });
    const had = withDoc(4, { supplies: '악보' }, { subject: '음악', base: '음악' });
    expect(editChanges(had, edit('음악', ''))).toEqual({ 'periods.4': undefined });
  });

  it('옛 수업 메모: 이어 보이고, 비고를 고치면 합친 글을 supplies에 쓰고 memo를 지운다', () => {
    const old = withDoc(2, { memo: '받아쓰기', supplies: '공책' }, { subject: '국어', base: '국어' });
    expect(old.note).toBe('공책\n받아쓰기');
    expect(editChanges(old, edit('국어', '공책\n받아쓰기 3단원'))).toEqual({ 'periods.2.supplies': '공책\n받아쓰기 3단원', 'periods.2.memo': undefined });
    // 비고를 그대로 두고 과목만 고치면 옛 메모도 그대로
    expect(editChanges(old, edit('체육', '공책\n받아쓰기'))).toEqual({ 'periods.2.subject': '체육' });
    expect(isEdited(old, edit('국어', ' 공책\n받아쓰기 '))).toBe(false);
  });

  it('링크가 남은 칸은 통째로 빼지 않는다', () => {
    const linked = withDoc(5, { memo: 'x', linkIds: ['abc'] }, { subject: '미술', base: '미술' });
    expect(editChanges(linked, edit('미술'))).toEqual({ 'periods.5.memo': undefined });
  });

  it('고친 것이 있나', () => {
    expect(isEdited(cell(1, { subject: '국어', base: '국어' }), edit(' 국어 '))).toBe(false);
    expect(isEdited(cell(1, { subject: '국어', base: '국어' }), edit('국어', '비고'))).toBe(true);
  });
});

describe('비우기·맞바꾸기', () => {
  it('비우기 = 그 교시 수업 없음 + 비고(준비물)·옛 메모 지움', () => {
    expect(clearChanges(withDoc(2, { memo: 'm' }, { subject: '수학', base: '수학' }))).toEqual({
      'periods.2.subject': '',
      'periods.2.memo': undefined,
    });
    // 시간표에도 없는 칸이면 적을 것이 없다
    expect(clearChanges(cell(6))).toBeNull();
  });

  it('▲▼ 맞바꾸기: 과목은 저마다의 시간표와 견주고, 비고(준비물)는 옮긴다 (옛 메모는 합쳐서)', () => {
    const a = withDoc(1, { memo: '받아쓰기' }, { subject: '국어', base: '국어' });
    const b = cell(2, { subject: '수학', base: '수학' });
    expect(swapChanges(a, b)).toEqual({
      'periods.1.subject': '수학',
      'periods.1.memo': undefined,
      'periods.2.subject': '국어',
      'periods.2.supplies': '받아쓰기',
    });
  });

  it('맞바꿔 시간표대로 돌아오면 칸이 빠진다', () => {
    const a = withDoc(1, { subject: '수학' }, { subject: '수학', base: '국어', changed: true });
    const b = withDoc(2, { subject: '국어' }, { subject: '국어', base: '수학', changed: true });
    expect(swapChanges(a, b)).toEqual({ 'periods.1': undefined, 'periods.2': undefined });
  });
});

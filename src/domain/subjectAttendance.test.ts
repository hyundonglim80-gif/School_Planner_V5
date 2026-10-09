// V4 lib/subjectAttendance.test.ts의 뜻 + V5(학생 sid·학생 한 칸만 쓰기)
import { describe, expect, it } from 'vitest';
import { REASON_LABEL } from './attendance';
import { periodSummary, readSubjectPeriods, studentTotals, subjectCellChanges, subjectRecordText, summaryCsvRows } from './subjectAttendance';

describe('교과 출결', () => {
  it('읽기: 모르는 종류·교시는 버리고, 사유가 틀리면 질병', () => {
    expect(readSubjectPeriods({ '3': { s1: { kind: 'late', reason: '?' }, s2: { kind: 'x' } }, x: { s1: { kind: 'absent' } }, '4': {} })).toEqual({
      '3': { s1: { kind: 'late', reason: 'sick' } },
    });
  });
  it('교시 요약', () => {
    expect(periodSummary({ a: { kind: 'absent', reason: 'sick' }, b: { kind: 'absent', reason: 'other' }, c: { kind: 'late', reason: 'sick' } })).toBe('결과 2 · 지각 1');
    expect(periodSummary({})).toBe('');
  });
  it('학생 한 칸만 쓴다 - 새 칸은 통째로, 고친 칸은 칸마다(지운 사유가 남지 않게), 출석이면 지우기', () => {
    expect(subjectCellChanges(3, 's1', null, { kind: 'absent', reason: 'sick', note: ' 보건실 ' })).toEqual({ 'periods.3.s1': { kind: 'absent', reason: 'sick', note: '보건실' } });
    expect(subjectCellChanges(3, 's1', { kind: 'absent', reason: 'sick', note: '보건실' }, { kind: 'late', reason: 'sick' })).toEqual({
      'periods.3.s1.kind': 'late',
      'periods.3.s1.reason': 'sick',
      'periods.3.s1.note': undefined,
    });
    expect(subjectCellChanges(3, 's1', { kind: 'late', reason: 'sick' }, null)).toEqual({ 'periods.3.s1': undefined });
    expect(subjectCellChanges(3, 's1', null, null)).toEqual({});
    expect(subjectCellChanges(3, 's1', { kind: 'late', reason: 'sick' }, { kind: 'late', reason: 'sick' })).toEqual({});
  });
  it('학생마다 누계·내역 (기간)', () => {
    const days = [
      { date: '2026-10-02', periods: { '3': { s1: { kind: 'absent', reason: 'sick' } }, '1': { s1: { kind: 'late', reason: 'sick' } } } },
      { date: '2026-09-01', periods: { '2': { s1: { kind: 'absent', reason: 'other', note: '상담' }, s2: { kind: 'early', reason: 'sick' } } } },
    ];
    const t = studentTotals(days);
    expect(t.s1).toMatchObject({ absent: 2, late: 1, early: 0 });
    expect(t.s1.items.map((i) => `${i.date}#${i.period}`)).toEqual(['2026-09-01#2', '2026-10-02#1', '2026-10-02#3']);
    expect(studentTotals(days, '2026-10-01').s2).toBeUndefined();
    expect(subjectRecordText(t.s1.items[0].record, REASON_LABEL)).toBe('결과(기타) - 상담');
  });
  it('CSV - 명렬표 차례, 지운 학생은 끝에', () => {
    const totals = studentTotals([{ date: '2026-10-02', periods: { '3': { s1: { kind: 'absent', reason: 'sick' }, gone: { kind: 'late', reason: 'sick' } } } }]);
    expect(summaryCsvRows([{ sid: 's1', num: 1, name: '가' }, { sid: 's2', num: 2, name: '나' }], totals)).toEqual([
      ['번호', '이름', '결과', '지각', '조퇴', '합계'],
      [1, '가', 1, 0, 0, 1],
      [2, '나', 0, 0, 0, 0],
      ['', '(지운 학생)', 0, 1, 0, 1],
    ]);
  });
});

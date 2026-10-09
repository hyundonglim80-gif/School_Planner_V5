// V4 lib/attendance.test.ts + V5(학생 sid·바뀐 칸만·누계 기간)
import { describe, expect, it } from 'vitest';
import {
  dayLines,
  historyOf,
  marksChanges,
  readMarks,
  recordText,
  summaryRangeOf,
  tallyByStudent,
  togglePeriod,
  withKind,
  type AttendanceMarks,
} from './attendance';

const students = [
  { sid: 's5', num: 5, name: '김지우' },
  { sid: 's12', num: 12, name: '박하늘' },
];

describe('출석부 규칙', () => {
  it('한 건을 나이스 말로 적는다 (교시·사유 포함), 결석은 교시를 적지 않는다', () => {
    expect(recordText({ kind: 'absent', reason: 'sick', note: '감기' })).toBe('결석(질병) - 감기');
    expect(recordText({ kind: 'late', reason: 'unexcused', periods: [2, 1] })).toBe('지각(미인정) 1·2교시');
    expect(recordText({ kind: 'result', reason: 'approved', periods: [4] })).toBe('결과(출석인정) 4교시');
    expect(recordText({ kind: 'absent', reason: 'other', periods: [1] })).toBe('결석(기타)');
  });

  it('그날 줄은 번호 차례, 명렬표에 없는 학생은 (지운 학생)', () => {
    const marks: AttendanceMarks = { s12: { kind: 'early', reason: 'sick', periods: [5, 6] }, s5: { kind: 'absent', reason: 'sick', note: '감기' }, gone: { kind: 'late', reason: 'other' } };
    expect(dayLines(marks, students)).toEqual(['5번 김지우 결석(질병) - 감기', '12번 박하늘 조퇴(질병) 5·6교시', '(지운 학생) 지각(기타)']);
    expect(dayLines({}, students)).toEqual([]);
  });

  it('학생별로 종류×사유를 센다 (sid)', () => {
    const days = [
      { date: '2026-09-01', records: { s5: { kind: 'absent', reason: 'sick' } } },
      { date: '2026-09-02', records: { s5: { kind: 'absent', reason: 'sick' } } },
      { date: '2026-09-03', records: { s5: { kind: 'late', reason: 'unexcused' } } },
    ];
    const t = tallyByStudent(days).s5;
    expect(t.absent.sick).toBe(2);
    expect(t.late.unexcused).toBe(1);
    expect(t.early.sick).toBe(0);
    expect(tallyByStudent(days).s12).toBeUndefined();
  });

  it('한 학생의 내역을 날짜 차례로', () => {
    const days = [
      { date: '2026-09-03', records: { s5: { kind: 'late', reason: 'sick' } } },
      { date: '2026-09-01', records: { s5: { kind: 'absent', reason: 'sick' } } },
      { date: '2026-09-02', records: { s7: { kind: 'absent', reason: 'sick' } } },
    ];
    expect(historyOf(days, 's5').map((h) => h.date)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('읽기: 모르는 종류는 빼고, 사유가 틀리면 질병, 결석의 교시는 버린다', () => {
    expect(readMarks({ a: { kind: 'x', reason: 'sick' }, b: { kind: 'late', reason: '?' , periods: [3, '1', 3] }, c: { kind: 'absent', reason: 'other', periods: [1] } })).toEqual({
      b: { kind: 'late', reason: 'sick', periods: [1, 3] },
      c: { kind: 'absent', reason: 'other' },
    });
  });
});

describe('고치기·저장', () => {
  it('종류를 바꾸면 사유·메모는 이어받고, 결석이면 교시는 뺀다, null = 출석', () => {
    let m: AttendanceMarks = withKind({}, 's5', 'late');
    expect(m.s5).toEqual({ kind: 'late', reason: 'sick' });
    m = togglePeriod(togglePeriod(m, 's5', 3), 's5', 1);
    expect(m.s5.periods).toEqual([1, 3]);
    m = { ...m, s5: { ...m.s5, reason: 'unexcused', note: '늦잠' } };
    expect(withKind(m, 's5', 'absent').s5).toEqual({ kind: 'absent', reason: 'unexcused', note: '늦잠' });
    expect(withKind(m, 's5', null)).toEqual({});
  });

  it('바뀐 학생의 칸만 - 새 학생은 통째로, 고친 학생은 칸마다(옛 교시가 남지 않게), 출석으로 돌리면 지우기', () => {
    const before: AttendanceMarks = { s5: { kind: 'late', reason: 'sick', periods: [1] }, s12: { kind: 'absent', reason: 'sick' }, s7: { kind: 'early', reason: 'other', periods: [5] } };
    const after: AttendanceMarks = { s5: { kind: 'absent', reason: 'sick' }, s7: { kind: 'early', reason: 'other', periods: [5] }, s9: { kind: 'late', reason: 'approved', periods: [2], note: ' 병원 ' } };
    expect(marksChanges(before, after)).toEqual({
      'records.s5.kind': 'absent',
      'records.s5.reason': 'sick',
      'records.s5.periods': undefined,
      'records.s5.note': undefined,
      'records.s12': undefined,
      'records.s9': { kind: 'late', reason: 'approved', periods: [2], note: '병원' },
    });
    expect(marksChanges(after, after)).toEqual({});
  });

  it('누계 기간 - 학년도(2월 끝까지)·달·학기(방학 설정으로)', () => {
    expect(summaryRangeOf('year', 2026, '2026-10-09', null)).toEqual({ start: '2026-03-01', end: '2027-02-28' });
    expect(summaryRangeOf('month', 2026, '2026-10-09', null)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(summaryRangeOf('sem2', 2026, '2026-10-09', { '2026': { summer: { from: '2026-07-24', to: '2026-08-16' } } })).toEqual({ start: '2026-08-17', end: '2027-02-28' });
    expect(summaryRangeOf('sem1', 2026, '2026-10-09', null)).toEqual({ start: '2026-03-01', end: '2026-08-31' });
  });
});

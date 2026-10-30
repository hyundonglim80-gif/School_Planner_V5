// 학급 셈 경계 시험 (P14-8 - 점검 뒤 손보기 항목 10 ③): 번호가 바뀐·전출한 학생의 출결·평가·자리가 sid로 따라가나 ·
// 학기·학년도 경계(윤년 2월 29일) · 떨어뜨릴 짝 · 교과 출결 누계 범위 · 기간별 시간표가 겹칠 때 · 진도가 학년도를 넘지 않나.
import { describe, expect, it } from 'vitest';
import { dayLines, historyOf, summaryRangeOf, tallyByStudent } from './attendance';
import { addDays } from './dateUtils';
import { semesterOf, syncEvalStudents } from './evaluation';
import { computeProgress, progressMarks, type ProgressLesson, type ProgressPlan } from './progress';
import { timetableOn, type TimetableLike } from './lessons';
import { withSids, type RosterStudent } from './roster';
import { isNear, pairKey, shuffleSeats, type SeatingChart, type SeatStudent } from './seating';
import { semesterConfigOf, semesterSpan, type SchoolTerms } from './semester';
import { studentTotals } from './subjectAttendance';

const TERMS: SchoolTerms = {
  '2026': { summer: { from: '2026-07-22', to: '2026-08-20' }, winter: { from: '2027-01-08', to: '2027-02-28' } },
};

describe('출결 - 학생은 sid로', () => {
  const days = [
    { date: '2026-04-01', records: { s1: { kind: 'absent', reason: 'sick', note: '감기' }, gone: { kind: 'late', reason: 'unexcused', periods: [1] } } },
    { date: '2026-03-31', records: { s1: { kind: 'late', reason: 'sick', periods: [2, 1] } } },
  ];
  it('번호가 바뀌어도 그 학생 기록 - 줄은 지금 번호, 명렬표에서 지운 학생은 맨 뒤 (지운 학생)', () => {
    const roster = [{ sid: 's1', num: 7, name: '김지우' }];
    expect(dayLines(days[0].records as never, roster)).toEqual(['7번 김지우 결석(질병) - 감기', '(지운 학생) 지각(미인정) 1교시']);
    expect(tallyByStudent(days).s1.absent.sick).toBe(1);
    expect(tallyByStudent(days).s1.late.sick).toBe(1);
    expect(historyOf(days, 's1').map((h) => h.date)).toEqual(['2026-03-31', '2026-04-01']);
  });
  it('누계 기간: 2학기는 이듬해 2월 끝(윤년 29일)까지, 방학 설정이 있으면 여름 방학 다음 날부터', () => {
    expect(summaryRangeOf('sem2', 2027, '2027-10-01', null)).toEqual({ start: '2027-09-01', end: '2028-02-29' });
    expect(summaryRangeOf('year', 2027, '2027-10-01', null)).toEqual({ start: '2027-03-01', end: '2028-02-29' });
    expect(summaryRangeOf('sem1', 2026, '2026-05-01', TERMS)).toEqual({ start: '2026-03-01', end: '2026-08-20' });
    expect(summaryRangeOf('sem2', 2026, '2026-10-01', TERMS)).toEqual({ start: '2026-08-21', end: '2027-02-28' });
  });
});

describe('학기 셈 한 곳 - 조사표 semesterOf = 출결·검색 semesterSpan', () => {
  for (const [year, terms] of [
    [2026, TERMS],
    [2026, null],
    [2027, null],
  ] as const) {
    it(`${year}학년도 ${terms ? '방학 설정' : '기본(3~8월)'} - 모든 날이 같은 학기`, () => {
      const cfg = semesterConfigOf(terms, year);
      for (const sem of [1, 2] as const) {
        const { start, end } = semesterSpan(year, sem, cfg);
        for (let d = start; d <= end; d = addDays(d, 1)) if (semesterOf(d, year, terms) !== sem) throw new Error(`${d}: ${semesterOf(d, year, terms)} ≠ ${sem}`);
      }
    });
  }
});

describe('조사표 명단 - 전출·번호 바뀜', () => {
  it('번호는 지금 명렬표로, 전출·지운 학생은 지우지 않고 out, 새 학생은 더한다', () => {
    const current = [
      { sid: 'a', num: 1, name: '가' },
      { sid: 'b', num: 2, name: '나' },
      { sid: 'z', num: 3, name: '지운' },
    ];
    const roster = [
      { sid: 'b', num: 1, name: '나', status: 'active' as const },
      { sid: 'a', num: 2, name: '가', status: 'out' as const },
      { sid: 'c', num: 3, name: '다', status: 'active' as const },
    ];
    expect(syncEvalStudents(current, roster)).toEqual([
      { sid: 'b', num: 1, name: '나' },
      { sid: 'a', num: 2, name: '가', out: true },
      { sid: 'c', num: 3, name: '다' },
      { sid: 'z', num: 3, name: '지운', out: true },
    ]);
  });
});

describe('명렬표 다시 올리기 - sid 잇기', () => {
  it('번호가 바뀌어도 이름으로 그 학생, 동명이인은 차례대로 하나씩', () => {
    const current: RosterStudent[] = [
      { sid: 'a', num: 1, name: '김민수', status: 'active' },
      { sid: 'b', num: 2, name: '김민수', status: 'active' },
      { sid: 'c', num: 3, name: '이지은', status: 'active' },
    ];
    let n = 0;
    const out = withSids(
      [
        { num: 1, name: '이지은', status: 'active' },
        { num: 2, name: '김민수', status: 'active' },
        { num: 3, name: '김민수', status: 'active' },
        { num: 4, name: '박새봄', status: 'active' },
      ],
      current,
      () => `new${++n}`,
    );
    expect(out.map((s) => s.sid)).toEqual(['c', 'a', 'b', 'new1']);
  });
});

describe('자리 섞기 - 떨어뜨릴 짝·고정 칸', () => {
  const students: SeatStudent[] = Array.from({ length: 24 }, (_, i) => ({ sid: `s${i + 1}`, num: i + 1, gender: i % 2 ? 'F' : 'M' }));
  const chart: SeatingChart = { id: 'c', classId: '2026-5-2', name: '', rows: 4, cols: 6, groupCols: 2, front: 'top', seats: {}, off: [], locked: [], history: [] };
  const apart = [pairKey('s1', 's2'), pairKey('s3', 's4'), pairKey('s1', 's5'), pairKey('s6', 's7')];
  const rng = (seed: number) => {
    let x = seed;
    return () => (x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  };
  it('넉넉한 자리면 떨어뜨릴 학생은 앞뒤옆(대각선)에 붙지 않는다 (여러 번)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = shuffleSeats(chart, students, { apart, avoidPast: false, mixGender: false }, rng(seed));
      expect(r.cost.apart).toBe(0);
      const where = new Map(Object.entries(r.seats).map(([k, s]) => [s, k]));
      for (const p of apart) {
        const [a, b] = p.split('|');
        expect(isNear(where.get(a)!, where.get(b)!)).toBe(false);
      }
      expect(Object.keys(r.seats)).toHaveLength(24);
    }
  });
  it('고정 칸의 학생이 전출하면 그 칸도 섞고, 고정한 빈 칸은 빈 채로', () => {
    const locked = { ...chart, seats: { '0-0': 'gone', '0-1': 's9' }, locked: ['0-0', '0-1', '3-5'] };
    const r = shuffleSeats(locked, students.slice(0, 20), { apart: [], avoidPast: false, mixGender: false }, rng(3));
    expect(r.seats['0-1']).toBe('s9');
    expect(Object.values(r.seats)).not.toContain('gone');
    expect(r.seats['3-5']).toBeUndefined();
    expect(Object.keys(r.seats)).toHaveLength(20);
  });
  it('자리가 모자라면 남는 학생을 알린다', () => {
    const small = { ...chart, rows: 3 };
    const r = shuffleSeats(small, students, { apart: [], avoidPast: false, mixGender: false }, rng(5));
    expect(r.unseated).toHaveLength(6);
    expect(Object.keys(r.seats)).toHaveLength(18);
  });
});

describe('교과 출결 누계', () => {
  it('범위 끝날을 넣고, 교시는 숫자 차례(2 → 10)', () => {
    const days = [
      { date: '2026-09-01', periods: { '1': { s: { kind: 'late', reason: 'sick' } } } },
      { date: '2026-08-31', periods: { '10': { s: { kind: 'early', reason: 'other' } }, '2': { s: { kind: 'absent', reason: 'sick' } } } },
    ];
    const t = studentTotals(days, '2026-08-31', '2026-08-31').s;
    expect([t.absent, t.late, t.early]).toEqual([1, 0, 1]);
    expect(t.items.map((i) => i.period)).toEqual([2, 10]);
    expect(studentTotals(days, '2026-08-31', '2026-09-01').s.items.map((i) => i.date)).toEqual(['2026-08-31', '2026-08-31', '2026-09-01']);
  });
});

describe('기간별 시간표가 겹칠 때', () => {
  const t = (id: string, from: string, to: string, createdAt = 0): TimetableLike => ({ id, from, to, grid: {}, createdAt });
  it('늦게 시작한 것 → 나중에 만든 것, 끝 날까지 넣는다', () => {
    const list = [t('a', '2026-03-02', '2026-08-31', 1), t('b', '2026-07-01', '2026-12-31', 1), t('c', '2026-07-01', '2026-07-10', 2)];
    expect(timetableOn('2026-06-30', list)?.id).toBe('a');
    expect(timetableOn('2026-07-05', list)?.id).toBe('c');
    expect(timetableOn('2026-07-11', list)?.id).toBe('b');
    expect(timetableOn('2026-08-31', list)?.id).toBe('b');
    expect(timetableOn('2027-01-01', list)).toBeNull();
  });
});

describe('진도 - 학년도 경계', () => {
  const L = (content: string, no = ''): ProgressLesson => ({ unit: '', no, content, page: '', supplies: '' });
  const plan = (startDate: string, lessons: ProgressLesson[], extra: Partial<ProgressPlan> = {}): ProgressPlan => ({ id: 'p', key: '수학', startDate, lessons, bumps: [], noCount: true, ...extra });
  it('다 못 끝낸 진도는 새 학년도(3월) 같은 과목 칸에 이어지지 않는다', () => {
    const subjects = { '2027-02-24': { '1': '수학' }, '2027-02-26': { '2': '수학' }, '2027-03-02': { '1': '수학' }, '2027-03-03': { '1': '수학' } };
    const p = plan('2027-02-24', [L('가'), L('나'), L('다'), L('라')]);
    expect(computeProgress(p, subjects).slots.map((s) => s.date)).toEqual(['2027-02-24', '2027-02-26']);
    expect(Object.keys(progressMarks([p], subjects)).sort()).toEqual(['2027-02-24#1', '2027-02-26#2']);
  });
  it('윤년 2월 29일까지는 그 학년도', () => {
    const subjects = { '2028-02-28': { '1': '수학' }, '2028-02-29': { '1': '수학' }, '2028-03-02': { '1': '수학' } };
    expect(computeProgress(plan('2027-03-02', [L('가'), L('나'), L('다')]), subjects).slots.map((s) => s.date)).toEqual(['2028-02-28', '2028-02-29']);
  });
  it('새 학년도 진도는 3월부터 처음 차시', () => {
    const subjects = { '2027-02-26': { '1': '수학' }, '2027-03-02': { '1': '수학' } };
    const marks = progressMarks([plan('2026-03-02', [L('작년')]), plan('2027-03-02', [L('올해')], { id: 'q' })], subjects);
    expect(marks['2027-02-26#1']?.lesson?.content).toBe('작년');
    expect(marks['2027-03-02#1']?.lesson?.content).toBe('올해');
  });
  it('한 날 교시는 숫자 차례 (2교시 → 10교시), 차시 칸 2 = 잇단 두 교시', () => {
    const subjects = { '2026-10-14': { '10': '수학', '2': '수학', '3': '수학' } };
    const t = computeProgress(plan('2026-10-14', [L('가', '2'), L('나')]), subjects);
    expect(t.slots.map((s) => `${s.period}:${s.lesson}`)).toEqual(['2:0', '3:1', '10:2']);
    const marks = progressMarks([plan('2026-10-14', [L('가', '2'), L('나')])], subjects);
    expect([marks['2026-10-14#2'].lesson?.content, marks['2026-10-14#3'].lesson?.content, marks['2026-10-14#10'].lesson?.content]).toEqual(['가', '가', '나']);
  });
});

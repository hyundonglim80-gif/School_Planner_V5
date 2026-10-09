import { describe, expect, it } from 'vitest';
import {
  applyEvalToAll,
  courseEvalCompletion,
  courseOverviewCsvRows,
  evalCellText,
  evalColumnTitle,
  evalCountsByPlace,
  evalPlaceLabel,
  evalPlaceOf,
  evalStudentsOf,
  evalValuesChanges,
  filterEvals,
  groupCourseEvals,
  groupsByNumber,
  isEmptyCell,
  overviewCsvRows,
  semesterOf,
  sortEvals,
  stepCounts,
  studentEvalCell,
  syncEvalStudents,
  type EvalDoc,
} from './evaluation';

const base: EvalDoc = {
  date: '2026-04-10',
  period: 2,
  classId: '2026-5-2',
  title: '단원평가',
  type: 'eval',
  subject: '수학',
  indiv: true,
  group: false,
  steps: ['잘함', '보통', '노력'],
  students: [
    { sid: 'a', num: 1, name: '가람' },
    { sid: 'b', num: 2, name: '나래' },
    { sid: 'c', num: 3, name: '다솜' },
  ],
  values: {},
};

describe('자리·조 나누기·명단', () => {
  it('자리 = 교시 글자 / 기록 칸', () => {
    expect(evalPlaceOf(base)).toBe('2');
    expect(evalPlaceOf({ period: null })).toBe('journal');
    expect(evalPlaceLabel('journal')).toBe('기록');
    expect(evalPlaceLabel('3', ['아침', '1교시', '2교시'])).toBe('2교시');
    expect(evalPlaceLabel('7')).toBe('7교시');
    expect(evalCountsByPlace([{ period: 2 }, { period: 2 }, { period: null }])).toEqual({ '2': 2, journal: 1 });
  });

  it('번호 차례로 n조 (나머지는 앞 조부터)', () => {
    expect(groupsByNumber(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([
      { name: 'A조', members: ['a', 'b', 'c'] },
      { name: 'B조', members: ['d', 'e'] },
    ]);
    expect(groupsByNumber(['a'], 0)).toEqual([{ name: 'A조', members: ['a'] }]);
  });

  it('만들 때 명단 = 재학생 번호 차례', () => {
    expect(
      evalStudentsOf([
        { sid: 'b', num: 2, name: '나래', status: 'active' },
        { sid: 'x', num: 9, name: '전출', status: 'out' },
        { sid: 'a', num: 1, name: '가람', status: 'active' },
      ]),
    ).toEqual([
      { sid: 'a', num: 1, name: '가람' },
      { sid: 'b', num: 2, name: '나래' },
    ]);
  });

  it('열 때 명렬표와 맞춘다 - 새 학생 더하기·이름 고치기·떠난 학생은 out (값은 남긴다)', () => {
    const next = syncEvalStudents(base.students, [
      { sid: 'a', num: 1, name: '가람이', status: 'active' },
      { sid: 'b', num: 2, name: '나래', status: 'out' },
      { sid: 'd', num: 4, name: '라온', status: 'active' },
    ]);
    expect(next).toEqual([
      { sid: 'a', num: 1, name: '가람이' },
      { sid: 'b', num: 2, name: '나래', out: true },
      { sid: 'c', num: 3, name: '다솜', out: true },
      { sid: 'd', num: 4, name: '라온' },
    ]);
    expect(syncEvalStudents(next!, [
      { sid: 'a', num: 1, name: '가람이', status: 'active' },
      { sid: 'b', num: 2, name: '나래', status: 'out' },
      { sid: 'd', num: 4, name: '라온', status: 'active' },
    ])).toBeNull();
  });
});

describe('값 저장 = 바뀐 학생 칸만', () => {
  it('바뀐 학생만, 빈 값은 지우기', () => {
    const before = { a: { indiv: '잘함' }, b: { indiv: '보통', reason: '근거' } };
    const after = { a: { indiv: '잘함', reason: '  ' }, b: { indiv: '' }, c: { checked: false } };
    expect(evalValuesChanges(before, after)).toEqual({ 'values.b': undefined, 'values.c': { checked: false } });
  });
  it('전체 일괄 적용은 전출 학생을 뺀다', () => {
    const v = applyEvalToAll({ a: { reason: '근거' } }, [...base.students, { sid: 'z', num: 9, name: '전출', out: true }], { indiv: '보통' });
    expect(v).toEqual({ a: { reason: '근거', indiv: '보통' }, b: { indiv: '보통' }, c: { indiv: '보통' } });
  });
});

describe('studentEvalCell (V4 evalSummary)', () => {
  it('개인 평가 + 근거', () => {
    const c = studentEvalCell({ ...base, values: { c: { indiv: '잘함', reason: '식을 세움' } } }, 'c');
    expect(c).toEqual({ main: '잘함', note: '식을 세움' });
    expect(evalCellText(c)).toBe('잘함 - 식을 세움');
  });
  it('조별은 조 이름(적은 것 먼저, 없으면 나눈 조)과 함께', () => {
    const ev = { ...base, group: true, groups: [{ name: '1모둠', members: ['c', 'd'] }], values: { c: { indiv: '보통', group: '잘함' }, d: { group: '잘함', groupName: 'A조' } } };
    expect(studentEvalCell(ev, 'c').main).toBe('보통 · 1모둠 잘함');
    expect(studentEvalCell(ev, 'd').main).toBe('A조 잘함');
  });
  it('체크 O/X, 안 적으면 빈 칸', () => {
    const ev = { ...base, type: 'check' as const, values: { a: { checked: true }, b: { checked: false, reason: '안 가져옴' } } };
    expect(studentEvalCell(ev, 'a').main).toBe('O');
    expect(evalCellText(studentEvalCell(ev, 'b'))).toBe('X - 안 가져옴');
    expect(isEmptyCell(studentEvalCell(ev, 'c'))).toBe(true);
  });
  it('메모', () => {
    expect(studentEvalCell({ ...base, type: 'memo', values: { a: { memo: ' 발표 잘함 ' } } }, 'a')).toEqual({ main: '발표 잘함', note: '' });
  });
});

describe('semesterOf', () => {
  const terms = { '2026': { summer: { from: '2026-07-20', to: '2026-08-14' }, winter: { from: '2027-01-04', to: '2027-02-26' } } };
  it('그 학년도의 방학 설정이 있으면 2학기 시작일로', () => {
    expect(semesterOf('2026-08-14', 2026, terms)).toBe(1);
    expect(semesterOf('2026-08-15', 2026, terms)).toBe(2);
    expect(semesterOf('2027-02-10', 2026, terms)).toBe(2);
  });
  it('다른 해 설정이거나 없으면 3~8월이 1학기', () => {
    expect(semesterOf('2025-08-30', 2025, terms)).toBe(1);
    expect(semesterOf('2025-09-01', 2025, terms)).toBe(2);
    expect(semesterOf('2026-01-10', 2025, null)).toBe(2);
  });
});

describe('filterEvals · sortEvals · evalColumnTitle', () => {
  const evs = [
    { id: 'a', date: '2026-09-02', period: 1, subject: '수학', type: 'eval' as const, title: '나' },
    { id: 'b', date: '2026-04-02', period: 3, subject: '', type: 'check' as const, title: '준비물' },
    { id: 'c', date: '2026-04-02', period: 1, subject: '수학', type: 'eval' as const, title: '가' },
    { id: 'd', date: '2026-04-02', period: null, subject: '', type: 'memo' as const, title: '기록' },
  ];
  it('교과·(없음)·학기·유형', () => {
    expect(filterEvals(evs, { subject: '수학' }, 2026).map((e) => e.id)).toEqual(['a', 'c']);
    expect(filterEvals(evs, { subject: '(없음)' }, 2026).map((e) => e.id)).toEqual(['b', 'd']);
    expect(filterEvals(evs, { semester: 1 }, 2026).map((e) => e.id)).toEqual(['b', 'c', 'd']);
    expect(filterEvals(evs, { type: 'check' }, 2026).map((e) => e.id)).toEqual(['b']);
  });
  it('날짜·교시 차례(기록 칸은 뒤), 머리 글', () => {
    expect(sortEvals(evs).map((e) => e.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(evalColumnTitle(evs[0])).toBe('9/2 수학 나');
  });
});

describe('overviewCsvRows · stepCounts', () => {
  const ev1 = { ...base, values: { a: { indiv: '잘함', reason: '근거' }, b: { indiv: '잘함' } } };
  const ev2 = { ...base, date: '2026-04-11', subject: '', title: '소감', type: 'memo' as const, values: { b: { memo: '재미있음' } } };
  it('머리 두 줄 + 학생마다 (값·사유, 메모는 한 칸), 전출 표시', () => {
    const rows = overviewCsvRows([ev1, ev2], [
      { sid: 'a', num: 1, name: '가람' },
      { sid: 'b', num: 2, name: '나래', out: true },
    ]);
    expect(rows[0]).toEqual(['번호', '이름', '2026-04-10 수학 평가', '', '2026-04-11 메모']);
    expect(rows[1]).toEqual(['', '', '단원평가', '사유', '소감']);
    expect(rows[2]).toEqual(['1', '가람', '잘함', '근거', '']);
    expect(rows[3]).toEqual(['2', '나래 (전출)', '잘함', '', '재미있음']);
  });
  it('단계별 사람 수', () => {
    expect(stepCounts(ev1, ['a', 'b', 'c'])).toBe('잘함 2');
    expect(stepCounts(ev2, ['a', 'b'])).toBe('');
  });
});

describe('과정별 (V4 courseEvals)', () => {
  const ev = (id: string, title: string, date: string, extra: Partial<EvalDoc> = {}) => ({ ...base, id, title, date, subject: '과학', ...extra });
  it('같은 제목은 날짜가 달라도 한 칸, 종류가 다르면 따로, 같은 반에 둘이면 이른 것', () => {
    const cols = groupCourseEvals(
      {
        '5-1': [ev('a1', '1단원 평가', '2026-11-02'), ev('b1', '실험 체크', '2026-11-09', { type: 'check' })],
        '5-2': [ev('a2', ' 1단원  평가', '2026-11-04'), ev('c2', '실험 체크', '2026-11-10'), ev('c0', '실험 체크', '2026-11-08')],
        '5-3': [ev('x3', '1단원 평가', '2026-11-03', { subject: '수학' })],
      },
      '과학',
    );
    expect(cols.map((c) => [c.title, c.type, Object.keys(c.byClass).sort().join(',')])).toEqual([
      ['1단원 평가', 'eval', '5-1,5-2'],
      ['실험 체크', 'eval', '5-2'],
      ['실험 체크', 'check', '5-1'],
    ]);
    expect(cols[1].byClass['5-2'].id).toBe('c0');
  });
  it('완료 수(명단에 없는 학생은 세지 않는다)와 CSV', () => {
    const e = ev('a', '평가', '2026-11-02', { values: { a: { indiv: '잘함' }, c: { memo: '' }, z: { indiv: '보통' } } });
    expect(courseEvalCompletion(e, ['a', 'b', 'c'])).toEqual({ done: 1, total: 3 });
    expect(courseEvalCompletion(e, ['a', 'b', 'c', 'z'])).toEqual({ done: 1, total: 4 });
    expect(courseOverviewCsvRows(groupCourseEvals({ '5-1': [e] }), [{ cls: '5-1', sids: ['a', 'b', 'c'] }, { cls: '5-2', sids: ['a'] }])).toEqual([
      ['반', '평가'],
      ['5-1', '1/3'],
      ['5-2', ''],
    ]);
  });
});

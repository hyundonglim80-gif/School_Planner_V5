import { describe, expect, it } from 'vitest';
import {
  applyEvalToAll,
  badCutIndex,
  cleanEvalValue,
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
  hasScoreCuts,
  isEmptyCell,
  isFreeEval,
  overviewCsvRows,
  parseScore,
  rescoreValues,
  scorePatch,
  semesterOf,
  sortEvals,
  stepCounts,
  stepForScore,
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
  it('자리 = 교시 글자 / 메모 칸', () => {
    expect(evalPlaceOf(base)).toBe('2');
    expect(evalPlaceOf({ period: null })).toBe('journal');
    expect(evalPlaceLabel('journal')).toBe('메모 칸');
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

describe("평가 단계 '기타' (P46-1)", () => {
  const free = { ...base, steps: [], free: true, values: { a: { indiv: '85' }, b: { indiv: 'A+', reason: '발표' }, c: { reason: '결석' } } };
  it('기타인가 - 평가이고 free가 꼭 true일 때만', () => {
    expect(isFreeEval(free)).toBe(true);
    expect(isFreeEval({ ...free, type: 'check' })).toBe(false);
    expect(isFreeEval({ ...free, free: undefined })).toBe(false);
    expect(isFreeEval({ ...free, free: 'yes' as unknown as boolean })).toBe(false);
  });
  it("사람 수 = 값이 있는 학생 수 '적음 n' (단계가 없다)", () => {
    expect(stepCounts(free, ['a', 'b', 'c'])).toBe('적음 2');
    expect(stepCounts({ ...free, values: {} }, ['a', 'b'])).toBe('');
    expect(stepCounts(free, ['a'])).toBe('적음 1');
  });
  it('학생 칸·모아 보기 CSV는 적은 글 그대로', () => {
    expect(studentEvalCell(free, 'a')).toEqual({ main: '85', note: '' });
    expect(evalCellText(studentEvalCell(free, 'b'))).toBe('A+ - 발표');
    const rows = overviewCsvRows([free], [{ sid: 'a', num: 1, name: '가람' }, { sid: 'b', num: 2, name: '나래' }]);
    expect(rows.slice(2)).toEqual([
      ['1', '가람', '85', ''],
      ['2', '나래', 'A+', '발표'],
    ]);
  });
  it('기타에는 점수 기준이 없다', () => {
    expect(hasScoreCuts({ ...free, cuts: [10] })).toBe(false);
  });
  it('저장할 때 적은 결과의 앞뒤 빈칸을 걷고, 빈칸뿐이면 뺀다', () => {
    expect(cleanEvalValue({ indiv: '  85 ', group: ' 잘함' })).toEqual({ indiv: '85', group: '잘함' });
    expect(cleanEvalValue({ indiv: '   ' })).toBeNull();
    expect(evalValuesChanges({ a: { indiv: '85' } }, { a: { indiv: '85 ' } })).toEqual({});
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

describe('점수로 단계 자동 매기기 (P46-2)', () => {
  // 사용자 예: 3단계, 10 이상 '우수' · 5 이상 10 미만 '보통' · 5 미만 '노력요함'
  const steps = ['우수', '보통', '노력요함'];
  const cuts = [10, 5];
  const scored = { ...base, steps, cuts };
  it('점수 → 단계 (기준은 이상)', () => {
    expect(stepForScore(steps, cuts, 10)).toBe('우수');
    expect(stepForScore(steps, cuts, 12.5)).toBe('우수');
    expect(stepForScore(steps, cuts, 7)).toBe('보통');
    expect(stepForScore(steps, cuts, 5)).toBe('보통');
    expect(stepForScore(steps, cuts, 4.9)).toBe('노력요함');
    expect(stepForScore(steps, cuts, -3)).toBe('노력요함');
  });
  it('점수 글자 읽기 - 숫자가 아니면 null', () => {
    expect(parseScore('7')).toBe(7);
    expect(parseScore(' 7.5 ')).toBe(7.5);
    expect(parseScore('-1')).toBe(-1);
    expect(parseScore('')).toBeNull();
    expect(parseScore('결석')).toBeNull();
    expect(parseScore('7점')).toBeNull();
    expect(parseScore(undefined)).toBeNull();
  });
  it('점수를 치면 결과가 그 단계, 비우거나 숫자가 아니면 결과도 비운다(점수 글은 남긴다)', () => {
    expect(scorePatch(scored, 'indiv', '7')).toEqual({ score: '7', indiv: '보통' });
    expect(scorePatch(scored, 'group', '10')).toEqual({ groupScore: '10', group: '우수' });
    expect(scorePatch(scored, 'indiv', '')).toEqual({ score: '', indiv: '' });
    expect(scorePatch(scored, 'indiv', '결석')).toEqual({ score: '결석', indiv: '' });
    expect(cleanEvalValue(scorePatch(scored, 'indiv', '결석'))).toEqual({ score: '결석' });
    expect(cleanEvalValue(scorePatch(scored, 'indiv', ''))).toBeNull();
  });
  it('기준 검사 - 빈 칸 · 위 단계보다 크거나 같으면 그 칸', () => {
    expect(badCutIndex([10, 5])).toBe(-1);
    expect(badCutIndex([90, 80, 70, 60])).toBe(-1);
    expect(badCutIndex([10, null])).toBe(1);
    expect(badCutIndex([null, 5])).toBe(0);
    expect(badCutIndex([5, 10])).toBe(1);
    expect(badCutIndex([5, 5])).toBe(1);
  });
  it('기준이 있는 조사표 = 평가 · 기준 수 = 단계 수 − 1', () => {
    expect(hasScoreCuts(scored)).toBe(true);
    expect(hasScoreCuts({ ...scored, cuts: [10] })).toBe(false);
    expect(hasScoreCuts({ ...scored, cuts: undefined })).toBe(false);
    expect(hasScoreCuts({ ...scored, type: 'check' })).toBe(false);
  });
  it('기준을 바꾸면 점수가 있는 학생만 다시 매긴다 - 손으로 바꾼 결과도 덮고, 바뀐 수를 센다', () => {
    const values = {
      a: { score: '7', indiv: '보통' },
      b: { score: '9', indiv: '우수' }, // 손으로 바꾼 결과
      c: { indiv: '노력요함' }, // 점수 없음 - 그대로
      d: { score: '결석' },
    };
    const { values: next, changed } = rescoreValues(steps, [8, 5], values);
    expect(next.a).toEqual({ score: '7', indiv: '보통' });
    expect(next.b).toEqual({ score: '9', indiv: '우수' });
    expect(changed).toBe(0);
    const r2 = rescoreValues(steps, [6, 3], values);
    expect(r2.values.a.indiv).toBe('우수');
    expect(r2.values.b.indiv).toBe('우수');
    expect(r2.values.c).toBe(values.c);
    expect(r2.values.d).toBe(values.d);
    expect(r2.changed).toBe(1);
  });
  it('점수 칸도 바뀐 학생 칸만 저장한다', () => {
    expect(evalValuesChanges({ a: { score: '7', indiv: '보통' } }, { a: { score: '7 ', indiv: '보통' } })).toEqual({});
    expect(evalValuesChanges({ a: { score: '7', indiv: '보통' } }, { a: { score: '12', indiv: '우수' } })).toEqual({ 'values.a': { score: '12', indiv: '우수' } });
  });
});

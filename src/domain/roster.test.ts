import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';
import {
  addStudents,
  classCsvRows,
  classesInScope,
  classIdOf,
  cleanStudent,
  describeClass,
  gradeOptions,
  hubPickOf,
  indexOfPick,
  nextClassNum,
  readHubPick,
  numOptions,
  parseClassCsv,
  parseRosterCsv,
  reconcilePick,
  rosterCsvRows,
  textToGender,
  withSids,
  yearOptions,
  trustedHubId,
  type RosterClass,
} from './roster';

const cls = (year: number, grade: number, num: number, students: RosterClass['students'] = []): RosterClass => ({ year, grade, num, students });
const classes = [cls(2026, 3, 2), cls(2026, 3, 10), cls(2026, 3, 1), cls(2026, 4, 1), cls(2025, 6, 3)];

describe('학년도 / 학년 / 반 고르기 (V4 classPicker)', () => {
  it('학년도는 최근 것부터, 반은 숫자 차례 (10반이 2반 뒤)', () => {
    expect(yearOptions(classes)).toEqual(['2026', '2025']);
    expect(gradeOptions(classes, '2026')).toEqual(['3', '4']);
    expect(numOptions(classes, '2026', '3')).toEqual(['1', '2', '10']);
    expect(gradeOptions(classes, '')).toEqual(['3', '4', '6']);
  });
  it('한 칸을 바꾸면 나머지를 고를 수 있는 첫 값으로', () => {
    expect(reconcilePick(classes, { year: '2025', grade: '3', num: '2' })).toEqual({ year: '2025', grade: '6', num: '3' });
    expect(reconcilePick([], { year: '2026', grade: '1', num: '1' })).toEqual({ year: '', grade: '', num: '' });
    expect(indexOfPick(classes, { year: '2026', grade: '3', num: '10' })).toBe(1);
  });
  it('검색 범위 - 빈 칸은 전체', () => {
    expect(classesInScope(classes, { year: '2026', grade: '3', num: '' })).toHaveLength(3);
    expect(classesInScope(classes, { year: '', grade: '', num: '' })).toHaveLength(5);
  });
  it('id·이름', () => {
    expect(classIdOf(cls(2026, 5, 2))).toBe('2026-5-2');
    expect(describeClass(cls(2026, 5, 2))).toBe('2026학년도 5학년 2반');
  });
});

describe('고른 학급 = 학년도와 함께 (P22-4 - 3월 1일부터 지난 학년 학급으로 열지 않는다)', () => {
  it('고른 때의 학년도가 지나면 믿지 않는다', () => {
    const pick = hubPickOf('2026-5-2', 2026);
    expect(trustedHubId(pick, 2026)).toBe('2026-5-2');
    expect(trustedHubId(pick, 2027)).toBeNull();
  });

  it('올해 일부러 고른 지난 학년 학급은 올해 동안 믿는다', () => {
    expect(trustedHubId(hubPickOf('2025-4-3', 2026), 2026)).toBe('2025-4-3');
  });

  it('새 학년도 학급을 2월에 미리 고르면 3월에도 믿는다', () => {
    const pick = hubPickOf('2027-6-1', 2026);
    expect(trustedHubId(pick, 2027)).toBe('2027-6-1');
    expect(trustedHubId(pick, 2028)).toBeNull();
  });

  it('옛 글자 값은 그 학급의 학년도로 읽는다', () => {
    expect(readHubPick('2026-5-2')).toEqual({ id: '2026-5-2', year: 2026 });
    expect(trustedHubId(readHubPick('2026-5-2'), 2027)).toBeNull();
  });

  it('적어 둔 값을 그대로 읽고, 틀린 값은 없는 것으로', () => {
    expect(readHubPick(JSON.stringify(hubPickOf('2025-4-3', 2026)))).toEqual({ id: '2025-4-3', year: 2026 });
    expect(readHubPick(null)).toBeNull();
    expect(readHubPick('')).toBeNull();
    expect(readHubPick('학급')).toBeNull();
    expect(readHubPick('{"id":1}')).toBeNull();
    expect(readHubPick('123')).toBeNull();
  });
});

describe('고치기', () => {
  it('새 학급 = 같은 학년의 빈 반 번호, 학생 더하기 = 번호를 이어서', () => {
    expect(nextClassNum(classes, 2026, 3)).toBe(3);
    expect(nextClassNum(classes, 2026, 5)).toBe(1);
    let n = 0;
    const added = addStudents([{ sid: 'a', num: 3, name: '가', status: 'active' }], 2, () => `s${++n}`);
    expect(added.map((s) => [s.sid, s.num, s.name])).toEqual([
      ['a', 3, '가'],
      ['s1', 4, ''],
      ['s2', 5, ''],
    ]);
  });
  it('저장할 칸 - 빈 칸은 뺀다', () => {
    expect(cleanStudent({ sid: 'a', num: 1, name: ' 김 ', gender: '', status: 'active', note: '  ' })).toEqual({ sid: 'a', num: 1, name: '김', status: 'active' });
    expect(cleanStudent({ sid: 'a', num: 1, name: '김', gender: 'F', status: 'out', outDate: '2026-10-01', note: '전학' })).toEqual({
      sid: 'a', num: 1, name: '김', gender: 'F', status: 'out', outDate: '2026-10-01', note: '전학',
    });
  });
});

describe('CSV (V4 rosterCsv·csvHelper)', () => {
  const students: RosterClass['students'] = [
    { sid: 'a', num: 1, name: '김하늘', gender: 'F', status: 'active', note: '체육 면제' },
    { sid: 'b', num: 2, name: '이바다', gender: 'M', status: 'out' },
  ];
  it('학급 하나: 내려받은 것을 그대로 다시 읽는다', () => {
    const rows = classCsvRows(students);
    expect(rows[0]).toEqual(['번호', '이름', '성별', '상태', '특이사항']);
    expect(parseClassCsv(parseCsv(toCsv(rows)))).toEqual([
      { num: 1, name: '김하늘', gender: 'F', status: 'active', note: '체육 면제' },
      { num: 2, name: '이바다', gender: 'M', status: 'out', note: '' },
    ]);
  });
  it('모든 학급: 학년도·학년·반으로 묶고, 칸 차례가 바뀌어도 머리말로 찾는다', () => {
    const rows = rosterCsvRows([cls(2026, 3, 2, students), cls(2026, 3, 1, [{ sid: 'c', num: 1, name: '박구름', status: 'active' }])]);
    const back = parseRosterCsv(parseCsv(toCsv(rows)));
    expect(back.classes.map((c) => [classIdOf(c), c.students.length])).toEqual([
      ['2026-3-1', 1],
      ['2026-3-2', 2],
    ]);
    const swapped = parseRosterCsv([['이름', '번호', '반', '학년', '학년도'], ['가', '1', '2', '3', '2026'], ['', '2', '2', '3', '2026'], ['나', 'x', '2', '3', '2026']]);
    expect(swapped.classes[0].students.map((s) => s.name)).toEqual(['가']);
    expect(swapped.skipped).toBe(2);
  });
  it('성별 글자', () => {
    expect(['남', 'female', 'M', '?'].map(textToGender)).toEqual(['M', 'F', 'M', '']);
  });
  it('다시 올리면 이름이 같은 학생의 sid를 잇는다 (번호가 바뀌어도)', () => {
    let n = 0;
    const next = withSids(
      [
        { num: 1, name: '새학생', status: 'active' },
        { num: 2, name: '김하늘', status: 'active' },
      ],
      students,
      () => `new${++n}`,
    );
    expect(next.map((s) => [s.num, s.name, s.sid])).toEqual([
      [1, '새학생', 'new1'],
      [2, '김하늘', 'a'],
    ]);
  });
});

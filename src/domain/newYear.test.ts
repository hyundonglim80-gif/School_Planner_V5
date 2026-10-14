import { describe, expect, it } from 'vitest';
import { copiedTimetable, defaultNewYear, hasPastData, latestTimetableBefore, newYearPending, newYearState, newYearTarget, parseRosterPaste, timetableInYear } from './newYear';

const tt = (id: string, from: string, to: string, cell = '국어') => ({
  id,
  name: id,
  from,
  to,
  grid: { '1': { '1': cell } },
});
const cls = (year: number, grade: number, num: number) => ({
  year,
  grade,
  num,
  students: [],
});

describe('새 학년도 넘기기', () => {
  it('띠는 2/15 ~ 3/31에 - 그 3월에 시작하는 학년도', () => {
    expect(newYearTarget('2027-02-14')).toBeNull();
    expect(newYearTarget('2027-02-15')).toBe(2027);
    expect(newYearTarget('2027-03-31')).toBe(2027);
    expect(newYearTarget('2027-04-01')).toBeNull();
    expect(newYearTarget('2026-10-14')).toBeNull();
    // 띠 밖에서 창을 열면: 3~8월은 올해, 9~2월은 다음 학년도
    expect(defaultNewYear('2026-04-10')).toBe(2026);
    expect(defaultNewYear('2026-10-14')).toBe(2027);
    expect(defaultNewYear('2027-01-20')).toBe(2027);
    expect(defaultNewYear('2027-02-20')).toBe(2027);
  });

  it('시간표: 그 학년도에 걸친 것이 있나 · 베낄 것은 그 전에 가장 늦게 시작한 것 · 베낀 것은 3/1 ~ 이듬해 2월 끝(윤년)', () => {
    const list = [tt('a', '2026-03-01', '2027-02-28'), tt('b', '2026-08-20', '2027-02-28', '과학')];
    expect(timetableInYear(list, 2026)).toBe(true);
    expect(timetableInYear(list, 2027)).toBe(false);
    expect(latestTimetableBefore(list, 2027)?.id).toBe('b');
    expect(latestTimetableBefore(list, 2026)).toBeNull();
    const copy = copiedTimetable(list[1], 2027);
    expect(copy).toEqual({
      name: '1학기 시간표',
      from: '2027-03-01',
      to: '2028-02-29',
      grid: { '1': { '1': '과학' } },
    });
    copy.grid['1']['1'] = '수학';
    expect(list[1].grid['1']['1']).toBe('과학'); // 베낀 표를 고쳐도 옛 표는 그대로
  });

  it('할 것: 학급·시간표·방학·담임반 - 다 되면 띠를 내린다', () => {
    const base = {
      classes: [cls(2026, 5, 2)],
      timetables: [tt('a', '2026-03-01', '2027-02-28')],
      terms: {},
      homeroomClass: '5-2',
    };
    const s = newYearState(2027, base);
    expect(s).toMatchObject({
      year: 2027,
      classes: [],
      lastClasses: [cls(2026, 5, 2)],
      timetable: false,
      terms: false,
      homeroom: false,
    });
    expect(newYearPending(s)).toBe(true);
    const done = newYearState(2027, {
      classes: [...base.classes, cls(2027, 6, 1)],
      timetables: [...base.timetables, tt('n', '2027-03-01', '2028-02-29')],
      terms: {
        '2027': {
          summer: { from: '2027-07-20', to: '2027-08-16' },
          winter: { from: '2028-01-05', to: '2028-02-29' },
        },
      },
      homeroomClass: '6-1',
    });
    expect(newYearPending(done)).toBe(false);
    // 담임반이 없는 교사 유형(전담)은 담임반을 보지 않는다
    expect(newYearState(2027, { ...base, homeroomClass: null }).homeroom).toBe(true);
  });

  it('지난 자료가 없는(처음 쓰는) 계정에는 띄우지 않는다', () => {
    expect(hasPastData({ classes: [], timetables: [] }, 2027)).toBe(false);
    expect(
      hasPastData(
        {
          classes: [cls(2027, 1, 1)],
          timetables: [tt('n', '2027-03-01', '2028-02-29')],
        },
        2027,
      ),
    ).toBe(false);
    expect(hasPastData({ classes: [cls(2026, 1, 1)], timetables: [] }, 2027)).toBe(true);
    expect(hasPastData({ classes: [], timetables: [tt('a', '2026-03-01', '2027-02-28')] }, 2027)).toBe(true);
  });

  it('붙여 넣은 명단: 엑셀 칸(번호·이름·성별) · 이름만 · 머리말·빈 줄 빼기', () => {
    expect(parseRosterPaste('번호\t이름\t성별\n1\t김가나\t남\n2\t이다라\t여\n\n')).toEqual([
      { num: 1, name: '김가나', gender: 'M', status: 'active' },
      { num: 2, name: '이다라', gender: 'F', status: 'active' },
    ]);
    expect(parseRosterPaste('김가나\n이다라 여\n박마바').map((s) => [s.num, s.name, s.gender])).toEqual([
      [1, '김가나', ''],
      [2, '이다라', 'F'],
      [3, '박마바', ''],
    ]);
    expect(parseRosterPaste('김가나, 이다라, 박마바').map((s) => s.name)).toEqual(['김가나', '이다라', '박마바']);
    // 번호가 있는 줄과 없는 줄이 섞이면 없는 줄은 빈 번호부터
    expect(parseRosterPaste('2 이다라\n김가나').map((s) => [s.num, s.name])).toEqual([
      [1, '김가나'],
      [2, '이다라'],
    ]);
  });
});

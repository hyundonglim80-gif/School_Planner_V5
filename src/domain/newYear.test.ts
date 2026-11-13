import { describe, expect, it } from 'vitest';
import {
  classNumsLabel,
  copiedTimetable,
  defaultNewYear,
  dropSubjectChanges,
  hasPastData,
  latestTimetableBefore,
  newClassPlan,
  newYearPending,
  newYearState,
  newYearTarget,
  parseClassNums,
  parseRosterPaste,
  staleImportedSubjects,
  teachingClassesOffer,
  timetableInYear,
} from './newYear';

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
    // 같은 날 시작한 표가 둘이면 화면처럼 나중에 만든 것 (P26-3 - 실제 자료: 옛 V4 가져온 표와 새로 만든 표가 10/20에 같이 시작, 목록 차례로 옛 표를 베꼈다)
    const twins = [{ ...tt('e_v4', '2026-10-20', '2027-02-28', '401'), createdAt: 100 }, { ...tt('s_new', '2026-10-20', '2027-02-28', '4-1 체육'), createdAt: 200 }, tt('a', '2026-03-01', '2027-02-28')];
    expect(latestTimetableBefore(twins, 2027)?.id).toBe('s_new');
    expect(latestTimetableBefore([...twins].reverse(), 2027)?.id).toBe('s_new');
    // 마지막에 쓰던 표 = 2월 끝날에 쓰던 표 - 늦게 시작했어도 그 전에 끝난 표(겨울 임시 표)가 아니다
    const ended = [tt('a', '2026-03-01', '2027-02-28', '국어'), tt('w', '2026-12-01', '2026-12-31', '임시')];
    expect(latestTimetableBefore(ended, 2027)?.id).toBe('a');
    // 2월 끝날에 쓰는 표가 없으면 가장 늦게 시작한 것
    expect(latestTimetableBefore([tt('a', '2026-03-01', '2026-07-31'), tt('b', '2026-08-20', '2026-12-31', '과학')], 2027)?.id).toBe('b');
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
  it('새 학년도 날짜에 남은 V4 과목 (P26-3 - 새 시간표를 가린다): V4에서 가져온 것·그 학년도·과목 칸만', () => {
    const v4 = { from: 'v4' };
    const days = {
      '2027-03-08': { id: '2027-03-08', src: v4, periods: { '2': { subject: '402' } } },
      '2027-03-02': { id: '2027-03-02', src: v4, periods: { '5': { subject: '403', supplies: '공' }, '1': { subject: '401' }, '3': { supplies: '줄넘기' } } },
      '2027-02-26': { id: '2027-02-26', src: v4, periods: { '1': { subject: '401' } } }, // 지난 학년도
      '2028-03-06': { id: '2028-03-06', src: v4, periods: { '1': { subject: '401' } } }, // 다음 학년도
      '2027-03-09': { id: '2027-03-09', periods: { '1': { subject: '보강' } } }, // V5에서 바꾼 것
      '2027-03-10': { id: '2027-03-10', src: v4, periods: { '1': { supplies: '공' } } }, // 과목 없음
      '2027-03-15': { id: '2027-03-15', src: v4, deletedAt: 1, periods: { '2': { subject: '402' } } }, // 지움
      '2027-03-16': { id: '2027-03-16', src: v4, periods: { '4': { subject: '' } } }, // 빈 글자 = 그 교시 수업 없음도 옛 것
    };
    expect(staleImportedSubjects(days, 2027)).toEqual([
      { date: '2027-03-02', periods: ['1', '5'] },
      { date: '2027-03-08', periods: ['2'] },
      { date: '2027-03-16', periods: ['4'] },
    ]);
    expect(staleImportedSubjects(days, 2026)).toEqual([{ date: '2027-02-26', periods: ['1'] }]);
    // 과목만 빼고 비고(준비물)는 남긴다 - 남는 것이 없으면 그 교시 칸째
    expect(dropSubjectChanges(days['2027-03-02'], ['1', '5'])).toEqual({ 'periods.1': undefined, 'periods.5.subject': undefined });
    expect(dropSubjectChanges(days['2027-03-02'], ['3'])).toEqual({});
  });
});

describe('교과 전담 새 학급 한꺼번에 (P32-3)', () => {
  it('반 칸: 하나 · 범위(~ 또는 -) · 쉼표·띄어쓰기 · 섞기 - 작은 것부터 겹치지 않게', () => {
    expect(parseClassNums('3')).toEqual({ nums: [3], bad: [] });
    expect(parseClassNums('1~6')).toEqual({ nums: [1, 2, 3, 4, 5, 6], bad: [] });
    expect(parseClassNums('1-4')).toEqual({ nums: [1, 2, 3, 4], bad: [] });
    expect(parseClassNums('1 ~ 3, 5')).toEqual({ nums: [1, 2, 3, 5], bad: [] });
    expect(parseClassNums('5, 1 3 3')).toEqual({ nums: [1, 3, 5], bad: [] });
    expect(parseClassNums('2~4, 3~5')).toEqual({ nums: [2, 3, 4, 5], bad: [] });
    // 전각 숫자·물결·'반' 글자
    expect(parseClassNums('１～３반')).toEqual({ nums: [1, 2, 3], bad: [] });
    expect(parseClassNums('1반, 2반')).toEqual({ nums: [1, 2], bad: [] });
    expect(parseClassNums('')).toEqual({ nums: [], bad: [] });
  });

  it('반 칸: 1~30 밖·거꾸로 범위·끝나지 않은 범위는 읽지 못한다', () => {
    expect(parseClassNums('0').bad).toEqual(['0']);
    expect(parseClassNums('31').bad).toEqual(['31']);
    expect(parseClassNums('4~2').bad).toEqual(['4~2']);
    expect(parseClassNums('1~31').bad).toEqual(['1~31']);
    expect(parseClassNums('1~').bad).toEqual(['1~']);
    expect(parseClassNums('6-1~6-4').bad).toEqual(['6-1~6-4']);
    expect(parseClassNums('1, 99')).toEqual({ nums: [1], bad: ['99'] });
  });

  it('이미 있는 반은 건너뛴다 (지운 학급은 없는 것)', () => {
    const live = new Set(['2027-6-3', '2026-6-1']);
    expect(newClassPlan((id) => live.has(id), { year: 2027, grade: 6, nums: [1, 2, 3, 4] })).toEqual({ make: [1, 2, 4], skip: [3] });
    expect(newClassPlan(() => false, { year: 2027, grade: 6, nums: [] })).toEqual({ make: [], skip: [] });
    expect(classNumsLabel(6, [1, 2, 4])).toBe('6학년 1·2·4반');
  });

  it('가르치는 반 바꾸기는 빠지는 반이 있을 때만 - 그 학년도 학급 차례로', () => {
    const year = [cls(2027, 6, 10), cls(2027, 6, 2), cls(2027, 6, 1)];
    expect(teachingClassesOffer(['5-1', '5-2', '6-1'], year)).toEqual({ next: ['6-1', '6-2', '6-10'], dropped: ['5-1', '5-2'] });
    // 비었거나 새 학급이 다 들어 있으면 물을 것이 없다 (명렬표의 반은 ▼에 저절로)
    expect(teachingClassesOffer([], year)).toBeNull();
    expect(teachingClassesOffer(['6-1', '6-2'], year)).toBeNull();
    // 그 학년도 학급이 없으면 바꿀 것이 없다
    expect(teachingClassesOffer(['5-1'], [])).toBeNull();
  });
});

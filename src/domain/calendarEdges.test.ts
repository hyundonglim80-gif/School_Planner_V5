// 일정 셈의 경계 날짜 (P14-7 - 해 넘김 12-31 → 1-1 · 학년도 2월 말 ↔ 3월 · 윤년 2028-02-29 · 달 넘김).
// 셈마다 따로 있는 시험에 더해, 경계에서 모듈끼리 같은 답을 내는지 한곳에서 본다.
import { describe, expect, it } from 'vitest';
import {
  academicYearOf,
  academicYearRange,
  addDays,
  addMonthsStr,
  daysBetween,
  isValidDateStr,
  monthEnd,
  monthGridDates,
  weekDates,
  weekMonday,
} from './dateUtils';
import { dueBadge } from './eventDue';
import { carriedOf, forwardWindowStart, isCarried, staleOf, type ForwardItem } from './forward';
import { holidayNameIn, holidayYearsToWarn } from './holidays';
import { onPeriodDay, periodDays, periodPosition, skipDayChanges, skipsOffDays, spanCount } from './period';
import { layoutWeekBars, periodsInDates } from './periodBars';
import { recurDates } from './recur';
import { isVacation, schoolYearSpan, semesterSpan, termSemesters } from './semester';

/** 고정 공휴일만 (서버 표가 없을 때와 같다) */
const fixedHoliday = (d: string) => !!holidayNameIn(d, {});

describe('날짜 셈 - 해·달·윤년 넘김', () => {
  it('하루 더하기·빼기와 날 수', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2027-12-31', '2028-01-01')).toBe(1);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-03-01', '2028-03-01')).toBe(366);
  });

  it('달 더하기는 말일로 맞춘다 (1/31 + 1달 = 2월 말일)', () => {
    expect(addMonthsStr('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonthsStr('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsStr('2028-02-29', 12)).toBe('2029-02-28');
    expect(addMonthsStr('2026-12-31', 2)).toBe('2027-02-28');
    expect(addMonthsStr('2027-03-31', -1)).toBe('2027-02-28');
  });

  it('있는 날짜 · 말일', () => {
    expect(isValidDateStr('2027-02-29')).toBe(false);
    expect(isValidDateStr('2028-02-29')).toBe(true);
    expect(monthEnd(2027, 2)).toBe('2027-02-28');
    expect(monthEnd(2028, 2)).toBe('2028-02-29');
    expect(monthEnd(2026, 12)).toBe('2026-12-31');
  });

  it('학년도 = 3월 ~ 이듬해 2월 말일', () => {
    expect(academicYearOf('2027-02-28')).toBe(2026);
    expect(academicYearOf('2027-03-01')).toBe(2027);
    expect(academicYearOf('2028-02-29')).toBe(2027);
    expect(academicYearOf('2026-12-31')).toBe(2026);
    expect(academicYearOf('2027-01-01')).toBe(2026);
    expect(academicYearRange(2026)).toEqual(['2026-03-01', '2027-02-28']);
    expect(academicYearRange(2027)).toEqual(['2027-03-01', '2028-02-29']);
    expect(schoolYearSpan(2027)).toEqual({ start: '2027-03-01', end: '2028-02-29' });
    expect(semesterSpan(2027, 2).end).toBe('2028-02-29');
    expect(semesterSpan(2026, 2).end).toBe('2027-02-28');
  });

  it('주·달력 칸이 해를 넘는다', () => {
    expect(weekMonday('2027-01-01')).toBe('2026-12-28');
    expect(weekDates('2027-01-03')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    const dec = monthGridDates(2026, 12);
    expect(dec[0]).toBe('2026-11-29');
    expect(dec[dec.length - 1]).toBe('2027-01-02');
    const feb = monthGridDates(2028, 2);
    expect(feb).toContain('2028-02-29');
    expect(feb[0]).toBe('2028-01-30');
    expect(feb.length % 7).toBe(0);
  });
});

describe('기간 - 해·학년도·윤년 넘김', () => {
  it('주말 빼기는 해를 넘어도 주말·고정 공휴일(신정)을 뺀다', () => {
    const item = { date: '2026-12-30', endDate: '2027-01-05', workdays: true };
    expect(periodDays(item, fixedHoliday)).toEqual(['2026-12-30', '2026-12-31', '2027-01-04', '2027-01-05']);
    expect(periodPosition(item, '2027-01-04', fixedHoliday)).toEqual({ k: 3, n: 4 });
    expect(periodPosition(item, '2027-01-01', fixedHoliday)).toBeNull();
  });

  it('윤년 2월 말 ~ 3월 (삼일절은 빠진다)', () => {
    expect(spanCount('2028-02-28', '2028-03-01', false)).toEqual({ days: 3, off: 0 });
    expect(spanCount('2028-02-28', '2028-03-01', true, fixedHoliday)).toEqual({ days: 2, off: 1 });
    expect(periodDays({ date: '2027-02-26', endDate: '2027-03-02', workdays: true }, fixedHoliday)).toEqual(['2027-02-26', '2027-03-02']);
  });

  it('모두 쉬는 날인 기간은 주말 빼기를 하지 않는다 - 토~일 기간이 0일이 되어 사라지지 않게 (P14-7)', () => {
    const camp = { date: '2026-10-31', endDate: '2026-11-01', workdays: true };
    expect(skipsOffDays(camp)).toBe(false);
    expect(periodDays(camp)).toEqual(['2026-10-31', '2026-11-01']);
    expect(onPeriodDay(camp, '2026-11-01')).toBe(true);
    expect(periodPosition(camp, '2026-11-01')).toEqual({ k: 2, n: 2 });
    expect(spanCount('2026-10-31', '2026-11-01', true)).toEqual({ days: 2, off: 0, allOff: true });
    // 연휴(토 ~ 월 공휴일) - 표가 와서 모두 쉬는 날이 된 기간도
    const longWeekend = { date: '2028-02-26', endDate: '2028-03-01', workdays: true };
    expect(periodDays(longWeekend, fixedHoliday)).toEqual(['2028-02-28', '2028-02-29']);
    expect(periodDays({ date: '2027-02-27', endDate: '2027-03-01', workdays: true }, fixedHoliday)).toEqual(['2027-02-27', '2027-02-28', '2027-03-01']);
    // 평일이 하나라도 있으면 그대로 뺀다
    const friSun = { date: '2026-10-30', endDate: '2026-11-01', workdays: true };
    expect(skipsOffDays(friSun)).toBe(true);
    expect(periodDays(friSun)).toEqual(['2026-10-30']);
    // 평일을 '이 날만 지우기'로 빼도 주말이 살아나지 않는다 - 남는 날이 없어 항목을 지운다
    expect(periodDays({ ...friSun, skipDates: ['2026-10-30'] })).toEqual([]);
    expect(skipDayChanges(friSun, '2026-10-30')).toBeNull();
  });

  it('막대: 해를 넘는 달력 줄 · 주말을 감춘 줄(월~금)', () => {
    const dec = monthGridDates(2026, 12);
    const lastRow = dec.slice(-7); // 12-27(일) ~ 1-2(토)
    const p = { id: 'p', date: '2026-12-30', endDate: '2027-01-02' };
    const { bars } = layoutWeekBars(lastRow, [p]);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ start: 3, len: 4, startsPeriod: true, endsPeriod: true });
    // 주말을 감추면 월~금 다섯 칸 - 월~일 기간은 금요일에서 끊기고 뒤에 이어진다
    const weekdaysOnly = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08'];
    const week = { id: 'w', date: '2027-01-04', endDate: '2027-01-10' };
    const shown = layoutWeekBars(weekdaysOnly, [week]).bars;
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ start: 0, len: 5, startsPeriod: true, endsPeriod: false, total: 7 });
    // 금 ~ 월 기간: 감춘 줄에서는 금 한 칸, 다음 줄 월 한 칸 (막대는 두 날 이상 기간만 - 칸마다 끊긴다)
    const fm = { id: 'fm', date: '2027-01-08', endDate: '2027-01-11' };
    expect(layoutWeekBars(weekdaysOnly, [fm]).bars[0]).toMatchObject({ start: 4, len: 1, startsPeriod: true, endsPeriod: false });
    expect(periodsInDates(['2027-01-11', '2027-01-12'], [fm])[0]).toMatchObject({ startsPeriod: false, endsPeriod: true });
  });
});

describe('반복 - 해·윤년 넘김', () => {
  it('매주 · 격주가 해를 넘는다 (달력의 주 - 일요일 시작)', () => {
    expect(recurDates({ freq: 'weekly', interval: 1, weekdays: [5] }, '2026-12-25', '2027-01-15')).toEqual(['2026-12-25', '2027-01-01', '2027-01-08', '2027-01-15']);
    expect(recurDates({ freq: 'weekly', interval: 2, weekdays: [1] }, '2026-12-28', '2027-01-31')).toEqual(['2026-12-28', '2027-01-11', '2027-01-25']);
    expect(recurDates({ freq: 'weekly', interval: 2, weekdays: [2] }, '2028-02-22', '2028-03-21')).toEqual(['2028-02-22', '2028-03-07', '2028-03-21']);
  });

  it('매월 29일 - 평년 2월은 건너뛰고 윤년 2월 29일은 넣는다', () => {
    const dates = recurDates({ freq: 'monthly', interval: 1, monthDays: [29] }, '2027-01-29', '2028-03-31');
    expect(dates.filter((d) => d.slice(5, 7) === '02')).toEqual(['2028-02-29']);
    expect(dates).toHaveLength(14);
  });

  it('매월 다섯째 주 - 다섯째 주가 없는 달은 건너뛴다', () => {
    // 2027-02(1일 월요일, 28일)은 다섯째 주가 없다
    expect(recurDates({ freq: 'monthly', interval: 1, monthWeek: 5, weekdays: [1] }, '2027-01-01', '2027-03-31')).toEqual(['2027-03-29']);
  });

  it('매일은 윤일도 센다', () => {
    expect(recurDates({ freq: 'daily', interval: 1 }, '2028-02-27', '2028-03-01')).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  });
});

describe('이월·기한 - 해·학년도 넘김', () => {
  const on = new Map([['L', true]]);
  const ev = (date: string, extra: Partial<ForwardItem> = {}): ForwardItem => ({ kind: 'event', date, text: '숙제 걷기', labelIds: ['L'], ...extra });

  it('12-31 일정이 1-1에 따라온다 · 이월 기간 첫날은 해·윤일을 넘어 센다', () => {
    expect(isCarried(ev('2026-12-31'), on, '2027-01-01', 7)).toBe(true);
    expect(forwardWindowStart('2027-01-03', 7)).toBe('2026-12-27');
    expect(forwardWindowStart('2028-03-01', 1)).toBe('2028-02-29');
    expect(isCarried(ev('2028-02-29'), on, '2028-03-01', 1)).toBe(true);
    expect(isCarried(ev('2028-02-28'), on, '2028-03-01', 1)).toBe(false);
    expect(isCarried(ev('2028-02-28', { carrying: true }), on, '2028-03-01', 1)).toBe(true);
  });

  it('지난 일정 줄도 해를 넘는다 (날짜 차례)', () => {
    const off = new Map([['L', false]]);
    const list = [ev('2027-01-02'), ev('2026-12-30', { text: '서류' })];
    expect(staleOf(list, off, '2027-01-04', 7).map((d) => d.date)).toEqual(['2026-12-30', '2027-01-02']);
    expect(carriedOf(list, on, '2027-01-04', 7).map((d) => d.date)).toEqual(['2027-01-02', '2026-12-30']);
  });

  it('기한 D-n은 해·윤일을 넘어 센다', () => {
    expect(dueBadge('2027-01-01', '2026-12-31')?.text).toBe('D-1');
    expect(dueBadge('2028-03-01', '2028-02-28')?.text).toBe('D-2');
    expect(dueBadge('2027-03-01', '2027-02-28')?.text).toBe('D-1');
    expect(dueBadge('2026-12-31', '2027-01-02')?.text).toBe('기한 2일 지남');
  });
});

describe('방학·학기·공휴일 - 학년도 넘김', () => {
  const terms = { '2027': { summer: { from: '2027-07-20', to: '2027-08-17' }, winter: { from: '2027-12-31', to: '2028-02-29' } } };

  it('겨울 방학은 해를 넘어 그 학년도 것이다 (1~2월 날은 지난 학년도 열쇠)', () => {
    expect(isVacation('2027-12-31', terms)).toBe(true);
    expect(isVacation('2028-01-05', terms)).toBe(true);
    expect(isVacation('2028-02-29', terms)).toBe(true);
    expect(isVacation('2028-03-01', terms)).toBe(false);
    expect(isVacation('2027-12-30', terms)).toBe(false);
    expect(termSemesters(terms['2027'], 2027)).toEqual({ sem1: { from: '2027-03-01', to: '2027-07-19' }, sem2: { from: '2027-08-18', to: '2027-12-30' } });
  });

  it('공휴일 표가 없어도 고정 공휴일은 보이고, 9월부터는 내년 표도 묻는다', () => {
    expect(holidayNameIn('2027-01-01', {})).toBe('신정');
    expect(holidayNameIn('2028-03-01', {})).toBe('삼일절');
    expect(holidayNameIn('2027-02-07', {})).toBeUndefined(); // 설날은 표에서만
    expect(holidayYearsToWarn('2026-08-31')).toEqual([2026]);
    expect(holidayYearsToWarn('2026-12-31')).toEqual([2026, 2027]);
    expect(holidayYearsToWarn('2027-01-01')).toEqual([2027]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  cutFromChanges,
  isPeriod,
  onPeriodDay,
  periodDays,
  periodDoneChanges,
  periodDoneOn,
  periodPosition,
  shiftDates,
  skipDayChanges,
  spanCount,
  type PeriodItem,
} from './period';

// 2026-10-14(수) ~ 2026-10-20(화): 주말 10/17(토)·10/18(일)
const exam: PeriodItem = { date: '2026-10-14', endDate: '2026-10-20', workdays: true };

describe('기간 - 보이는 날', () => {
  it('주말 빼기(workdays)면 평일만, 아니면 모든 날', () => {
    expect(periodDays(exam)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20']);
    expect(periodDays({ ...exam, workdays: undefined })).toHaveLength(7);
    expect(onPeriodDay(exam, '2026-10-17')).toBe(false);
    expect(onPeriodDay(exam, '2026-10-13')).toBe(false);
    expect(onPeriodDay(exam, '2026-10-19')).toBe(true);
  });
  it('공휴일 표를 주면 그날도 뺀다 (P5-3)', () => {
    expect(periodDays(exam, (d) => d === '2026-10-15')).toEqual(['2026-10-14', '2026-10-16', '2026-10-19', '2026-10-20']);
  });
  it('뺀 날(skipDates)은 보이지 않는다', () => {
    expect(periodDays({ ...exam, skipDates: ['2026-10-16'] })).toEqual(['2026-10-14', '2026-10-15', '2026-10-19', '2026-10-20']);
  });
  it('(k/n)은 보이는 날로 센다, 하루짜리는 없다', () => {
    expect(periodPosition(exam, '2026-10-19')).toEqual({ k: 4, n: 5 });
    expect(periodPosition(exam, '2026-10-17')).toBeNull();
    expect(periodPosition({ date: '2026-10-14' }, '2026-10-14')).toBeNull();
    expect(isPeriod({ date: '2026-10-14', endDate: '2026-10-14' })).toBe(false);
  });
  it('끝 날을 고를 때 날 수', () => {
    expect(spanCount('2026-10-14', '2026-10-20', true)).toEqual({ days: 5, off: 2 });
    expect(spanCount('2026-10-14', '2026-10-20', false)).toEqual({ days: 7, off: 0 });
    expect(spanCount('2026-10-14', '2026-10-13', true)).toEqual({ days: 0, off: 0 });
  });
});

describe('기간 - 날마다 완료', () => {
  it('그날을 doneDates에, 모두 끝내면 done', () => {
    expect(periodDoneChanges(exam, '2026-10-14', true, 9)).toEqual({ doneDates: ['2026-10-14'] });
    const four = { ...exam, doneDates: ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19'] };
    expect(periodDoneChanges(four, '2026-10-20', true, 9)).toEqual({ doneDates: undefined, done: true, doneAt: 9 });
    expect(periodDoneOn(four, '2026-10-15')).toBe(true);
    expect(periodDoneOn(four, '2026-10-20')).toBe(false);
  });
  it('모두 끝낸 기간에서 하루를 풀면 나머지 날은 끝낸 채로', () => {
    expect(periodDoneChanges({ ...exam, done: true }, '2026-10-15', false, 9)).toEqual({
      doneDates: ['2026-10-14', '2026-10-16', '2026-10-19', '2026-10-20'],
      done: false,
      doneAt: undefined,
    });
  });
  it('풀어서 하나도 안 남으면 doneDates를 걷는다', () => {
    expect(periodDoneChanges({ ...exam, doneDates: ['2026-10-14'] }, '2026-10-14', false, 9)).toEqual({ doneDates: undefined });
  });
});

describe('기간 - 묶음 지우기', () => {
  it('이 날만 = skipDates에 더한다 (그날 완료도 걷는다), 남는 날이 없으면 null', () => {
    expect(skipDayChanges({ ...exam, doneDates: ['2026-10-15'] }, '2026-10-15')).toEqual({ skipDates: ['2026-10-15'], doneDates: [] });
    expect(skipDayChanges({ ...exam, skipDates: ['2026-10-19'] }, '2026-10-14')).toEqual({ skipDates: ['2026-10-14', '2026-10-19'] });
    expect(skipDayChanges({ date: '2026-10-17', endDate: '2026-10-19', workdays: true }, '2026-10-19')).toBeNull();
  });
  it('이 날부터 = 끝 날을 그 앞의 마지막 날로 (주말을 건너), 뺀 날·끝낸 날도 그 뒤는 걷는다', () => {
    expect(cutFromChanges({ ...exam, skipDates: ['2026-10-20'], doneDates: ['2026-10-14', '2026-10-19'] }, '2026-10-19', 9)).toEqual({
      endDate: '2026-10-16',
      skipDates: undefined,
      doneDates: ['2026-10-14'],
    });
  });
  it('하루만 남으면 하루짜리 일정, 그날 끝냈으면 done', () => {
    expect(cutFromChanges({ ...exam, doneDates: ['2026-10-14'] }, '2026-10-15', 9)).toEqual({
      endDate: undefined,
      workdays: undefined,
      doneDates: undefined,
      done: true,
      doneAt: 9,
    });
  });
  it('남은 날을 모두 끝냈으면 done', () => {
    expect(cutFromChanges({ ...exam, doneDates: ['2026-10-14', '2026-10-15', '2026-10-16'] }, '2026-10-19', 9)).toEqual({
      endDate: '2026-10-16',
      doneDates: undefined,
      done: true,
      doneAt: 9,
    });
  });
  it('첫날부터면 null (항목을 지운다)', () => {
    expect(cutFromChanges(exam, '2026-10-14')).toBeNull();
  });
});

describe('shiftDates', () => {
  it('날 칸을 함께 옮긴다', () => {
    expect(shiftDates(['2026-10-14', '2026-10-31'], 2)).toEqual(['2026-10-16', '2026-11-02']);
    expect(shiftDates([], 2)).toBeUndefined();
  });
});

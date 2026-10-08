import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  addMonthsStr,
  academicYearOf,
  academicYearRange,
  daysBetween,
  formatDate,
  isValidDateStr,
  weekMonday,
} from './dateUtils';

const d = (s: string) => new Date(`${s}T09:00:00`);

describe('addMonthsClamped (V4 dateNav 테스트)', () => {
  it('옮긴 달에 그 날이 없으면 그 달의 마지막 날', () => {
    expect(formatDate(addMonthsClamped(d('2027-01-31'), 1))).toBe('2027-02-28');
    expect(formatDate(addMonthsClamped(d('2028-01-31'), 1))).toBe('2028-02-29');
    expect(formatDate(addMonthsClamped(d('2026-03-31'), -1))).toBe('2026-02-28');
    expect(formatDate(addMonthsClamped(d('2026-10-31'), 1))).toBe('2026-11-30');
    expect(formatDate(addMonthsClamped(d('2026-12-15'), 1))).toBe('2027-01-15');
    expect(formatDate(addMonthsClamped(d('2028-02-29'), 12))).toBe('2029-02-28');
    expect(addMonthsStr('2027-01-31', 1)).toBe('2027-02-28');
  });
});

describe('날짜 글자', () => {
  it('있는 날짜만', () => {
    expect(isValidDateStr('2026-10-08')).toBe(true);
    expect(isValidDateStr('2028-02-29')).toBe(true);
    expect(isValidDateStr('2026-02-29')).toBe(false);
    expect(isValidDateStr('2026-13-01')).toBe(false);
    expect(isValidDateStr('2026-1-1')).toBe(false);
  });

  it('하루 더하기는 달·해를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-08', '2026-10-10')).toBe(2);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
  });

  it('주의 월요일 (일요일은 앞 주)', () => {
    expect(weekMonday('2026-10-08')).toBe('2026-10-05'); // 목
    expect(weekMonday('2026-10-05')).toBe('2026-10-05'); // 월
    expect(weekMonday('2026-10-11')).toBe('2026-10-05'); // 일
    expect(weekMonday('2027-01-01')).toBe('2026-12-28');
  });

  it('학년도는 3월 ~ 이듬해 2월 (윤년 2월 29일)', () => {
    expect(academicYearOf('2026-03-01')).toBe(2026);
    expect(academicYearOf('2027-02-28')).toBe(2026);
    expect(academicYearOf('2026-02-28')).toBe(2025);
    expect(academicYearRange(2027)).toEqual(['2027-03-01', '2028-02-29']);
    expect(academicYearRange(2026)).toEqual(['2026-03-01', '2027-02-28']);
  });
});

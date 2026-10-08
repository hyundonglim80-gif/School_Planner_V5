import { describe, expect, it } from 'vitest';
import { recurDates, recurFormFor, ruleLabel, ruleOf, weekOfMonth, type RecurForm } from './recur';

// 2026-10-14 = 수요일
const form = (over: Partial<RecurForm>): RecurForm => ({ ...recurFormFor('2026-10-14'), ...over });

describe('반복 규칙', () => {
  it('처음 칸은 시작 날의 요일·몇째 주·며칠', () => {
    expect(recurFormFor('2026-10-14')).toEqual({ kind: 'none', weekdays: [3], monthWeek: 2, monthDays: [14], until: '' });
    expect(weekOfMonth('2026-10-07')).toBe(1);
    expect(weekOfMonth('2026-10-29')).toBe(5);
  });
  it('칸 → 규칙, 고른 것이 없으면 null', () => {
    expect(ruleOf(form({ kind: 'none' }))).toBeNull();
    expect(ruleOf(form({ kind: 'weekly', weekdays: [4, 2, 2] }))).toEqual({ freq: 'weekly', interval: 1, weekdays: [2, 4] });
    expect(ruleOf(form({ kind: 'biweekly', weekdays: [] }))).toBeNull();
    expect(ruleOf(form({ kind: 'monthDay', monthDays: [31, 1] }))).toEqual({ freq: 'monthly', interval: 1, monthDays: [1, 31] });
    expect(ruleOf(form({ kind: 'monthWeek' }))).toEqual({ freq: 'monthly', interval: 1, monthWeek: 2, weekdays: [3] });
  });
  it('이름', () => {
    expect(ruleLabel({ freq: 'weekly', interval: 1, weekdays: [2, 4] })).toBe('매주 화·목');
    expect(ruleLabel({ freq: 'weekly', interval: 2, weekdays: [5] })).toBe('격주 금');
    expect(ruleLabel({ freq: 'monthly', interval: 1, monthWeek: 1, weekdays: [2] })).toBe('매월 첫째 주 화');
    expect(ruleLabel({ freq: 'monthly', interval: 1, monthDays: [15] })).toBe('매월 15일');
    expect(ruleLabel({ freq: 'daily', interval: 1 })).toBe('매일');
  });
});

describe('반복 날짜 (V4 computeRecurringDates와 같게)', () => {
  it('매주 화 - 시작 날이 맞지 않으면 처음 맞는 날부터, 끝나는 날까지', () => {
    expect(recurDates({ freq: 'weekly', interval: 1, weekdays: [2] }, '2026-10-14', '2026-11-03')).toEqual(['2026-10-20', '2026-10-27', '2026-11-03']);
  });
  it('격주는 달력의 주(일요일 시작) - 수요일에 시작한 격주 월·금은 이번 주 금, 다다음 주 월·금', () => {
    expect(recurDates({ freq: 'weekly', interval: 2, weekdays: [1, 5] }, '2026-10-14', '2026-11-06')).toEqual([
      '2026-10-16',
      '2026-10-26',
      '2026-10-30',
    ]);
  });
  it('매월 첫째 주 화 · 매월 31일(없는 달은 건너뛴다)', () => {
    expect(recurDates({ freq: 'monthly', interval: 1, monthWeek: 1, weekdays: [2] }, '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-06',
      '2026-11-03',
      '2026-12-01',
    ]);
    expect(recurDates({ freq: 'monthly', interval: 1, monthDays: [31] }, '2026-10-01', '2027-01-31')).toEqual(['2026-10-31', '2026-12-31', '2027-01-31']);
  });
  it('매일 · 끝나는 날이 없거나 앞이면 없다 · limit', () => {
    expect(recurDates({ freq: 'daily', interval: 1 }, '2026-10-14', '2026-10-16')).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(recurDates({ freq: 'daily', interval: 1 }, '2026-10-14', '')).toEqual([]);
    expect(recurDates({ freq: 'daily', interval: 1 }, '2026-10-14', '2026-10-13')).toEqual([]);
    expect(recurDates({ freq: 'daily', interval: 1 }, '2026-01-01', '2027-12-31', 10)).toHaveLength(10);
  });
});

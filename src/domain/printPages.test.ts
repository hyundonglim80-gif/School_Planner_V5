import { describe, expect, it } from 'vitest';
import { pageStart, paperSizeMm, printPageOfScope, printPageStarts, printPageTitle, printRangeLabel } from './printPages';

describe('printPages', () => {
  it('보는 화면 → 처음 고른 쪽 (메모·학급은 하루)', () => {
    expect(['day', 'week', 'month', 'year', 'memo', 'class'].map(printPageOfScope)).toEqual(['day', 'week', 'month', 'year', 'day', 'day']);
  });

  it('고른 날이 든 쪽의 첫날 - 주 = 월요일, 달 = 1일, 학년도 = 3월 1일 (1·2월은 앞 학년도)', () => {
    expect(pageStart('day', '2026-10-23')).toBe('2026-10-23');
    expect(pageStart('week', '2026-10-25')).toBe('2026-10-19');
    expect(pageStart('month', '2026-10-23')).toBe('2026-10-01');
    expect(pageStart('year', '2027-02-10')).toBe('2026-03-01');
  });

  it('구간의 쪽들 - 고른 차례는 상관없고, 넘치면 앞 쪽만 (모두 몇 쪽인지도)', () => {
    expect(printPageStarts('day', '2026-10-23', '2026-10-21').starts).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
    expect(printPageStarts('week', '2026-10-23', '2026-11-03').starts).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(printPageStarts('month', '2026-12-31', '2027-02-01').starts).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
    expect(printPageStarts('year', '2026-05-01', '2027-02-28').starts).toEqual(['2026-03-01']);
    const many = printPageStarts('day', '2026-01-01', '2026-12-31', 31);
    expect(many.starts).toHaveLength(31);
    expect(many.total).toBe(365);
  });

  it('쪽 제목·구간 단추 글', () => {
    expect(printPageTitle('day', '2026-10-23')).toBe('2026년 10월 23일 (금)');
    expect(printPageTitle('week', '2026-10-19')).toBe('2026년 10.19 ~ 10.25 주간');
    expect(printPageTitle('week', '2026-10-19', false)).toBe('2026년 10.19 ~ 10.23 주간');
    expect(printPageTitle('month', '2026-10-01')).toBe('2026년 10월');
    expect(printPageTitle('year', '2026-03-01')).toBe('2026학년도 학사력');
    expect(printRangeLabel('day', '2026-10-23')).toBe('2026. 10/23(금)');
    expect(printRangeLabel('week', '2026-10-23')).toBe('2026. 10.19 ~ 10.25');
    expect(printRangeLabel('month', '2026-10-23')).toBe('2026년 10월');
    expect(printRangeLabel('year', '2027-01-05')).toBe('2026학년도');
  });

  it('A4 찍히는 칸 = 용지 - 여백 둘', () => {
    expect(paperSizeMm(true, 8)).toEqual({ width: 281, height: 194 });
    expect(paperSizeMm(false, 8)).toEqual({ width: 194, height: 281 });
  });
});

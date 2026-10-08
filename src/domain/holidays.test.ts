// 공휴일 이름 - 개인 → 공유 → 고정, 서버 문서 읽기
import { describe, expect, it } from 'vitest';
import { holidayNameIn, readHolidayDoc } from './holidays';

describe('공휴일', () => {
  it('개인 → 공유 → 고정 공휴일 차례', () => {
    const shared = { '2026-10-05': '추석 연휴', '2026-10-03': '개천절' };
    expect(holidayNameIn('2026-10-05', shared)).toBe('추석 연휴');
    expect(holidayNameIn('2026-10-05', shared, { '2026-10-05': '우리 휴일' })).toBe('우리 휴일');
    expect(holidayNameIn('2027-10-09', {})).toBe('한글날');
    expect(holidayNameIn('2026-10-07', shared)).toBeUndefined();
  });

  it('서버 문서: 그 해 날짜와 글만', () => {
    expect(readHolidayDoc(2026, { days: { '2026-01-01': ' 1월1일 ', '2025-12-25': '성탄절', '2026-02-xx': 'x', '2026-03-01': 3 } })).toEqual({ '2026-01-01': '1월1일' });
    expect(readHolidayDoc(2026, null)).toEqual({});
  });
});

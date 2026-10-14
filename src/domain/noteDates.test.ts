// 메모의 날짜 링크 - 옛 기록은 date 하나, 둘 이상일 때만 dates, 바뀐 칸만
import { describe, expect, it } from 'vitest';
import { addNoteDate, cleanDates, datesChanges, datesFields, hasNoteDate, noteDates, noteDatesIn, removeNoteDate } from './noteDates';

describe('메모의 날짜 링크', () => {
  it('읽기: dates가 있으면 그것, 없으면 date 하나, 둘 다 없으면 빈 목록', () => {
    expect(noteDates({ date: '2026-10-06' })).toEqual(['2026-10-06']);
    expect(noteDates({ date: '2026-10-06', dates: ['2026-10-06', '2026-10-09'] })).toEqual(['2026-10-06', '2026-10-09']);
    expect(noteDates({ date: null })).toEqual([]);
    expect(noteDates({})).toEqual([]);
  });

  it('다듬기: 맞는 날짜만·겹침 없이·차례대로', () => {
    expect(cleanDates(['2026-10-09', '2026-10-06', '2026-10-09', '2026-02-30', ''])).toEqual(['2026-10-06', '2026-10-09']);
  });

  it('적을 칸: date = 가장 이른 날, dates는 둘 이상일 때만', () => {
    expect(datesFields([])).toEqual({ date: null });
    expect(datesFields(['2026-10-06'])).toEqual({ date: '2026-10-06' });
    expect(datesFields(['2026-10-09', '2026-10-06'])).toEqual({ date: '2026-10-06', dates: ['2026-10-06', '2026-10-09'] });
  });

  it('바뀐 칸만: 같으면 빈 객체, 둘 → 하나는 dates를 걷는다, 하나 → 둘은 dates만(가장 이른 날이 같으면)', () => {
    expect(datesChanges({ date: '2026-10-06' }, ['2026-10-06'])).toEqual({});
    expect(datesChanges({ date: '2026-10-06' }, ['2026-10-09', '2026-10-06'])).toEqual({ dates: ['2026-10-06', '2026-10-09'] });
    expect(datesChanges({ date: '2026-10-06' }, ['2026-10-01', '2026-10-06'])).toEqual({ date: '2026-10-01', dates: ['2026-10-01', '2026-10-06'] });
    expect(datesChanges({ date: '2026-10-06', dates: ['2026-10-06', '2026-10-09'] }, ['2026-10-09'])).toEqual({ date: '2026-10-09', dates: undefined });
    expect(datesChanges({ date: '2026-10-06' }, [])).toEqual({ date: null });
    expect(datesChanges({ date: null }, ['2026-10-06'])).toEqual({ date: '2026-10-06' });
  });

  it('그 날인가·기간 안의 날·칩 더하기·빼기', () => {
    const n = { date: '2026-10-06', dates: ['2026-10-06', '2026-10-09'] };
    expect(hasNoteDate(n, '2026-10-09')).toBe(true);
    expect(hasNoteDate(n, '2026-10-07')).toBe(false);
    expect(noteDatesIn(n, '2026-10-07', '2026-10-31')).toEqual(['2026-10-09']);
    expect(addNoteDate(['2026-10-09'], '2026-10-06')).toEqual(['2026-10-06', '2026-10-09']);
    expect(addNoteDate(['2026-10-09'], '2026-10-09')).toEqual(['2026-10-09']);
    expect(removeNoteDate(['2026-10-06', '2026-10-09'], '2026-10-06')).toEqual(['2026-10-09']);
  });
});

// 기간 막대 - 줄 안에서 나란한 날을 한 막대로, 뺀 날·주말에서 끊기, 앞뒤 주로 이어짐, 줄(lane) 나누기, 글
import { describe, expect, it } from 'vitest';
import { layoutWeekBars, periodIndexLabel, periodRangeLabel } from './periodBars';

const WEEK = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']; // 일~토

describe('기간 막대', () => {
  it('한 주 안의 기간 = 막대 하나, 앞 주에서 이어지면 startsPeriod 아님', () => {
    const { bars, lanes } = layoutWeekBars(WEEK, [
      { id: 'a', date: '2026-10-06', endDate: '2026-10-08' },
      { id: 'b', date: '2026-10-01', endDate: '2026-10-05' },
    ]);
    expect(lanes).toBe(1);
    const a = bars.find((b) => b.item.id === 'a')!;
    expect([a.start, a.len, a.lane, a.total, a.startsPeriod, a.endsPeriod]).toEqual([2, 3, 0, 3, true, true]);
    const b = bars.find((x) => x.item.id === 'b')!;
    expect([b.start, b.len, b.startsPeriod, b.endsPeriod, b.cells[0].index]).toEqual([0, 2, false, true, 4]);
  });

  it('뺀 날·주말 빼기에서 끊긴다', () => {
    const { bars } = layoutWeekBars(WEEK, [{ id: 'c', date: '2026-10-05', endDate: '2026-10-09', skipDates: ['2026-10-07'] }]);
    expect(bars.map((b) => [b.start, b.len])).toEqual([
      [1, 2],
      [4, 2],
    ]);
    const w = layoutWeekBars(WEEK, [{ id: 'd', date: '2026-10-02', endDate: '2026-10-12', workdays: true }]);
    expect(w.bars.map((b) => [b.start, b.len, b.startsPeriod, b.endsPeriod])).toEqual([[1, 5, false, false]]);
  });

  it('겹치면 다음 줄, 하루짜리는 막대가 아니다', () => {
    const { bars, lanes } = layoutWeekBars(WEEK, [
      { id: 'x', date: '2026-10-05', endDate: '2026-10-08' },
      { id: 'y', date: '2026-10-07', endDate: '2026-10-09' },
      { id: 'z', date: '2026-10-09', endDate: '2026-10-10' },
      { id: 'one', date: '2026-10-06' },
    ]);
    expect(lanes).toBe(2);
    expect(bars.map((b) => [b.item.id, b.lane])).toEqual([
      ['x', 0],
      ['y', 1],
      ['z', 0],
    ]);
  });

  it('글', () => {
    expect(periodRangeLabel([{ date: '2026-10-05' }, { date: '2026-10-09' }])).toBe('10.5 ~ 10.9 · 2일');
    expect(periodIndexLabel([{ index: 2 }, { index: 4 }], 5)).toBe('2~4/5');
    expect(periodIndexLabel([{ index: 3 }], 5)).toBe('3/5');
  });
});

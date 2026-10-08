import { describe, expect, it } from 'vitest';
import { dueBadge, isDueDate } from './eventDue';

// V4 lib/eventDue.test.ts에서 옮김 (사슬 기한 dueOf·newChainId는 V5에 없다 - 기한은 항목의 칸 하나)
describe('dueBadge', () => {
  const today = '2026-10-02';
  it('D-n · D-day · 지남, 3일 안은 soon', () => {
    expect(dueBadge('2026-10-09', today)).toEqual({ text: 'D-7', tone: 'later', days: 7 });
    expect(dueBadge('2026-10-05', today)).toEqual({ text: 'D-3', tone: 'soon', days: 3 });
    expect(dueBadge('2026-10-02', today)).toEqual({ text: 'D-day', tone: 'today', days: 0 });
    expect(dueBadge('2026-09-30', today)).toEqual({ text: '기한 2일 지남', tone: 'over', days: -2 });
  });
  it('끝낸 일정·기한 없음은 없다, 달·해 넘김도', () => {
    expect(dueBadge('2026-10-09', today, true)).toBeNull();
    expect(dueBadge('', today)).toBeNull();
    expect(dueBadge(undefined, today)).toBeNull();
    expect(dueBadge('2027-01-01', '2026-12-31')?.text).toBe('D-1');
  });
});

describe('isDueDate', () => {
  it('날짜 모양만 기한', () => {
    expect(isDueDate('2026-10-02')).toBe(true);
    expect(isDueDate('2026-1-2')).toBe(false);
    expect(isDueDate(undefined)).toBe(false);
  });
});

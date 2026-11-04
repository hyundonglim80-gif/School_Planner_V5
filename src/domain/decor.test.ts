import { describe, expect, it } from 'vitest';
import { decorKind, sanitizeDecor, seasonOf } from './decor';

describe('꾸미기 값', () => {
  it('계절은 달을 따른다 - 경계 달까지', () => {
    expect(seasonOf('2026-02-28')).toBe('winter');
    expect(seasonOf('2026-03-01')).toBe('spring');
    expect(seasonOf('2026-05-31')).toBe('spring');
    expect(seasonOf('2026-06-01')).toBe('summer');
    expect(seasonOf('2026-08-31')).toBe('summer');
    expect(seasonOf('2026-09-01')).toBe('autumn');
    expect(seasonOf('2026-11-30')).toBe('autumn');
    expect(seasonOf('2026-12-01')).toBe('winter');
    expect(seasonOf('2027-01-15')).toBe('winter');
  });

  it("'계절 따라'만 오늘을 보고, 고정은 그대로, 끄기는 없음", () => {
    expect(decorKind('off', '2026-04-01')).toBeNull();
    expect(decorKind('season', '2026-04-01')).toBe('spring');
    expect(decorKind('season', '2026-12-01')).toBe('winter');
    expect(decorKind('summer', '2026-12-01')).toBe('summer');
    expect(decorKind('animal', '2026-04-01')).toBe('animal');
  });

  it('모르는 값은 끄기', () => {
    expect(sanitizeDecor('autumn')).toBe('autumn');
    expect(sanitizeDecor('rainbow')).toBe('off');
    expect(sanitizeDecor(undefined)).toBe('off');
    expect(sanitizeDecor(3)).toBe('off');
  });
});

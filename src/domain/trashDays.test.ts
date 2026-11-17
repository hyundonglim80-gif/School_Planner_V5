import { describe, expect, it } from 'vitest';
import { effectiveTrashDays, TRASH_DAYS_UNSET, TRASH_DEFAULT_DAYS, TRASH_DEFAULT_FROM } from './trashDays';

describe('휴지통 자동 비우기 기간 (P41-1)', () => {
  it('고른 값은 그대로 - 끄기(0)도', () => {
    expect(effectiveTrashDays(0, '2027-03-01')).toBe(0);
    expect(effectiveTrashDays(7, '2026-11-17')).toBe(7);
    expect(effectiveTrashDays(90, '2026-11-17')).toBe(90);
  });

  it('고르지 않은 계정은 기본 90일 - 정한 날부터', () => {
    expect(TRASH_DEFAULT_DAYS).toBe(90);
    expect(effectiveTrashDays(TRASH_DAYS_UNSET, '2026-11-30')).toBe(0);
    expect(effectiveTrashDays(TRASH_DAYS_UNSET, TRASH_DEFAULT_FROM)).toBe(90);
    expect(effectiveTrashDays(TRASH_DAYS_UNSET, '2027-02-28')).toBe(90);
  });
});

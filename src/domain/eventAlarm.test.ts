import { describe, expect, it } from 'vitest';
import { normalizeTimeInput } from './eventAlarm';

describe('normalizeTimeInput', () => {
  it('1430 · 930 · 14:30 · 9:05 → HH:mm', () => {
    expect(normalizeTimeInput('1430')).toBe('14:30');
    expect(normalizeTimeInput('930')).toBe('09:30');
    expect(normalizeTimeInput('14:30')).toBe('14:30');
    expect(normalizeTimeInput(' 9:05 ')).toBe('09:05');
  });
  it('틀린 것은 null', () => {
    expect(normalizeTimeInput('')).toBeNull();
    expect(normalizeTimeInput('2460')).toBeNull();
    expect(normalizeTimeInput('12')).toBeNull();
    expect(normalizeTimeInput('ab')).toBeNull();
  });
});

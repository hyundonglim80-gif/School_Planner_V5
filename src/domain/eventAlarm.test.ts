import { describe, expect, it } from 'vitest';
import { alarmAt, dueAlarms, normalizeTimeInput, type AlarmCandidate } from './eventAlarm';

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

describe('dueAlarms', () => {
  const now = new Date(2026, 9, 8, 14, 30).getTime();
  const ev = (id: string, more: Partial<AlarmCandidate> = {}): AlarmCandidate => ({ id, kind: 'event', date: '2026-10-08', time: '14:00', ...more });

  it('시각이 지났고 1시간 안인 것만, 시각 차례로', () => {
    const got = dueAlarms(
      [ev('late', { time: '14:20' }), ev('early', { time: '14:00' }), ev('future', { time: '14:31' }), ev('old', { time: '13:30' }), ev('edge', { time: '13:31' })],
      now,
    );
    expect(got.map((e) => e.id)).toEqual(['edge', 'early', 'late']);
  });

  it('끝냄·울림·지움·이 탭에서 울린 것·기록·시각 없음은 빼고, 어제 밤 알림도 1시간 안이면 울린다', () => {
    const items = [
      ev('done', { done: true }),
      ev('rung', { alarmDone: true }),
      ev('del', { deletedAt: 1 }),
      ev('here'),
      ev('note', { kind: 'note' }),
      ev('none', { time: undefined }),
      ev('ok'),
    ];
    expect(dueAlarms(items, now, new Set(['here'])).map((e) => e.id)).toEqual(['ok']);
    const midnight = new Date(2026, 9, 9, 0, 10).getTime();
    expect(dueAlarms([ev('night', { time: '23:50' })], midnight).map((e) => e.id)).toEqual(['night']);
  });

  it('alarmAt - 이 기기 시각', () => {
    expect(alarmAt('2026-10-08', '14:00')).toBe(new Date(2026, 9, 8, 14, 0).getTime());
    expect(alarmAt('2026-10-08', 'xx')).toBeNaN();
  });
});

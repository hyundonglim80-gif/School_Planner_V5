import { describe, expect, it } from 'vitest';
import { pickAttendanceClass } from './attendanceClass';

const st = { sid: 'a', num: 1, name: '가', status: 'active' as const };
const classes = [
  { id: '2026-5-1', year: 2026, grade: 5, num: 1, students: [] },
  { id: '2026-5-2', year: 2026, grade: 5, num: 2, students: [st] },
  { id: '2025-4-3', year: 2025, grade: 4, num: 3, students: [st] },
];

describe('출석부 학급 고르기', () => {
  it('넘겨받은 학급 → 담임반 → 고른 학급 → 올해 학생이 있는 학급', () => {
    expect(pickAttendanceClass(classes, { classId: '2025-4-3', homeroom: '5-1', year: 2026 })?.id).toBe('2025-4-3');
    expect(pickAttendanceClass(classes, { homeroom: '5-1', remembered: '2025-4-3', year: 2026 })?.id).toBe('2026-5-1');
    expect(pickAttendanceClass(classes, { remembered: '2025-4-3', year: 2026 })?.id).toBe('2025-4-3');
    expect(pickAttendanceClass(classes, { year: 2026 })?.id).toBe('2026-5-2');
    expect(pickAttendanceClass(classes, { year: 2030 })?.id).toBe('2026-5-2');
    expect(pickAttendanceClass([], { year: 2026 })).toBeNull();
  });
});

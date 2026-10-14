import { describe, expect, it } from 'vitest';
import type { LessonCell, LessonDayView } from '../../domain/lessons';
import { hasLessons, lessonSubjects } from './lessonSubjects';

const cell = (n: number, subject: string): LessonCell => ({ n, subject, base: subject, changed: false, note: '', attachments: [], linkIds: [] });
const view = (...subjects: string[]): LessonDayView => ({ date: '2026-10-14', off: null, timetable: null, cells: subjects.map((s, i) => cell(i + 1, s)) });

describe('lessonSubjects (달력 수업 칩)', () => {
  it('교시 차례대로 과목 - 빈 칸과 X(수업 없음)는 빈 글', () => {
    expect(lessonSubjects(view('국어', '', ' 수학 ', 'x', 'X', '5-2 과학'))).toEqual(['국어', '', '수학', '', '', '5-2 과학']);
  });

  it('수업 칸이 없거나 모두 비면 그리지 않는다', () => {
    expect(lessonSubjects(undefined)).toEqual([]);
    expect(hasLessons(lessonSubjects(view('', 'X')))).toBe(false);
    expect(hasLessons(lessonSubjects(view('', '체육')))).toBe(true);
    expect(hasLessons(undefined)).toBe(false);
  });
});

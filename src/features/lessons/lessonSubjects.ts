// 달력(월간·년간)에 그릴 그날 수업 - 교시마다 과목 (features/lessons/CalendarLessons가 그린다). 'X'는 수업 없음(V4 그대로).
import type { LessonDayView } from '../../domain/lessons';

/** 교시 차례의 과목 ('' = 그 교시 수업 없음) */
export type LessonSubjects = readonly string[];

/** 그날 교시마다 보일 과목 - 'X'·빈 칸은 '' */
export function lessonSubjects(view: LessonDayView | undefined): LessonSubjects {
  return (view?.cells ?? []).map((c) => {
    const s = c.subject.trim();
    return s && s.toUpperCase() !== 'X' ? s : '';
  });
}

export const hasLessons = (subjects: LessonSubjects | undefined) => !!subjects?.some(Boolean);

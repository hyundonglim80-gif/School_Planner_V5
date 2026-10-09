// '같은 과정의 다른 반에도 만들기'(V4 S8): 이 교시가 과정(여러 반) 진도의 차시면, 같은 차시를 하는 다른 반의 첫 교시.
//   셈은 domain/progress(courseTimelines·planCourseEvals), 세는 입력은 계산한 수업 칸(개인 공간 - 진도는 개인 공간에만).
import { useMemo } from 'react';
import { courseTimelines, planCourseEvals, schoolYearEnd, slotId, type CourseEvalTarget } from '../../domain/progress';
import { usePersonalSpaceId } from '../../data/session';
import { cachedSubjects, offDayOf, useLessonSource } from '../lessons/useLessons';
import { useProgressMarks } from '../progress/useProgress';

const NONE: { targets: CourseEvalTarget[]; index: number | null } = { targets: [], index: null };

/** enabled = 교과 모드에서 교시를 고른 새 조사표 */
export function useCourseEvalTargets(date: string, period: number | null, enabled: boolean): { targets: CourseEvalTarget[]; index: number | null } {
  const { marks, plans } = useProgressMarks(enabled && period ? date : '');
  const src = useLessonSource(usePersonalSpaceId());
  const mark = enabled && period ? marks[slotId(date, period)] : undefined;
  const plan = mark?.cls ? plans.find((p) => p.id === mark.planId) : undefined;
  return useMemo(() => {
    if (!mark || !plan) return NONE;
    const timelines = courseTimelines(plan, plans, cachedSubjects(src, plan.startDate, schoolYearEnd(plan.startDate)), offDayOf(src));
    return { targets: planCourseEvals(mark, plan, timelines), index: mark.index };
  }, [mark, plan, plans, src]);
}

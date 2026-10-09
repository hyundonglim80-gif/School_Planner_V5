// 진도를 화면에 잇는다 (V4 hooks/useProgress.ts). 진도·수업은 개인 공간 - 그룹 공간을 보고 있을 때는 수업 칸에 겹치지 않는다(V4 그대로).
//   useProgressPlans: progress 문서(사본) → 고쳐 읽은 진도 목록
//   useProgressMarks: 하루·주간 수업 칸에 겹쳐 보일 교시별 진도 (slotId → 진도)
// 세는 입력은 계산한 수업 칸(domain/lessons subjectsBetween) - V4처럼 수업·일정 문서를 범위로 다시 읽지 않는다.
import { useMemo } from 'react';
import { schoolYearEnd, progressMarks, sanitizePlan, type ProgressMark, type ProgressPlan } from '../../domain/progress';
import { isLive, useDocs, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId, usePersonalSpaceId } from '../../data/session';
import { cachedSubjects, offDayOf, useLessonSource } from '../lessons/useLessons';

const isDay = (s: string) => /^(20\d\d)-\d\d-\d\d$/.test(s);
const NO_MARKS: Record<string, ProgressMark> = {};

/** 진도 목록 (칸 글자·시작일 차례). loaded = 사본을 서버와 맞췄다 */
export function useProgressPlans(): { plans: ProgressPlan[]; loaded: boolean; sid: string | null } {
  const sid = usePersonalSpaceId();
  const docs = useDocs('progress', sid);
  const status = useMirrorStatus('progress', sid);
  const plans = useMemo(
    () =>
      Object.values(docs)
        .filter(isLive)
        .map((d) => sanitizePlan(d.id, d))
        .sort((a, b) => a.key.localeCompare(b.key, 'ko') || a.startDate.localeCompare(b.startDate)),
    [docs],
  );
  return { plans, loaded: status === 'live' || plans.length > 0, sid };
}

/**
 * 하루·주간 수업 칸에 겹쳐 보일 진도. viewDate = 화면에 보이는 마지막 날.
 * 세는 범위는 가장 이른 진도 시작일 ~ 보는 날이 든 학년도 끝(날짜를 넘길 때마다 다시 세지 않게 학년도 끝으로 묶는다).
 */
export function useProgressMarks(viewDate: string): { marks: Record<string, ProgressMark>; plans: ProgressPlan[] } {
  const { plans, sid } = useProgressPlans();
  const current = useCurrentSpaceId();
  const src = useLessonSource(sid);
  const inPersonal = !!sid && current === sid;
  const active = useMemo(() => (inPersonal ? plans.filter((p) => p.key && isDay(p.startDate) && p.lessons.length > 0) : []), [plans, inPersonal]);
  const from = active.reduce((min, p) => (!min || p.startDate < min ? p.startDate : min), '');
  const to = isDay(viewDate) ? schoolYearEnd(viewDate) : '';
  const marks = useMemo(() => {
    if (!from || !to || from > to) return NO_MARKS;
    return progressMarks(active, cachedSubjects(src, from, to), offDayOf(src));
  }, [active, from, to, src]);
  return { marks, plans };
}

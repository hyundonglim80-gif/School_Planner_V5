// 수업 칸 읽기 (DESIGN 5-2) - 기기 사본(시간표·lessonDays·일정·라벨)과 설정(교시·방학)·공휴일로 domain/lessons를 셈한다.
// 하루·주간·링크·검색이 함께 쓴다. 공간은 지금 공간(시간표·수업 칸은 공간마다), 교시·방학은 계정에 하나.
import { useMemo } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { labelProps } from '../../domain/labels';
import { lessonsOn, type LessonDayView, type LessonSource, type TimetableLike } from '../../domain/lessons';
import { isHoliday, useHolidayStore } from '../../data/holidays';
import { isLive, itemsOn, useDocs, useLabelTree } from '../../data/select';

export function useLessonSource(sid?: string | null): LessonSource {
  const timetableDocs = useDocs('timetables', sid);
  const days = useDocs('lessonDays', sid);
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const periods = useCommonSettings((s) => s.periods);
  const terms = useCommonSettings((s) => s.terms);
  // 공휴일 표가 들어오면 다시 셈한다
  const holidays = useHolidayStore((s) => s.version);
  return useMemo(() => {
    void holidays;
    const timetables: TimetableLike[] = Object.values(timetableDocs)
      .filter(isLive)
      .map((t) => ({ id: t.id, name: t.name, from: t.from, to: t.to, grid: t.grid ?? {}, createdAt: t.createdAt }));
    return {
      timetables,
      days,
      count: periods.length,
      terms,
      isHoliday,
      eventsOn: (date: string) => itemsOn(items, date, 'event'),
      labels: new Map(tree.list.map((l) => [l.id, labelProps(l.props).skip])),
    };
  }, [timetableDocs, days, items, tree, periods, terms, holidays]);
}

/** 그날 수업 칸 */
export function useLessonsOn(date: string, sid?: string | null): LessonDayView {
  const src = useLessonSource(sid);
  return useMemo(() => lessonsOn(date, src), [date, src]);
}

/** 여러 날 (주간) - 날짜 → 그날 수업 칸 */
export function useLessonsFor(dates: readonly string[], sid?: string | null): Record<string, LessonDayView> {
  const src = useLessonSource(sid);
  const key = dates.join(',');
  return useMemo(() => {
    const out: Record<string, LessonDayView> = {};
    for (const d of key ? key.split(',') : []) out[d] = lessonsOn(d, src);
    return out;
  }, [key, src]);
}

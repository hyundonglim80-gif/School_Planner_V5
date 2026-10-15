// 하루 '메모' 칸에 보일 메모 (P10-4 2f·6c) - 그 날짜 링크 메모 + 그날 일정·수업 칸·그날 하는 진도 차시에 이은 메모 (features/notes/dayNotes - 계산).
// 하루 메모 칸·그날 메모 창(주간·월간·년간 📝 n)이 함께 쓴다.
import { useMemo } from 'react';
import { useDocs, useItemsOn } from '../../data/select';
import type { YMD } from '../../data/types';
import { useCarried } from '../events/forward';
import { useLessonsOn } from '../lessons/useLessons';
import { useProgressMarks } from '../progress/useProgress';
import { slotId } from '../../domain/progress';
import { dayNoteSources, type DayNote } from '../notes/dayNotes';

export function useDayNotes(date: YMD, sid: string | null | undefined): DayNote[] {
  const items = useDocs('items', sid);
  const dated = useItemsOn(date, 'note', sid);
  const events = useItemsOn(date, 'event', sid);
  const carried = useCarried(sid);
  // 오늘 칸이면 오늘로 따라오는 일정도 (일정 칸과 같게)
  const follow = date === carried.today ? carried.list : null;
  const lessons = useLessonsOn(date, sid).cells;
  // 그날 교시마다 하는 진도 차시 (개인 공간을 볼 때만 - 진도는 개인 공간 수업으로 센다)
  const { marks } = useProgressMarks(date);
  const progress = useMemo(
    () =>
      lessons.flatMap((c) => {
        const m = marks[slotId(date, c.n)];
        if (!m || m.index === null || !m.lesson?.linkIds?.length) return [];
        return [{ n: c.n, planId: m.planId, title: `${m.key} ${m.index + 1}차시`, linkIds: m.lesson.linkIds }];
      }),
    [lessons, marks, date],
  );
  return useMemo(
    () =>
      dayNoteSources({
        dated,
        events: follow ? [...events, ...follow] : events,
        lessons,
        progress,
        byId: (id) => items[id],
      }),
    [dated, events, follow, lessons, progress, items],
  );
}

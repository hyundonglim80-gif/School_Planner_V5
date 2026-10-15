// 하루 '메모' 칸에 보일 메모 (P10-4 2f) - 그 날짜 링크 메모 + 그날 일정·수업 칸에 이은 메모 (features/notes/dayNotes - 계산).
// 하루 메모 칸·그날 메모 창(주간·월간·년간 📝 n)이 함께 쓴다.
import { useMemo } from 'react';
import { useDocs, useItemsOn } from '../../data/select';
import type { YMD } from '../../data/types';
import { useCarried } from '../events/forward';
import { useLessonsOn } from '../lessons/useLessons';
import { dayNoteSources, type DayNote } from '../notes/dayNotes';

export function useDayNotes(date: YMD, sid: string | null | undefined): DayNote[] {
  const items = useDocs('items', sid);
  const dated = useItemsOn(date, 'note', sid);
  const events = useItemsOn(date, 'event', sid);
  const carried = useCarried(sid);
  // 오늘 칸이면 오늘로 따라오는 일정도 (일정 칸과 같게)
  const follow = date === carried.today ? carried.list : null;
  const lessons = useLessonsOn(date, sid).cells;
  return useMemo(
    () =>
      dayNoteSources({
        dated,
        events: follow ? [...events, ...follow] : events,
        lessons,
        byId: (id) => items[id],
      }),
    [dated, events, follow, lessons, items],
  );
}

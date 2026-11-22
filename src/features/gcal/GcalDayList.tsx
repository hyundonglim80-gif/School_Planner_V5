// 하루 칸 일정 맨 뒤의 구글 캘린더 일정 (P36-4 · P55-1 첫 화면 JS - DayEvents에서 뗐다).
//   고른 캘린더의 일정이 그날 있을 때만 받는다(DayEvents가 lazy로) - 차례는 gcalListOn(그날 시각 없는 것 먼저).
import { useMemo } from 'react';
import { gcalKey, gcalListOn, type GcalShown } from '../../domain/gcalShow';
import { GcalDayCard, GcalGroupHeader } from './GcalItems';

export default function GcalDayList({ list, date }: { list: readonly GcalShown[]; date: string }) {
  const today = useMemo(() => gcalListOn(list, date), [list, date]);
  if (!today.length) return null;
  return (
    <>
      <GcalGroupHeader count={today.length} />
      {today.map((g) => (
        <GcalDayCard key={gcalKey(g)} s={g} date={date} />
      ))}
    </>
  );
}

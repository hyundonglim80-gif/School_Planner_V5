// 기록 칸의 '📢 알림장'·'📋 출결' 카드 고르기 (DESIGN 5-4 - 계산, domain/dayCards). 그리는 것은 DayCards.tsx. 누르면 원본 칸(알림장·출석부)이 열린다.
//   알림장은 보는 공간의 것, 출결은 개인 공간을 볼 때만(출석부는 개인 공간에만 있다 - 학생 개인정보).
//   검색 창도 같은 카드를 찾는다(useAllDayCards).
import { useMemo } from 'react';
import { useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { attendanceCard, noticeCard, type DayCard } from '../../domain/dayCards';
import { openAttendance } from '../attendance/open';
import { useClasses } from '../class/classes';
import { openNotices } from '../notices/open';

/** 그 공간의 모든 카드 (날짜 차례 아님 - 찾는 쪽이 고른다) */
export function useAllDayCards(sid: string | null): DayCard[] {
  const personal = usePersonalSpaceId();
  const notices = useDocs('notices', sid ?? '');
  const attendance = useDocs('attendance', sid && sid === personal ? personal : '');
  const { classes } = useClasses();
  return useMemo(
    () => [
      ...Object.values(notices).map((d) => noticeCard(d.id, d.lines)),
      ...Object.values(attendance).map((d) => attendanceCard(d, classes)),
    ].filter((c): c is DayCard => c !== null),
    [notices, attendance, classes],
  );
}

/** 그날 카드 - 알림장 먼저, 출결은 학급 차례 */
export function useDayCardsOn(date: string, sid: string | null): DayCard[] {
  const all = useAllDayCards(sid);
  return useMemo(() => all.filter((c) => c.date === date).sort((a, b) => (a.kind === b.kind ? a.key.localeCompare(b.key) : a.kind === 'notice' ? -1 : 1)), [all, date]);
}

/** 원본 칸 열기 */
export function openDayCard(card: DayCard, sid: string | null) {
  if (card.kind === 'notice') {
    if (sid) openNotices({ sid, date: card.date });
  }
  else openAttendance({ date: card.date, classId: card.classId });
}

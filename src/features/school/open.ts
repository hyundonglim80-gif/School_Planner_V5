// 그날 학사일정 창 'schoolEvent' = { date, items } (V4 SchoolEventModal) - 날짜 칸의 학사일정 이름·하루 '📚 학사' 줄에서 연다.
import { openWindow } from '../../app/windows';
import type { NeisScheduleItem } from '../../data/neis';

export const SCHOOL_EVENT_WINDOW = 'schoolEvent';

export interface SchoolEventParams {
  date: string;
  items: NeisScheduleItem[];
}

export function openSchoolEvent(date: string, items: NeisScheduleItem[]) {
  openWindow(SCHOOL_EVENT_WINDOW, { date, items } satisfies SchoolEventParams);
}

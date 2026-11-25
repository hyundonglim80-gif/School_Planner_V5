// 하루 수업·일정 칸 보기 - 카드 / 목록(한 줄에 하나) (11-25 메모 요청 #204 '수업과 일정도 메모와 같이 카드형식과 목록형식을 선택').
// 칸 머리 ☰/▦ 단추(DayViewToggle - 메모 화면 머리줄 단추와 같은 꼴)로 바꾸고, 칸마다 이 기기에 기억한다(메모 화면 memoView와 같게).
// 하루 화면과 한눈에 화면의 하루 칸이 같은 값을 쓴다(같은 부품). 목록 = 카드의 첫 줄만 한 줄로 - 누르기·완료 칩·▲▼·끌기는 카드와 같다.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DayView = 'card' | 'list';
/** 칸 이름 - 일정 칸(DayEvents) · 수업 칸(DayLessons) */
export type DayViewPane = 'events' | 'lessons';

export const useDayView = create<Record<DayViewPane, DayView>>()(
  persist((): Record<DayViewPane, DayView> => ({ events: 'card', lessons: 'card' }), { name: 'sp5-day-view' }),
);

export const toggleDayView = (pane: DayViewPane) => useDayView.setState((s) => ({ [pane]: s[pane] === 'card' ? 'list' : 'card' }));

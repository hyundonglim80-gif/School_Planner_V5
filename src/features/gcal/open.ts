// 구글 캘린더 일정 창 'gcalEvent' = { date, shown } (P36-4) - 겹쳐 그린 구글 일정을 누르면 연다(읽기 전용).
//   창 값에 그 일정을 담는다 - 창이 받은 자료를 다시 찾지 않는다(학사일정 창 본보기). 오른쪽 칸 하나(side - 다른 것을 누르면 그것으로 바뀐다).
//   ⚠️ 창 목록(app/windowList)이 부르는 파일이라 data/session·select를 부르지 않는다(CLAUDE.md 2장).
import { openWindow } from '../../app/windows';
import type { GcalShown } from '../../domain/gcalShow';

export const GCAL_EVENT_WINDOW = 'gcalEvent';

export interface GcalEventParams {
  /** 누른 날 (일정으로 담기의 날짜) */
  date: string;
  shown: GcalShown;
}

export function openGcalEvent(shown: GcalShown, date: string) {
  openWindow(GCAL_EVENT_WINDOW, { date, shown } satisfies GcalEventParams);
}

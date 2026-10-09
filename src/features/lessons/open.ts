// 수업 수정 칸 열기 (V4 DetailEditModal의 수업 갈래 'N교시 수정') - 주간 수업 줄·링크 보기·검색에서. 창 목록의 쓰는 칸 'lesson'.
// 하루 화면은 카드 자리에서 바로 고친다(DayLessons). 같은 날·교시면 그 탭을 보인다.
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';

export const LESSON_PANEL = 'lesson';

export interface LessonPanelParams {
  /** 칸을 연 순간의 공간 - 저장은 여기에 */
  sid: string;
  date: string;
  /** 교시 */
  n: number;
}

export const sameLessonPanel = (a: LessonPanelParams, b: LessonPanelParams) => a.sid === b.sid && a.date === b.date && a.n === b.n;

export function openLessonPanel(params: LessonPanelParams) {
  if (!getWindowDef(LESSON_PANEL)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(LESSON_PANEL, params);
}

// 진도 관리 창 열기 (V4 store setProgressModalOpen). 창 'progress' = { planId?, cls?, preset?, course? }
//   - ⋮ 수업 · 하루 수업 머리줄 📘 · 단축키 '진도 관리' = 그냥 열기(첫 진도)
//   - 수업 칸의 진도 줄 = 그 진도(과정이면 그 반 탭) · '📘 진도 만들기' = 그 칸 글자로 채운 새 진도(preset)
//   - 단축키 '진도 만들기 (여러 반)' = 새 과정(course)
// 열린 창을 다른 것으로 다시 열면 그리로 옮긴다(고치던 것이 있으면 묻는다).
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';

export const PROGRESS_WINDOW = 'progress';

export interface ProgressWindowParams {
  /** 그 진도로 */
  planId?: string;
  /** 과정이면 그 반 탭 '5-2' */
  cls?: string;
  /** 이 칸 글자로 채운 새 진도 ('📘 진도 만들기') */
  preset?: string;
  /** 새 과정 (교과 모드 - 과목 + 반) */
  course?: boolean;
  /** 같은 것으로 다시 열어도 다시 옮기게 (부른 때) */
  at?: number;
}

export function openProgress(params: Omit<ProgressWindowParams, 'at'> = {}) {
  if (!getWindowDef(PROGRESS_WINDOW)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(PROGRESS_WINDOW, { ...params, at: Date.now() });
}

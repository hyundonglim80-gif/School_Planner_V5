// 조사표 창 열기 (V4 EvaluationModal - openEvaluationModal). 창 'evaluation' = { sid, date, place?, slot?, evalId?, at? }.
//   place = 그 자리 하나('3' 교시 / 'journal' 기록 칸) - 하루 수업 칸의 📊n·기록 칸 머리 📊. 없으면 그날 전체(주간·월간·년간 📊 n).
//   slot = 그 교시 칸 글자('5-2 과학' / '과학') - 새로 만들 때 학급·교과를 골라 둔다. evalId = 곧바로 그 조사표(모아 보기·학생 기록·검색).
//   같은 공간·날·자리면 그 탭을 보이고(다시 고르기), 다른 자리는 탭이 따로 선다.
import { showToast } from '../../app/toast';
import { getWindowDef, openWindow } from '../../app/windows';

export const EVAL_WINDOW = 'evaluation';

export interface EvaluationParams {
  sid: string;
  date: string;
  place?: string;
  slot?: string;
  evalId?: string;
  /** 연 때 - 다시 열면 고르기를 처음부터 */
  at?: number;
}

export const sameEvalWindow = (a: EvaluationParams, b: EvaluationParams) => a.sid === b.sid && a.date === b.date && (a.place ?? '') === (b.place ?? '');

export function openEvaluation(params: Omit<EvaluationParams, 'at'>) {
  if (!getWindowDef(EVAL_WINDOW)) return showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
  openWindow(EVAL_WINDOW, { ...params, at: Date.now() });
}

// 자리표 열기 (V4 SeatingModal) - 창 'seating' = { classId?, draw?, at? } (창 id = 단축키 id '자리표').
//   ⋮ 없음 - 학급 화면 도구 카드 🪑·🎯, 하루 수업 머리줄 🎯 뽑기(담임), 교과 모드 교시 카드의 반 도구(🪑 자리표·🎯 뽑기), 단축키 '자리표'·'발표자 뽑기 (자리표)'.
//   draw = 🎯 발표자 뽑기 칸을 펴서 연다. 이미 열려 있으면 그 탭을 보이고 학급·뽑기 칸을 바꾼다(at이 바뀌면 다시 본다).
//   학급을 주지 않으면 학급 화면에서 고른 학급(이 기기) → 올해 학급.
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { showToast } from '../../app/toast';
import { getWindowDef, openWindow } from '../../app/windows';

export const SEATING_WINDOW = 'seating';

export interface SeatingParams {
  classId?: string;
  /** 🎯 발표자 뽑기 칸을 편다 */
  draw?: boolean;
  /** 연 때 - 다시 열면 학급·뽑기 칸을 다시 맞춘다 */
  at?: number;
}

export function openSeating(params: Omit<SeatingParams, 'at'> = {}) {
  if (!getWindowDef(SEATING_WINDOW)) return showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
  openWindow(SEATING_WINDOW, { ...params, at: Date.now() });
}

/** 껍데기에서 한 번 - 단축키 '자리표'·'발표자 뽑기 (자리표)' */
export function useSeatingShortcuts() {
  useEffect(() => {
    const a = setShortcutAction('seating', () => openSeating());
    const b = setShortcutAction('drawStudent', () => openSeating({ draw: true }));
    return () => {
      a();
      b();
    };
  }, []);
}

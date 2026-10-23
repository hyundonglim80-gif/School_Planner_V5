// ⋮ '🖨️ 이 화면 인쇄'·Ctrl+P (MENU 4장) = 인쇄 창(features/print/PrintWindow). 창은 보는 화면(하루·주간·월간·년간 - 메모·학급은 하루)과
// 보는 날로 열린다 - 거기서 화면·구간·용지 방향을 바꾸고 미리보기로 본 뒤 찍는다. 창 안의 인쇄(주간학습안내 등)는 그 창에 그대로.
import { useEffect } from 'react';
import { printPageOfScope } from '../domain/printPages';
import type { PrintParams } from '../features/print/types';
import { setShortcutAction } from './keys';
import { useNav } from './nav';
import { openWindow } from './windows';

/** 인쇄 창을 지금 화면·날짜로 연다 (열려 있으면 그것으로 바꾼다) */
export function openPrintWindow() {
  const { scope, date } = useNav.getState();
  const params: PrintParams = { page: printPageOfScope(scope), date, scope };
  openWindow('print', params);
}

/** 껍데기에서 한 번 - 단축키 '이 화면 인쇄'(Ctrl+P)와 ⋮ 항목 */
export function usePrintShortcut() {
  useEffect(() => setShortcutAction('print', openPrintWindow), []);
}

// ⋮ '🖨️ 이 화면 인쇄'·Ctrl+P (MENU 4장 - V4 주간·년간 머리의 🖨️ 단추를 옮김). 인쇄할 수 있는 화면(주간 = 이번 주 A4 가로, 년간 = 학사력)이
// 찍을 칸을 걸어 둔다. 걸린 것이 없으면(다른 화면·년간 자세히) 브라우저 인쇄. 창 안의 인쇄(주간학습안내 등)는 그 창에 그대로.
import { useEffect, useRef } from 'react';
import { printNode, type PrintOptions } from '../ui/print';
import { setShortcutAction } from './keys';

export type PrintTarget = () => { node: HTMLElement | null; opts: PrintOptions };

let current: { get: () => PrintTarget | null } | null = null;

/** 이 화면을 찍는 법을 건다 (null = 이 화면은 찍지 않는다). 화면이 사라지면 풀린다 */
export function usePrintTarget(target: PrintTarget | null) {
  const ref = useRef(target);
  useEffect(() => {
    ref.current = target;
  });
  const on = target !== null;
  useEffect(() => {
    if (!on) return;
    const me = { get: () => ref.current };
    current = me;
    return () => {
      if (current === me) current = null;
    };
  }, [on]);
}

/** 지금 화면을 찍는다 */
export function printScreen() {
  const made = current?.get()?.();
  if (made?.node) printNode(made.node, made.opts);
  else window.print();
}

/** 껍데기에서 한 번 - 단축키 '이 화면 인쇄'(Ctrl+P)와 ⋮ 항목 */
export function usePrintShortcut() {
  useEffect(() => setShortcutAction('print', printScreen), []);
}

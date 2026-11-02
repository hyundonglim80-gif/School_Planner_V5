// 길게 누르기 (손가락만 - 0.5초, 10px 넘게 움직이면 그만). 일정 카드 여러 개 고르기(day/DayEvents)·공간 칩 겹쳐 보기(app/SpaceChips)가 함께 쓴다.
// 길게 눌러 일을 한 뒤 손을 떼면 click이 한 번 더 온다 - onClick 맨 앞에서 consumed()로 넘긴다. 길게 누르기에 뜨는 휴대폰 메뉴(contextmenu)도 막는다.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

export const LONG_PRESS_MS = 500;

export function useLongPress(onLong: () => void) {
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({ timer: null, x: 0, y: 0, fired: false });
  const latest = useRef(onLong);
  useEffect(() => {
    latest.current = onLong;
  });
  useEffect(
    () => () => {
      if (press.current.timer) clearTimeout(press.current.timer);
    },
    [],
  );
  const cancel = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };
  return {
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.pointerType !== 'touch') return;
        cancel();
        press.current = {
          x: e.clientX,
          y: e.clientY,
          fired: false,
          timer: setTimeout(() => {
            press.current.fired = true;
            press.current.timer = null;
            latest.current();
          }, LONG_PRESS_MS),
        };
      },
      onPointerMove: (e: ReactPointerEvent) => {
        if (press.current.timer && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: ReactMouseEvent) => {
        if (press.current.fired) e.preventDefault();
      },
    },
    /** 방금 끝난 것이 길게 누르기였나 - 그렇다면 표시를 지우고 true (click에서 그 click을 넘긴다) */
    consumed: (): boolean => {
      if (!press.current.fired) return false;
      press.current.fired = false;
      return true;
    },
  };
}

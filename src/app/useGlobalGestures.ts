// 손짓으로 화면·날짜 옮기기 (V4 hooks/useGlobalGestures.ts). 환경설정 '스크롤 페이지 이동'(enableScrollNav)을 켰을 때만.
//   옆으로 밀기       → 이전·다음 화면 (하루 ↔ 주간 ↔ … ↔ 학급, 끝에서 돈다)
//   맨 위·맨 아래에서 더 당기기·굴리기 → 이전·다음 날짜 (메모·학급은 날짜가 없어 빼고)
import { useEffect, useRef } from 'react';
import { isAnyLayerOpen } from './history';
import { stepDate, stepScope, useNav } from './nav';
import { isDatelessScope } from './route';

/** 창이 떠 있으면 손짓은 그 창의 것이다 */
const isWindowOpen = () => isAnyLayerOpen() || !!document.querySelector('[role="dialog"]');

const pageMetrics = (edge: number) => {
  const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const bottom = Math.ceil(window.innerHeight + window.scrollY);
  return { atTop: window.scrollY <= edge, atBottom: bottom >= scrollHeight - edge };
};

export function useGlobalGestures() {
  const start = useRef({ x: 0, y: 0, atTop: false, atBottom: false });
  const blockWheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navLock = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 한 번 옮긴 뒤 잠시는 다시 옮기지 않는다 (굴리기 한 번에 여러 날이 넘어가지 않게)
    const lockNav = () => {
      if (navLock.current) clearTimeout(navLock.current);
      navLock.current = setTimeout(() => {
        navLock.current = null;
      }, 800);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isWindowOpen()) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ...pageMetrics(50) };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isWindowOpen() || navLock.current) return;
      const s = useNav.getState();
      if (!s.enableScrollNav) return;
      const deltaX = start.current.x - e.changedTouches[0].clientX;
      const deltaY = start.current.y - e.changedTouches[0].clientY;

      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (Math.abs(deltaX) > 50) stepScope(deltaX > 0 ? 1 : -1);
        return;
      }
      if (isDatelessScope(s.scope)) return;
      const { atTop, atBottom } = pageMetrics(50);
      if (atBottom && deltaY > 50 && start.current.atBottom) {
        stepDate(1);
        lockNav();
      } else if (atTop && deltaY < -50 && start.current.atTop) {
        stepDate(-1);
        lockNav();
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (isWindowOpen() || navLock.current) return;
      const s = useNav.getState();
      if (!s.enableScrollNav || isDatelessScope(s.scope)) return;
      const { atTop, atBottom } = pageMetrics(10);
      // 굴리기를 시작한 자리가 끝이었을 때만 (굴려서 끝에 닿자마자 넘어가지 않게)
      if (!blockWheelTimer.current) {
        start.current.atTop = atTop;
        start.current.atBottom = atBottom;
      }
      if (blockWheelTimer.current) clearTimeout(blockWheelTimer.current);
      blockWheelTimer.current = setTimeout(() => {
        blockWheelTimer.current = null;
      }, 150);

      if (atBottom && e.deltaY > 0 && start.current.atBottom) {
        stepDate(1);
        lockNav();
      } else if (atTop && e.deltaY < 0 && start.current.atTop) {
        stepDate(-1);
        lockNav();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('wheel', onWheel);
      if (blockWheelTimer.current) clearTimeout(blockWheelTimer.current);
      if (navLock.current) clearTimeout(navLock.current);
    };
  }, []);
}

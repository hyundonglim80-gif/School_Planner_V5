// 새 창 안 분할 칸이 설 때 새 창 넓히기·되돌리기 (P43 11-17 사용자 요청 - app/PopoutShell이 쓴다, 셈은 ui/popout splitGrowth).
import { useCallback, useEffect, useRef } from 'react';
import { splitGrowth } from '../ui/popout';

/** 넓힌 크기를 사용자가 이만큼 넘게 바꿨으면 되돌리지 않는다 */
const RESIZED_PX = 24;
/** 분할 칸이 모두 닫힌 뒤 이만큼 기다렸다 되돌린다 - 그새 다시 서면(탭을 바꿔 열기·개발 StrictMode의 두 번 부르기) 그대로 */
const RESTORE_MS = 150;

interface SplitSize {
  /** 넓히기 전 자리·폭 */
  base: { x: number; w: number } | null;
  /** 넓힌 자리·폭 */
  target: { x: number; w: number } | null;
  timer: number;
}

/**
 * 분할 칸이 서면 새 창을 옆으로 넓히고(ui/popout splitGrowth - 그 화면 안에서 두 배까지), 모두 닫히면 넓힌 만큼 되돌린다 (P43).
 * 그 사이 사용자가 새 창 크기·자리를 바꿨으면 그대로 둔다. 브라우저가 막으면(최대화) 그대로 반씩 나눈다. 넓힌 동안인지 돌려준다.
 */
export function useSplitWindowSize(open: boolean): () => boolean {
  const st = useRef<SplitSize>({ base: null, target: null, timer: 0 });
  useEffect(() => {
    if (!open) return;
    const s = st.current;
    window.clearTimeout(s.timer);
    if (!s.target) {
      const scr = window.screen as Screen & { availLeft?: number };
      const g = splitGrowth({ x: window.screenX, width: window.outerWidth }, { left: scr.availLeft ?? 0, width: scr.availWidth });
      if (!g.dw) return;
      s.base = { x: window.screenX, w: window.outerWidth };
      s.target = { x: window.screenX + g.dx, w: window.outerWidth + g.dw };
      try {
        // 자리·폭을 정해서(늘리기가 아니라) - 두 번 불러도 한 번과 같다
        if (g.dx) window.moveTo(s.target.x, window.screenY);
        window.resizeTo(s.target.w, window.outerHeight);
      } catch {
        s.base = s.target = null;
        return;
      }
    }
    return () => {
      s.timer = window.setTimeout(() => {
        const { base, target } = s;
        s.base = s.target = null;
        if (!base || !target || Math.abs(window.outerWidth - target.w) > RESIZED_PX) return;
        try {
          window.resizeTo(base.w, window.outerHeight);
          if (Math.abs(window.screenX - target.x) <= RESIZED_PX) window.moveTo(base.x, window.screenY);
        } catch {
          // 되돌리지 못하면 넓은 채로 둔다
        }
      }, RESTORE_MS);
    };
  }, [open]);
  return useCallback(() => st.current.target !== null, []);
}

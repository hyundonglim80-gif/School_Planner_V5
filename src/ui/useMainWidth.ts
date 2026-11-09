import { createContext, useContext } from 'react';
import { DENSE_ATTR, DENSE_BASE_PERCENT } from '../domain/fontScale';

/**
 * 화면 본문(main)의 실제 폭.
 *
 * 오른쪽 메모·기록 칸이 열리면 본문이 그만큼 좁아진다. 그런데 창 폭(뷰포트)은
 * 그대로라, 창 폭으로 칸 수를 정하는 화면은 좁아진 본문에 넓은 배치를 밀어 넣는다.
 * 칸 수를 정할 때는 창 폭 대신 이 값을 본다. (CSS 쪽은 @container 로 같은 일을 한다)
 */
export const MainWidthContext = createContext<number>(typeof window !== 'undefined' ? window.innerWidth : 1280);

export function useMainWidth(): number {
  return useContext(MainWidthContext);
}

/** index.css의 PC 바탕(한눈에 90%)이 걸리는 화면인가 - 같은 미디어 쿼리 */
const PC_BASE_QUERY = 'screen and (min-width: 40rem)';

/**
 * 잰 폭(px) → 칸 수를 정하는 폭. PC 한눈에 화면은 글자 바탕이 90%라(11-08 사용자 요청 80% → 11-09 90% → 같은 날 한눈에만) 본문 최대 폭(rem)도 함께 줄어,
 * 한눈에 쌓기(780)·기록 열 수 같은 px 경계에 닿지 못했다 - 브라우저 확대 90%와 같게 바탕을 걷어 견준다. 다른 화면은 바탕 100%라 그대로.
 * 환경설정 '글자 크기' 단계는 걷지 않는다(전과 같다 - 휴대폰 경계가 그대로).
 */
export function unscaledWidth(px: number): number {
  if (typeof document === 'undefined' || !document.documentElement.hasAttribute(DENSE_ATTR)) return px;
  const pc = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PC_BASE_QUERY).matches;
  return pc ? px / (DENSE_BASE_PERCENT / 100) : px;
}

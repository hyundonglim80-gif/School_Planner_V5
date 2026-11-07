import { useEffect, useState, type RefObject } from 'react';

/**
 * 요소의 안쪽 폭(px - @container가 재는 폭). bucket을 주면 그 값이 바뀔 때만 다시 그린다
 * (한눈에 화면 - 경계선을 끄는 동안 칸 안 부품이 픽셀마다 다시 그려지지 않게, P24).
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, bucket: (w: number) => unknown = (w) => w, initial = 0): number {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last: { w: number; key: unknown } | null = null;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
      const key = bucket(w);
      if (last && Object.is(last.key, key)) return;
      last = { w, key };
      setWidth(w);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
    // bucket은 그릴 때마다 새 함수일 수 있다 - 처음 것으로 잰다(경계가 바뀌지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
  return width;
}

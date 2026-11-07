import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * 화면 높이에 맞춘 높이(px) - 창 높이 − 이 요소의 위끝 − 본문 아래 여백 (P24 한눈에 - 위아래 경계선은 높이가 정해져야 한다).
 * 위끝은 머리줄·띠(가져오기·백업·새 판 등)에 따라 달라지므로 머리줄과 본문 크기가 바뀔 때마다 다시 잰다.
 * 너무 낮은 창에서는 min - 그때는 화면이 스크롤한다. on이 아니면(쌓은 모양) null.
 */
export function useFitHeight(ref: RefObject<HTMLElement | null>, on: boolean, min = 420): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) {
      setHeight(null);
      return;
    }
    const main = el.closest('main');
    const measure = () => {
      const pad = main ? parseFloat(getComputedStyle(main).paddingBottom || '0') : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const next = Math.max(min, Math.floor(window.innerHeight - top - pad));
      setHeight((prev) => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const header = document.querySelector('header');
    if (header) ro?.observe(header);
    if (main) ro?.observe(main);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [ref, on, min]);
  return height;
}

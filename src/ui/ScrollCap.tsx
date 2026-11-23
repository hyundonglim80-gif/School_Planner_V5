// 높이를 정해 두고 넘치면 그 안에서 스크롤하는 상자 (11-23 사용자 요청 - 펼친 메모가 한없이 길어지지 않게).
//   아래로 더 있으면 아래 끝을 흐리게 한다 - 휴대폰은 스크롤바가 보이지 않아 더 있는지 모른다(끝까지 내리면 흐림이 걷힌다).
//   글·그림이 늦게 뜨거나 바뀌면(ResizeObserver) 다시 잰다. 상자 `[data-scroll-cap]`, 더 있으면 `data-scroll-more="1"`.
//   이 상자 안 휠·밀기는 날짜를 넘기지 않는다(app/useGlobalGestures). 상자는 양옆으로 2px 내민다 - 체크 줄 바탕(-mx-0.5)이 가로로 잘리지 않게(P57-2 ■4).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** 펼친 메모 본문의 가장 큰 높이 - 그림 두 장 + 글 몇 줄 (28rem), 낮은 화면은 화면 높이의 65% */
export const ENTRY_SCROLL_MAX = 'max-h-[min(28rem,65vh)]';

const FADE = 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)';

interface Props {
  children: ReactNode;
  /** 높이(max-h-…)·안쪽 배치 */
  className?: string;
  /** 상자에 붙일 data-* */
  data?: Record<string, string>;
}

export default function ScrollCap({ children, className = '', data }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setMore(box.scrollTop + box.clientHeight < box.scrollHeight - 1);
    measure();
    box.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(box);
    if (innerRef.current) ro?.observe(innerRef.current);
    return () => {
      box.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, []);

  return (
    <div
      ref={boxRef}
      data-scroll-cap
      data-scroll-more={more ? '1' : '0'}
      {...data}
      className={`overflow-y-auto min-w-0 -mx-0.5 px-0.5 ${className}`}
      style={more ? { maskImage: FADE, WebkitMaskImage: FADE } : undefined}
    >
      <div ref={innerRef} className="flex flex-col gap-2 min-w-0">
        {children}
      </div>
    </div>
  );
}

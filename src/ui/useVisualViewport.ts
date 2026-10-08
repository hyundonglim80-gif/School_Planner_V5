import { useEffect, useState } from 'react';

export interface VisibleRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function readRect(): VisibleRect {
  const vv = window.visualViewport;
  if (vv) {
    return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height };
  }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

// 지금 실제로 보이는 영역(visual viewport). 핀치 줌·패닝·화면 자판으로 보이는 영역이 바뀌면 position:fixed의 기준(레이아웃
// 뷰포트)과 어긋나, 100vh로 만든 창은 확대했을 때 대부분이 화면 밖으로 밀려났다(V4). 창을 이 영역에 맞추면 어떤 배율에서도 잘리지 않는다.
export function useVisualViewport(isActive: boolean): VisibleRect {
  const [rect, setRect] = useState<VisibleRect>(readRect);

  useEffect(() => {
    if (!isActive) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(readRect()));
    };

    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      cancelAnimationFrame(frame);
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isActive]);

  return rect;
}

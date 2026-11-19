// 창 칸(창·쓰는 칸·📋 클립보드 탭)의 경계선 (V4 components/ColumnResizer.tsx). 끌어서 폭을 바꾼다. side = 창 칸이 선 쪽(왼쪽 클립보드 칸은 P47-1에 없앴다).
//   - 바꾼 폭은 이 기기에 기억한다 (app/layoutPrefs).
//   - 두 번 누르면 초기화 값(내 '초기화 설정' → 관리자 → 기본 폭 - P33-2)으로 돌아간다.
//   - 반대쪽 화면이 320px은 남도록 묶는다.
// 넓은 화면에서 칸이 화면 옆에 붙어 있을 때만 껍데기가 그린다. 새 창 안 분할 칸(P43)은 onWidth로 그 새 창 안에서만 바꾼다(기억하지 않는다).
import { useRef } from 'react';
import { setRightPanelWidth } from '../app/layoutPrefs';
import { resetPanelWidth } from '../app/resetTargets';

const MIN_PX = 280;
const KEEP_MAIN_PX = 320;

export default function ColumnResizer({ side, width, onWidth }: { side: 'left' | 'right'; width: string; onWidth?: (px: number | null) => void }) {
  const setWidth = onWidth ?? setRightPanelWidth;
  const dragging = useRef(false);

  const widthAt = (clientX: number) => {
    const px = side === 'right' ? window.innerWidth - clientX : clientX;
    return Math.round(Math.max(MIN_PX, Math.min(px, window.innerWidth - KEEP_MAIN_PX)));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'right' ? '오른쪽 칸 폭 조절' : '왼쪽 칸 폭 조절'}
      title="끌어서 폭 조절 · 두 번 눌러 기본 폭"
      data-column-resizer={side}
      className="fixed top-0 bottom-0 z-[46] w-2 cursor-col-resize touch-none group"
      // 경계선을 가운데에 두고 양쪽으로 0.25rem씩 잡을 자리를 준다
      style={side === 'right' ? { right: `calc(${width} - 0.25rem)` } : { left: `calc(${width} - 0.25rem)` }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (dragging.current) setWidth(widthAt(e.clientX));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        document.body.style.userSelect = '';
      }}
      onDoubleClick={() => setWidth(onWidth ? null : resetPanelWidth(side))}
    >
      <div className="mx-auto h-full w-0.5 bg-transparent group-hover:bg-primary/60 transition-colors" />
    </div>
  );
}

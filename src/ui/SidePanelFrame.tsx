// 쓰는 칸(메모·기록·일정·알림장·출석부)의 바깥 틀 (V4 components/SidePanelFrame.tsx).
//
//   넓은 화면 : 화면 옆 오른쪽 줄에 붙는 칸. 팝업이 아니다 - 뒤 화면을 잠그지 않고, 팝업 층(배경 누르기로 모두 닫기)에도
//              들지 않는다. 뒤로가기는 받는다(useBackLayer). ESC는 껍데기가 오른쪽 줄 전체를 닫는다(저장 안 한 글은 먼저 묻는다).
//   좁은 화면 : 어두운 배경 위로 오른쪽에서 뜬다. 배경을 누르면 고친 것을 저장하고 닫는다(닫기·✕·ESC는 저장하지 않는다).
// 창 위치가 '가운데 창'이어도 쓰는 칸은 오른쪽에 붙는다(V4 그대로 - 글을 쓰며 왼쪽 화면을 본다).
import { useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useBackLayer, useModalLayer } from '../app/history';
import { getSideColumn, sideSlotProps, useDocked, useSideSlot } from './sideColumn';
import { useBackdropClose } from './useBackdropClose';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useSaveKey } from './useSaveKey';
import { useVisualViewport } from './useVisualViewport';

interface SidePanelFrameProps {
  /** 닫기 (저장 없이) */
  onClose: () => void;
  /** 배경을 눌렀을 때 (좁은 화면에서만). 고친 것을 저장하고 닫는다. */
  onBackdropClose: () => void;
  /** Ctrl+S - 커서가 든 칸, 없으면 보이는 탭 */
  onSave?: () => void;
  /** 칸 이름 (예: '기록 쓰기') - 탭 이름·화면 낭독기 */
  ariaLabel: string;
  /** 이미 열린 칸을 다시 열면 바뀐다 (창 목록의 raisedAt) */
  raise?: number;
  children: ReactNode;
}

export default function SidePanelFrame({ onClose, onBackdropClose, onSave, ariaLabel, raise, children }: SidePanelFrameProps) {
  const docked = useDocked();
  const panelRef = useRef<HTMLElement | null>(null);
  useSaveKey(true, panelRef, onSave);
  useBodyScrollLock(!docked);
  const vv = useVisualViewport(true);
  // 휴대폰(덮는 배너)에서도 다시 연 칸이 맨 앞으로 오게 층에 다시 선다
  const zIndex = useModalLayer(!docked, onClose, raise);
  // 옆에 붙은 칸은 팝업이 아니지만 휴대폰 뒤로가기는 칸을 닫아야 한다 (안 그러면 크롬이 닫힌다)
  useBackLayer(docked, onClose);
  const slot = useSideSlot(docked, raise);
  const backdrop = useBackdropClose(onBackdropClose);

  if (docked) {
    const { className, style, 'data-side-slot': slotId } = sideSlotProps(slot);
    return createPortal(
      <aside ref={panelRef} aria-label={ariaLabel} data-panel-frame="side" className={className} style={style} data-side-slot={slotId}>
        {children}
      </aside>,
      getSideColumn(),
    );
  }

  return (
    <div
      className="fixed inset-0 flex justify-end"
      style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height, zIndex }}
      data-panel-frame="banner"
    >
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300" {...backdrop} />
      <aside
        ref={panelRef as RefObject<HTMLElement>}
        aria-label={ariaLabel}
        className="relative bg-white h-full w-full max-w-lg shadow-2xl z-10 flex flex-col"
      >
        {children}
      </aside>
    </div>
  );
}

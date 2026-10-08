// 모든 창의 바깥 틀 (V4 components/PopupFrame.tsx). 환경설정 '창 위치'(popupStyle)에 따라 세 가지로 그린다.
//
//   side + 넓은 화면(768px 이상) : 쓰는 칸처럼 화면 오른쪽 줄에 선다(sideColumn). 뒤 화면을 어둡게 덮지 않고 스크롤도 잠그지 않는다.
//   side + 좁은 화면(휴대폰)      : 어두운 배경 위로 오른쪽에서 뜨는 배너.
//   center                       : 화면 가운데에 뜨는 창.
//
// 어느 모양이든 창 층(app/history의 useModalLayer)에 똑같이 든다. 그래서 겹쳐 연 창의 순서, ESC로 모두 닫기,
// 뒤로가기로 한 겹씩 닫기가 모양과 상관없이 그대로다.
import { useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalLayer } from '../app/history';
import { useLayoutPrefs } from '../app/layoutPrefs';
import { getSideColumn, sideSlotProps, useDocked, useSideSlot } from './sideColumn';
import { useBackdropClose } from './useBackdropClose';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useSaveKey } from './useSaveKey';
import { useVisualViewport } from './useVisualViewport';

export type ModalWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

const CENTER_WIDTH: Record<ModalWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

interface PopupFrameProps {
  isOpen: boolean;
  onClose: () => void;
  /** 바뀌면 보이는 탭이 된다 (이미 열린 창을 다시 열 때 - 창 목록이 넘겨준다) */
  raise?: number;
  /** 가운데 창의 폭. 오른쪽 칸·휴대폰 배너는 폭이 모두 같다. */
  width?: ModalWidth;
  /** 배경을 눌렀을 때 할 일. 주지 않으면 열린 창을 모두 닫는다. (옆에 붙은 칸에는 배경이 없다) */
  onBackdropClose?: () => void;
  /** 가운데 창의 판에 더할 class */
  cardClassName?: string;
  /** Ctrl+S로 할 저장 (ui/useSaveKey). 주지 않으면 글을 쓰던 입력칸이 든 <form>을 제출한다. */
  onSave?: () => void;
  /** 창 이름 (탭 이름·화면 낭독기) */
  ariaLabel?: string;
  children: ReactNode;
}

export default function PopupFrame({
  isOpen,
  onClose,
  width = 'md',
  onBackdropClose,
  cardClassName = '',
  onSave,
  raise,
  ariaLabel,
  children,
}: PopupFrameProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  useSaveKey(isOpen, cardRef, onSave);
  const side = useLayoutPrefs((s) => s.popupStyle) !== 'center';
  const wide = useDocked();
  const docked = isOpen && side && wide;

  // 옆에 붙은 칸은 왼쪽 화면과 함께 쓰므로 본문 스크롤을 잠그지 않는다
  useBodyScrollLock(isOpen && !docked);
  const vv = useVisualViewport(isOpen);
  const zIndex = useModalLayer(isOpen, onClose, raise);
  const backdrop = useBackdropClose(onBackdropClose);
  const slot = useSideSlot(docked, raise);

  if (!isOpen) return null;

  if (docked) {
    const { className, style, 'data-side-slot': slotId } = sideSlotProps(slot);
    return createPortal(
      <section
        ref={cardRef}
        role="dialog"
        aria-label={ariaLabel}
        data-popup-card
        data-popup-frame="side"
        data-side-slot={slotId}
        className={className}
        style={style}
      >
        {children}
      </section>,
      getSideColumn(),
    );
  }

  if (side) {
    return (
      <div
        className="fixed inset-0 flex justify-end"
        style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height, zIndex }}
        data-popup-frame="banner"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" {...backdrop} />
        <div
          ref={cardRef as RefObject<HTMLDivElement>}
          role="dialog"
          aria-label={ariaLabel}
          data-popup-card
          className="relative bg-white h-full w-full max-w-lg shadow-2xl flex flex-col overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 bg-slate-900/40 backdrop-blur-sm"
      style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height, zIndex }}
      data-popup-frame="center"
      {...backdrop}
    >
      <div
        ref={cardRef as RefObject<HTMLDivElement>}
        role="dialog"
        aria-label={ariaLabel}
        data-popup-card
        className={`bg-white w-full ${CENTER_WIDTH[width]} max-h-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden ${cardClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

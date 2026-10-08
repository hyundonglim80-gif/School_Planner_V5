// 창 껍데기 (V4 components/ModalShell.tsx). 머리말(제목 + ✕)·본문·아랫단을 한 곳에서 맞춘다.
// 바깥 틀(오른쪽 칸 / 휴대폰 배너 / 가운데 창)은 PopupFrame이 맡는다.
//
//   - 위를 기준으로 붙고 아래로만 자란다. 탭을 바꿔 내용 높이가 달라져도 창의 위쪽 자리가 흔들리지 않는다.
//   - 배경을 누르면 열린 창이 모두 닫힌다.
//   - 본문 스크롤을 잠근다 (화면 옆에 붙은 칸일 때는 왼쪽 화면을 함께 쓰므로 잠그지 않는다).
import type { ReactNode } from 'react';
import PopupFrame, { type ModalWidth } from './PopupFrame';

export type { ModalWidth };

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** 이미 열린 창을 다시 열면 바뀐다 (창 목록의 raisedAt) */
  raise?: number;
  width?: ModalWidth;
  /** 창 제목. 주면 공통 머리말(제목 + ✕)을 그려준다. */
  title?: ReactNode;
  /** 머리말 오른쪽, ✕ 왼쪽에 놓을 것 */
  headerExtra?: ReactNode;
  /** 아래 고정 영역. 저장/닫기 단추를 둔다. */
  footer?: ReactNode;
  /** 본문에 기본 여백을 두지 않는다 (직접 구역을 나누는 창용) */
  bare?: boolean;
  /** 배경을 눌렀을 때 할 일. 주지 않으면 열린 창을 모두 닫는다. */
  onBackdropClose?: () => void;
  /** Ctrl+S로 할 저장 (PopupFrame.onSave). 주지 않으면 입력칸이 든 form을 제출한다. */
  onSave?: () => void;
  children: ReactNode;
}

export default function ModalShell({
  isOpen,
  onClose,
  raise,
  width = 'md',
  title,
  headerExtra,
  footer,
  bare = false,
  onBackdropClose,
  onSave,
  children,
}: ModalShellProps) {
  return (
    <PopupFrame
      isOpen={isOpen}
      onClose={onClose}
      raise={raise}
      width={width}
      onBackdropClose={onBackdropClose}
      onSave={onSave}
      ariaLabel={typeof title === 'string' ? title : undefined}
    >
      {title !== undefined && (
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <h2 className="text-base font-black text-slate-800 truncate">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <button
              type="button"
              data-close
              onClick={onClose}
              title="닫기"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bare ? '' : 'px-5 py-4'}`} data-scroll-lock>
        {children}
      </div>

      {footer && (
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2 shrink-0">{footer}</div>
      )}
    </PopupFrame>
  );
}

/** 창 아래에 두는 닫기 단추. 문구와 모양을 한 곳에서 맞춘다. */
export function ModalCloseButton({ onClose, label = '닫기' }: { onClose: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}

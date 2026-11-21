// 둘째 줄 날짜 옆 📅 - 눌러도 올려도 작은 달력이 뜬다 (V4 components/MiniCalendarPicker.tsx에서 옮김, 날짜는 'YYYY-MM-DD').
// 메모 쓰는 칸의 '+ 날짜'(P10-3)도 이것 - trigger로 단추 모양을 바꾸고(누를 때만 열린다), marked = 이미 고른 날짜들.
// 뜨는 판(달·날 칸)은 ui/MiniCalendarPopover - 처음 열 때만 받는다(P49-3 첫 화면 JS - 둘째 줄 📅는 늘 그린다). 요일 머리 + 날 칸 판은 ui/MiniMonth.
import { Suspense, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { lazyWithReload } from '../app/lazyWithReload';
import { Icon } from './Icon';
import { glyphText } from './glyphText';

/** 뜨는 판 (끊겨서 못 받으면 판 없이 - 다음에 열 때 다시 받는다) */
const MiniCalendarPopover = lazyWithReload(() => import('./MiniCalendarPopover'), () => null);

interface MiniCalendarPickerProps {
  /** 보는 날 'YYYY-MM-DD' */
  date: string;
  onSelectDate: (date: string) => void;
  /** 다른 단추 모양 (주면 마우스를 올려도 열리지 않고 누를 때만, data-date-picker 대신 data-{data}) */
  trigger?: { label: ReactNode; title: string; data: string; className?: string; disabled?: boolean };
  /** 고른 것처럼 칠할 날짜들 (주면 date 대신) */
  marked?: readonly string[];
  /** 달력 아래 안내 */
  hint?: string;
}

export const POPOVER_WIDTH = 230;
/** 마우스를 올려 막 연 뒤 이 안에 누르면 닫지 않는다 - 올리자마자 누르는(휴대폰 톡·빠른 클릭) 한 동작이 열었다 닫는 일 (P36-1 CI가 찾음) */
const HOVER_CLICK_GRACE_MS = 400;

export default function MiniCalendarPicker({ date, onSelectDate, trigger, marked, hint = '클릭 시 이동' }: MiniCalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpenedAtRef = useRef(0);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const startCloseTimer = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 350);
  }, [clearCloseTimer]);

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const minLeft = 10;
    const maxLeft = Math.max(minLeft, window.innerWidth - POPOVER_WIDTH - 10);
    const left = Math.min(Math.max(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, minLeft), maxLeft);
    setPopoverPos({ top: rect.bottom + 6, left });
  }, []);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    updatePosition();
    setIsOpen(true);
  }, [clearCloseTimer, updatePosition]);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
  }, [clearCloseTimer]);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
    if (!isOpen) {
      hoverOpenedAtRef.current = Date.now();
      handleOpen();
    }
  }, [clearCloseTimer, handleOpen, isOpen]);

  // 화면 크기를 바꾸거나 굴리면 자리를 다시 잡는다
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // 바깥 누르기·ESC로 닫는다
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && !btnRef.current.contains(target) && popoverRef.current && !popoverRef.current.contains(target)) {
        handleClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const select = (dateStr: string) => {
    onSelectDate(dateStr);
    handleClose();
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={trigger ? undefined : handleMouseEnter}
      onMouseLeave={trigger ? undefined : startCloseTimer}
    >
      <button
        ref={btnRef}
        aria-expanded={isOpen}
        type="button"
        {...(trigger ? { [`data-${trigger.data}`]: '' } : { 'data-date-picker': '' })}
        disabled={trigger?.disabled}
        onClick={(e) => {
          e.stopPropagation();
          // 올려서 막 열린 것을 누름 = 열려고 누른 것이라 그대로 둔다(화면이 그 사이 다시 그려졌느냐에 따라 닫히곤 했다)
          if (!isOpen) handleOpen();
          else if (Date.now() - hoverOpenedAtRef.current < HOVER_CLICK_GRACE_MS) clearCloseTimer();
          else handleClose();
        }}
        className={
          trigger?.className ??
          `ml-1 px-1.5 py-0.5 text-xs rounded-md border transition-all flex items-center justify-center cursor-pointer shadow-2xs ${
            isOpen
              ? 'bg-sky-100 border-sky-300 text-primary'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-primary'
          }`
        }
        title={trigger?.title ?? '달력에서 날짜 선택 (마우스 올리기 또는 클릭)'}
      >
        {typeof trigger?.label === 'string' ? glyphText(trigger.label) : (trigger?.label ?? <Icon name="calendar-days" />)}
      </button>

      {isOpen && (
        <Suspense fallback={null}>
          <MiniCalendarPopover
            date={date}
            marked={marked}
            hint={hint}
            pos={popoverPos}
            popoverRef={popoverRef}
            onMouseEnter={trigger ? undefined : handleMouseEnter}
            onMouseLeave={trigger ? undefined : startCloseTimer}
            select={select}
            onClose={handleClose}
          />
        </Suspense>
      )}
    </div>
  );
}

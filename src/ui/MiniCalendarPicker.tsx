// 둘째 줄 날짜 옆 📅 - 눌러도 올려도 작은 달력이 뜬다 (V4 components/MiniCalendarPicker.tsx에서 옮김, 날짜는 'YYYY-MM-DD').
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDate, parseDateStr, todayStr } from '../domain/dateUtils';

interface MiniCalendarPickerProps {
  /** 보는 날 'YYYY-MM-DD' */
  date: string;
  onSelectDate: (date: string) => void;
}

const POPOVER_WIDTH = 230;
const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MiniCalendarPicker({ date, onSelectDate }: MiniCalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseDateStr(date).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseDateStr(date).getMonth()); // 0 ~ 11
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const d = parseDateStr(date);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    updatePosition();
    setIsOpen(true);
  }, [clearCloseTimer, date, updatePosition]);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
  }, [clearCloseTimer]);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
    if (!isOpen) handleOpen();
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

  const changeMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const select = (dateStr: string) => {
    onSelectDate(dateStr);
    handleClose();
  };

  // 달력 칸: 앞 달 꼬리 + 이번 달 + 다음 달 머리 (한 줄 7칸)
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<{ dateStr: string; day: number; inMonth: boolean }> = [];
  for (let i = firstDayIndex; i > 0; i--) {
    const d = new Date(viewYear, viewMonth, 1 - i);
    cells.push({ dateStr: formatDate(d), day: d.getDate(), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: formatDate(new Date(viewYear, viewMonth, d)), day: d, inMonth: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ dateStr: formatDate(new Date(viewYear, viewMonth + 1, d)), day: d, inMonth: false });
  }
  const today = todayStr();

  return (
    <div className="relative inline-flex items-center" onMouseEnter={handleMouseEnter} onMouseLeave={startCloseTimer}>
      <button
        ref={btnRef}
        type="button"
        data-date-picker
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) handleClose();
          else handleOpen();
        }}
        className={`ml-1 px-1.5 py-0.5 text-xs rounded-md border transition-all flex items-center justify-center cursor-pointer shadow-2xs ${
          isOpen
            ? 'bg-sky-100 border-sky-300 text-primary'
            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-primary'
        }`}
        title="달력에서 날짜 선택 (마우스 올리기 또는 클릭)"
      >
        📅
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          data-date-picker-popover
          onMouseEnter={handleMouseEnter}
          onMouseLeave={startCloseTimer}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, width: POPOVER_WIDTH, zIndex: 99999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 text-slate-800 select-none text-left"
        >
          {/* 단추와 달력 사이 틈에서 마우스가 빠져도 닫히지 않게 */}
          <div className="absolute -top-3 left-0 w-full h-3 bg-transparent pointer-events-auto" />

          <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => changeMonth(-12)} className="px-1 py-0.5 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="이전 연도">
                «
              </button>
              <button type="button" onClick={() => changeMonth(-1)} className="px-1 py-0.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="이전 달">
                ◀
              </button>
              <span className="font-bold text-xs text-slate-800 tracking-tight px-1 whitespace-nowrap">
                {viewYear}년 {viewMonth + 1}월
              </span>
              <button type="button" onClick={() => changeMonth(1)} className="px-1 py-0.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="다음 달">
                ▶
              </button>
              <button type="button" onClick={() => changeMonth(12)} className="px-1 py-0.5 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="다음 연도">
                »
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-picker-today
                onClick={() => select(today)}
                className="px-1.5 py-0.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded transition-colors cursor-pointer"
              >
                오늘
              </button>
              <button type="button" onClick={handleClose} className="px-1 text-slate-400 hover:text-slate-700 text-xs font-bold rounded transition-colors cursor-pointer" title="닫기">
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1 pb-1 border-b border-slate-100 text-center text-xs font-bold">
            {WEEK_DAYS.map((w, idx) => (
              <div key={w} className={`py-0.5 ${idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-600' : 'text-slate-500'}`}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {cells.map(({ dateStr, day, inMonth }) => {
              if (!inMonth) {
                return (
                  <button
                    key={dateStr}
                    type="button"
                    data-picker-day={dateStr}
                    onClick={() => select(dateStr)}
                    className="h-6 flex items-center justify-center text-xs text-slate-300 hover:bg-slate-100 hover:text-slate-500 rounded transition-colors cursor-pointer"
                  >
                    {day}
                  </button>
                );
              }
              const wd = parseDateStr(dateStr).getDay();
              const selected = dateStr === date;
              let color = wd === 0 ? 'text-rose-500' : wd === 6 ? 'text-blue-600' : 'text-slate-700';
              let bg = 'hover:bg-blue-50 hover:text-blue-700';
              let border = 'border border-transparent';
              if (selected) {
                color = 'text-white font-bold';
                bg = 'bg-primary shadow-2xs';
              } else if (dateStr === today) {
                border = 'border border-blue-500 font-bold';
              }
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-picker-day={dateStr}
                  onClick={() => select(dateStr)}
                  className={`h-6 flex items-center justify-center text-xs rounded transition-colors cursor-pointer ${color} ${bg} ${border}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-100 text-xs">
            <label className="relative inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium">
              <span>📅 직접 선택</span>
              <input
                type="date"
                defaultValue={date}
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  if (e.target.value) select(e.target.value);
                }}
              />
            </label>
            <span className="text-2xs text-slate-400">클릭 시 이동</span>
          </div>
        </div>
      )}
    </div>
  );
}

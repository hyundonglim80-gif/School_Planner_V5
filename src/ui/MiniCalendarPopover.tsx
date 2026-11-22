// 📅 작은 달력의 뜨는 판 (P49-3 - ui/MiniCalendarPicker에서 나눔: 판은 처음 열 때만 받는다 - 단추·올리기·누르기·바깥 누르기는 그대로 MiniCalendarPicker).
//   보는 달(«·◀·▶·»)은 판이 연 때마다 새로 그려지며 그날 달에서 시작한다.
import { useState, type Ref } from 'react';
import { parseDateStr, todayStr } from '../domain/dateUtils';
import { POPOVER_WIDTH } from './MiniCalendarPicker';
import MiniMonth from './MiniMonth';
import { Glyph } from './Icon';

export interface MiniCalendarPopoverProps {
  date: string;
  marked?: readonly string[];
  hint: string;
  pos: { top: number; left: number };
  popoverRef: Ref<HTMLDivElement>;
  /** 마우스를 올려 여는 단추만 (trigger가 없을 때) - 판 위에 있는 동안 닫지 않게 */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** 날을 고름 (고르고 닫는다) */
  select: (date: string) => void;
  onClose: () => void;
}

export default function MiniCalendarPopover({ date, marked, hint, pos, popoverRef, onMouseEnter, onMouseLeave, select, onClose }: MiniCalendarPopoverProps) {
  const [viewYear, setViewYear] = useState(() => parseDateStr(date).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseDateStr(date).getMonth()); // 0 ~ 11

  const changeMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const today = todayStr();

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- 달력 판 - 바깥 누르기로 닫히지 않게 막기만(날짜는 단추) (P22-7)
    <div
      ref={popoverRef}
      data-date-picker-popover
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_WIDTH, zIndex: 99999 }}
      className="bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 text-slate-800 select-none text-left"
    >
      {/* 단추와 달력 사이 틈에서 마우스가 빠져도 닫히지 않게 */}
      <div className="absolute -top-3 left-0 w-full h-3 bg-transparent pointer-events-auto" />

      <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => changeMonth(-12)} className="px-1 py-0.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="이전 연도">
            «
          </button>
          <button type="button" onClick={() => changeMonth(-1)} className="px-1 py-0.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="이전 달">
            <Glyph e="◀" />
          </button>
          <span className="font-bold text-xs text-slate-800 tracking-tight px-1 whitespace-nowrap">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button type="button" onClick={() => changeMonth(1)} className="px-1 py-0.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="다음 달">
            <Glyph e="▶" />
          </button>
          <button type="button" onClick={() => changeMonth(12)} className="px-1 py-0.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="다음 연도">
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
          <button type="button" onClick={onClose} className="px-1 text-slate-500 hover:text-slate-700 text-xs font-bold rounded transition-colors cursor-pointer" title="닫기">
            ✕
          </button>
        </div>
      </div>

      {/* 달력 칸: 앞 달 꼬리 + 이번 달 + 다음 달 머리 (한 줄 7칸) */}
      <MiniMonth
        year={viewYear}
        month={viewMonth + 1}
        day={(dateStr, inMonth) => {
          if (!inMonth) {
            return (
              <button
                type="button"
                data-picker-day={dateStr}
                onClick={() => select(dateStr)}
                className="h-6 flex items-center justify-center text-xs text-slate-300 hover:bg-slate-100 hover:text-slate-500 rounded transition-colors cursor-pointer"
              >
                {Number(dateStr.slice(8))}
              </button>
            );
          }
          const wd = parseDateStr(dateStr).getDay();
          const selected = marked ? marked.includes(dateStr) : dateStr === date;
          let color = wd === 0 ? 'text-rose-500' : wd === 6 ? 'text-cobalt-600' : 'text-slate-700';
          let bg = 'hover:bg-blue-50 hover:text-blue-700';
          let border = 'border border-transparent';
          if (selected) {
            color = 'text-white font-bold';
            bg = 'bg-primary shadow-xs';
          } else if (dateStr === today) {
            border = 'border border-blue-500 font-bold';
          }
          return (
            <button
              type="button"
              data-picker-day={dateStr}
              onClick={() => select(dateStr)}
              className={`h-6 flex items-center justify-center text-xs rounded transition-colors cursor-pointer ${color} ${bg} ${border}`}
            >
              {Number(dateStr.slice(8))}
            </button>
          );
        }}
      />

      <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-100 text-xs">
        <label className="relative inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium">
          <span><Glyph e="📅" /> 직접 선택</span>
          <input
            type="date"
            defaultValue={date}
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => {
              if (e.target.value) select(e.target.value);
            }}
          />
        </label>
        <span className="text-2xs text-slate-500">{hint}</span>
      </div>
    </div>
  );
}

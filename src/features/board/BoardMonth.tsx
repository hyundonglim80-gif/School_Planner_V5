// 한눈에 화면 첫 칸 (P24-2) - 작은 달력(월요일부터, 보는 주 한 줄 칠함) + 그 달 '달력' 일정 목록.
//   달력 날짜를 누르면 그날을 고른다(요일 칸·오른쪽이 따라온다). 달력 ◀▶는 달만 넘겨 보고 고른 날은 그대로 - 고른 날이 바뀌면 그 달로 돌아온다.
//   날 칸: 고른 날 = 채운 칸, 오늘 = 테두리, 토 파랑·일·공휴일 빨강(domain/dayTone), '달력' 일정이 있는 날 = 아래 점(겹친 공간 것도 - P17-2).
//   달력 판은 ui/MiniMonth(📅 뜨는 달력과 함께 - 그쪽은 일요일부터).
import { useMemo, useState } from 'react';
import { setDate, useNav } from '../../app/nav';
import { useHolidayName } from '../../data/holidays';
import { useDocs, useLabelTree, useOverlaySpaces } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { DAY_NUMBER_COLOR, dayToneOf } from '../../domain/dayTone';
import { monthGridDates } from '../../domain/dateUtils';
import { onPeriodDay } from '../../domain/period';
import MiniMonth from '../../ui/MiniMonth';
import { useToday } from '../../ui/useToday';
import { calendarEvents } from '../month/calendarEvents';

interface Props {
  /** 고른 날 */
  date: string;
  /** 보는 주 (월 ~ 일) */
  week: readonly string[];
  /** 화면 높이에 맞춘 칸 - 칸 안에서 스크롤 */
  fit: boolean;
}

/** 'YYYY-MM'에서 n달 옮긴 'YYYY-MM' */
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function BoardMonth({ date, week, fit }: Props) {
  const sid = useCurrentSpaceId();
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const overlays = useOverlaySpaces();
  const showEvents = useNav((s) => s.showEvents);
  const today = useToday();
  const holidayName = useHolidayName();

  // 넘겨 보는 달 - 고른 날이 바뀌면 그 달로 (고른 날과 함께 기억한다)
  const [peek, setPeek] = useState<{ base: string; ym: string } | null>(null);
  const ym = peek?.base === date ? peek.ym : date.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const step = (n: number) => setPeek({ base: date, ym: shiftMonth(ym, n) });

  // 달력 칸 범위의 '달력' 일정 수 (날마다 - 하루짜리 + 그날에 걸친 기간)
  const dates = useMemo(() => monthGridDates(y, m, 1), [y, m]);
  const cal = useMemo(() => calendarEvents(items, dates[0], dates[dates.length - 1], tree, overlays), [items, dates, tree, overlays]);
  const countOn = useMemo(() => {
    const out = new Map<string, number>();
    for (const d of dates) {
      const n = (cal.byDate.get(d)?.length ?? 0) + cal.periods.filter((p) => onPeriodDay(p, d)).length;
      if (n) out.set(d, n);
    }
    return out;
  }, [dates, cal]);

  return (
    <section
      data-board-month={ym}
      aria-label={`${y}년 ${m}월 달력`}
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-xs p-2 flex flex-col min-w-0 ${fit ? 'h-full min-h-0 overflow-y-auto overscroll-contain' : 'min-h-[250px]'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
        <button
          type="button"
          data-board-cal-prev
          onClick={() => step(-1)}
          title="이전 달 보기 (고른 날은 그대로)"
          aria-label="이전 달 보기"
          className="w-6 h-6 shrink-0 flex items-center justify-center rounded text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
        >
          ◀
        </button>
        <span data-board-cal-title className="min-w-0 truncate text-xs font-extrabold text-slate-700">
          {y}년 {m}월
        </span>
        <button
          type="button"
          data-board-cal-next
          onClick={() => step(1)}
          title="다음 달 보기 (고른 날은 그대로)"
          aria-label="다음 달 보기"
          className="w-6 h-6 shrink-0 flex items-center justify-center rounded text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
        >
          ▶
        </button>
      </div>
      <div className="shrink-0">
        <MiniMonth
          year={y}
          month={m}
          weekStart={1}
          week={(w) => (w[0] === week[0] ? { className: 'bg-primary/10 rounded-md', data: { 'data-board-cal-week': w[0] } } : undefined)}
          day={(d, inMonth) => {
            const holiday = holidayName(d);
            const selected = d === date;
            const count = showEvents ? (countOn.get(d) ?? 0) : 0;
            const color = selected ? 'text-white font-bold' : inMonth ? DAY_NUMBER_COLOR[dayToneOf(d, holiday)] : 'text-slate-300';
            const bg = selected ? 'bg-primary shadow-2xs' : 'hover:bg-blue-50 hover:text-blue-700';
            const border = !selected && d === today ? 'border border-primary font-bold' : 'border border-transparent';
            const [, mm, dd] = d.split('-').map(Number);
            return (
              <button
                type="button"
                data-board-cal-day={d}
                data-board-cal-count={count || undefined}
                aria-current={selected ? 'date' : undefined}
                onClick={() => setDate(d)}
                title={`${mm}월 ${dd}일${holiday ? ` ${holiday}` : ''}${count ? ` · 달력 일정 ${count}개` : ''} - 누르면 이 날을 고른다`}
                className={`relative h-7 min-w-0 flex flex-col items-center justify-center text-xs leading-none rounded transition-colors cursor-pointer ${color} ${bg} ${border}`}
              >
                {dd}
                {count > 0 && <span aria-hidden className={`absolute bottom-0.5 w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-amber-500'}`} />}
              </button>
            );
          }}
        />
      </div>
    </section>
  );
}

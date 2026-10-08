// 년간 '학사력'의 달 하나 (V4 features/year/YearSheet.tsx). 열두 달을 작은 달력으로 늘어놓는다.
//
//   날짜 칸에는 '달력' 일정을 점(라벨 빛깔)과 가는 막대(기간)로만 찍고, 달 아래 그 달의 것을 한 줄씩 적는다.
//   고치기·여러 개 고르기는 '자세히'에서. 공휴일·D-Day는 P5-3, 학사일정은 P6-3이 더한다.
//   달 카드는 React.memo - 부모가 넘기는 값은 붙들어 둔다(열두 달을 판마다 다시 그리지 않게, V4 그대로).
import { memo, useState } from 'react';
import { DAY_NAMES } from '../../domain/dateUtils';
import { dayToneOf } from '../../domain/dayTone';
import { labelColor } from '../../domain/labels';
import { layoutWeekBars, periodsInDates } from '../../domain/periodBars';
import { dayTooltip, monthSheetItems, monthWeeks, type AcademicMonth, type SheetItem } from '../../domain/yearSheet';
import { itemLabels, type LabelTree } from '../../data/select';
import { doneOnDay, type ItemDoc } from '../events/eventOps';
import type { CalendarEvents } from '../month/calendarEvents';

interface Props {
  m: AcademicMonth;
  cal: CalendarEvents;
  tree: LabelTree;
  showWeekend: boolean;
  showEvents: boolean;
  isCurrentMonth: boolean;
  today: string;
  onDateClick: (date: string) => void;
  onMonthClick: (m: AcademicMonth) => void;
  onOpenEvent: (ev: ItemDoc, date: string) => void;
}

const DEFAULT_DOT = '#60a5fa';
const DONE_DOT = 'var(--color-slate-300)';
/** 달 아래 목록을 처음에 몇 줄까지 (더 있으면 '+N개 더') */
const LIST_LIMIT = 8;
/** 막대 한 줄의 높이·사이 (px) */
const LANE = 5;
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

function YearSheetMonth({ m, cal, tree, showWeekend, showEvents, isCurrentMonth, today, onDateClick, onMonthClick, onOpenEvent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const weeks = monthWeeks(m.year, m.month, showWeekend);
  const cols = showWeekend ? 7 : 5;
  const dayNames = showWeekend ? DAY_NAMES : DAY_NAMES.slice(1, 6);
  const dates = weeks.flat().filter((d): d is string => !!d);

  const eventsOn = (d: string) => (showEvents ? (cal.byDate.get(d) ?? []) : []);
  const periods = showEvents ? cal.periods.filter((p) => p.date! <= dates[dates.length - 1] && p.endDate! >= dates[0]) : [];
  const colorOf = (ev: ItemDoc) => {
    const label = itemLabels(tree, ev.labelIds)[0];
    return label ? labelColor(label.color).border : DEFAULT_DOT;
  };

  const items = monthSheetItems<ItemDoc>({ dates, eventsOn, periods: periodsInDates(dates, periods), textOf: (ev) => ev.text, doneOn: doneOnDay });

  const openItem = (it: SheetItem<ItemDoc>) => {
    if (it.item) onOpenEvent(it.item, it.date);
    else onDateClick(it.date);
  };

  return (
    <div
      data-sheet-month={m.key}
      // 둘째 줄 날짜를 누르면 오늘로 (app/todayScroll) - 오늘 칸(주말을 감춰 없으면 이 달)
      data-today-area={isCurrentMonth ? 'true' : undefined}
      className={`bg-white rounded-2xl border p-3 flex flex-col gap-1.5 break-inside-avoid ${isCurrentMonth ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200/80'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" data-sheet-month-name={m.key} onClick={() => onMonthClick(m)} title="월간 화면으로" className="font-black text-blue-800 text-sm hover:underline cursor-pointer">
          {m.label}
        </button>
        <span className="text-2xs font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">{m.semester}학기</span>
      </div>

      <div className="grid text-center text-2xs font-bold text-slate-400" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {dayNames.map((n) => (
          <div key={n} className={n === '일' ? 'text-red-400' : n === '토' ? 'text-blue-400' : ''}>
            {n}
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {weeks.map((week, wi) => {
          // 칸 밖 날은 자리만 (막대의 칸 차례가 맞도록)
          const layout = layoutWeekBars(
            week.map((d, col) => d ?? `-${wi}-${col}`),
            periods,
          );
          return (
            <div key={wi} className="relative grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, height: 26 + layout.lanes * LANE }}>
              {week.map((d, col) => {
                if (!d) return <div key={`e${col}`} />;
                const tone = dayToneOf(d);
                const isToday = d === today;
                const dots = eventsOn(d).map((ev) => (doneOnDay(ev, d) ? DONE_DOT : colorOf(ev)));
                return (
                  <button
                    key={d}
                    type="button"
                    data-sheet-date={d}
                    data-today={isToday ? 'true' : undefined}
                    data-sheet-dots={dots.length || undefined}
                    onClick={() => onDateClick(d)}
                    title={dayTooltip(d, items)}
                    className="relative flex flex-col items-center pt-0.5 rounded-md hover:bg-slate-100 cursor-pointer"
                  >
                    <span
                      className={`text-2xs font-bold w-[18px] h-[16px] leading-[16px] rounded-full tabular-nums ${
                        isToday ? 'bg-primary text-white' : tone === 'holiday' ? 'text-red-500' : tone === 'saturday' ? 'text-blue-500' : 'text-slate-700'
                      }`}
                    >
                      {Number(d.slice(8, 10))}
                    </span>
                    {dots.length > 0 && (
                      <span className="absolute bottom-[2px] left-0 right-0 flex justify-center gap-[2px]">
                        {dots.slice(0, 4).map((c, i) => (
                          <span key={i} className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
              {layout.bars.map((bar) => {
                const done = bar.cells.every((c) => doneOnDay(bar.item, c.date));
                return (
                  <div
                    key={`${bar.item.id}@${bar.start}`}
                    data-sheet-bar={bar.item.id}
                    title={`📆 ${bar.item.text} (${md(bar.cells[0].date)} ~ ${md(bar.cells[bar.cells.length - 1].date)})`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `calc(${(bar.start / cols) * 100}% + ${bar.startsPeriod ? 3 : 0}px)`,
                      width: `calc(${(bar.len / cols) * 100}% - ${(bar.startsPeriod ? 3 : 0) + (bar.endsPeriod ? 3 : 0)}px)`,
                      top: 18 + bar.lane * LANE,
                      height: 3,
                      borderRadius: `${bar.startsPeriod ? 2 : 0}px ${bar.endsPeriod ? 2 : 0}px ${bar.endsPeriod ? 2 : 0}px ${bar.startsPeriod ? 2 : 0}px`,
                      backgroundColor: done ? DONE_DOT : colorOf(bar.item),
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <ul className="border-t border-slate-100 pt-1.5 flex flex-col gap-[3px]" data-sheet-list>
          {items.map((it, i) => {
            const dow = DAY_NAMES[new Date(`${it.date}T00:00:00`).getDay()];
            // 넘치는 줄은 화면에서만 접는다 - 인쇄에는 다 찍힌다 (P6-3 data-sheet-extra)
            const extra = !expanded && i >= LIST_LIMIT;
            return (
              <li key={`${it.kind}-${it.date}-${it.item?.id ?? i}`} className={extra ? 'hidden' : ''} data-sheet-extra={extra ? '' : undefined}>
                <button
                  type="button"
                  data-sheet-item={it.kind}
                  data-sheet-item-id={it.item?.id}
                  onClick={() => openItem(it)}
                  className="w-full flex items-start gap-1.5 text-left text-2xs leading-snug rounded hover:bg-slate-50 px-0.5 cursor-pointer"
                  title={it.item ? '누르면 오른쪽 칸에서 고치기' : '그날 하루 화면'}
                >
                  <span className={`shrink-0 w-[34px] tabular-nums font-bold ${it.kind === 'holiday' ? 'text-red-500' : 'text-slate-400'}`}>
                    {Number(it.date.slice(8, 10))}({dow})
                  </span>
                  <span
                    className="shrink-0 mt-[4px] w-[6px] h-[6px] rounded-full"
                    style={{
                      backgroundColor:
                        it.kind === 'holiday' ? '#ef4444' : it.kind === 'dday' ? '#f59e0b' : it.kind === 'school' ? '#14b8a6' : it.done ? DONE_DOT : it.item ? colorOf(it.item) : DEFAULT_DOT,
                    }}
                  />
                  <span
                    className={`min-w-0 break-words ${
                      it.kind === 'holiday'
                        ? 'text-red-600 font-bold'
                        : it.kind === 'dday'
                          ? 'text-amber-700 font-bold'
                          : it.kind === 'school'
                            ? 'text-teal-700 font-semibold'
                            : it.done
                              ? 'text-slate-400 line-through'
                              : 'text-slate-700 font-medium'
                    }`}
                  >
                    {it.kind === 'dday' && '🎯 '}
                    {it.kind === 'period' && it.continuesBefore && '◂ '}
                    {it.text}
                    {it.kind === 'period' && it.endDate && it.endDate !== it.date && <span className="text-slate-400 font-semibold"> ~{md(it.endDate)}</span>}
                    {it.kind === 'period' && it.continuesAfter && ' ▸'}
                  </span>
                </button>
              </li>
            );
          })}
          {items.length > LIST_LIMIT && (
            <li data-print-hide>
              <button type="button" data-sheet-more onClick={() => setExpanded((v) => !v)} className="text-2xs font-bold text-slate-400 hover:text-primary px-0.5 cursor-pointer">
                {expanded ? '접기' : `+${items.length - LIST_LIMIT}개 더`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default memo(YearSheetMonth);

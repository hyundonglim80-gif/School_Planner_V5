// 년간 '학사력'의 달 하나 (V4 features/year/YearSheet.tsx). 열두 달을 작은 달력으로 늘어놓는다.
//
//   날짜 칸에는 '달력' 일정을 점(라벨 빛깔)과 가는 막대(기간)로만 찍고, 달 아래 그 달의 것을 한 줄씩 적는다.
//   공휴일(빨간 칸·이름)·D-Day(노란 테)도 날짜 칸과 목록에. 고치기·여러 개 고르기는 '자세히'에서. 학사일정은 P6-3이 더한다.
//   구글 캘린더 일정(P36-4)도 점(캘린더 색)·가는 막대·목록 줄(점선 - 누르면 그 일정 창, 끝낸 표시 없음). 인쇄 창에서는 없다(부모가 넘기지 않는다).
//   달 카드는 React.memo - 부모가 넘기는 값은 붙들어 둔다(열두 달을 판마다 다시 그리지 않게, V4 그대로).
import { memo, useState } from 'react';
import { DAY_NAMES } from '../../domain/dateUtils';
import { dayToneOf } from '../../domain/dayTone';
import { labelColor } from '../../domain/labels';
import { layoutWeekBars, periodsInDates } from '../../domain/periodBars';
import { dayTooltip, monthSheetItems, monthWeeks, type AcademicMonth, type SheetItem } from '../../domain/yearSheet';
import { itemLabels, type LabelTree } from '../../data/select';
import { useCommonSettings } from '../../app/prefs';
import { liveDDays } from '../../domain/dday';
import { useHolidayName } from '../../data/holidays';
import { useSchoolSchedule } from '../school/school';
import { doneOnDay, type ItemDoc } from '../events/eventOps';
import { DoneMark } from '../events/EventDoneChip';
import type { CalendarEvents } from '../month/calendarEvents';
import { gcalKey, gcalTimeOn, type GcalBarItem, type GcalShown } from '../../domain/gcalShow';
import { openGcalEvent } from '../gcal/open';
import { gcalTip } from '../gcal/gcalActions';
import { Glyph } from '../../ui/Icon';

/** 앱 일정 또는 구글 캘린더 일정 (하루짜리 구글 일정도 막대 자리 꼴로 - endDate = 그날이라 기간이 아니다) */
type Entry = ItemDoc | GcalBarItem;
const isGcal = (it: Entry): it is GcalBarItem => 'gcal' in it;
const asEntry = (g: GcalShown): GcalBarItem => ({ id: `gcal:${gcalKey(g)}`, date: g.first, endDate: g.first, gcal: g });

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
/** 달 아래 목록을 처음에 몇 줄까지 (더 있으면 '+N개 더') */
const LIST_LIMIT = 8;
/** 막대 한 줄의 높이·사이 (px) */
const LANE = 5;
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

function YearSheetMonth({ m, cal, tree, showWeekend, showEvents, isCurrentMonth, today, onDateClick, onMonthClick, onOpenEvent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const holidayOf = useHolidayName();
  const ddays = liveDDays(useCommonSettings((s) => s.ddays));
  const ddayDates = new Set(ddays.map((d) => d.date));
  const weeks = monthWeeks(m.year, m.month, showWeekend);
  const cols = showWeekend ? 7 : 5;
  const dayNames = showWeekend ? DAY_NAMES : DAY_NAMES.slice(1, 6);
  const dates = weeks.flat().filter((d): d is string => !!d);

  // 앱 일정 뒤에 구글 캘린더 일정 (P36-4)
  const eventsOn = (d: string): Entry[] => (showEvents ? [...(cal.byDate.get(d) ?? []), ...(cal.gcalByDate.get(d) ?? []).map(asEntry)] : []);
  const inMonth = (p: { date: string | null; endDate?: string }) => p.date! <= dates[dates.length - 1] && p.endDate! >= dates[0];
  const periods: Entry[] = showEvents ? [...cal.periods.filter(inMonth), ...cal.gcalPeriods.filter(inMonth)] : [];
  // 겹친 공간 일정은 그 공간 라벨 트리로 (P17-2 - cal.spaceOf), 구글 일정은 캘린더 색
  const colorOf = (ev: Entry) => {
    if (isGcal(ev)) return ev.gcal.cal.color;
    const label = itemLabels(cal.spaceOf.get(ev)?.tree ?? tree, ev.labelIds)[0];
    return label ? labelColor(label.color).border : DEFAULT_DOT;
  };
  const textOf = (ev: Entry) => {
    if (!isGcal(ev)) return ev.text;
    const t = gcalTimeOn(ev.gcal, ev.date, true);
    return t ? `${t} ${ev.gcal.ev.title}` : ev.gcal.ev.title;
  };

  // 우리 학교 학사일정 (P6-3)
  const { byDate: schoolEvents } = useSchoolSchedule([`${m.year}-${String(m.month).padStart(2, '0')}`]);
  const schoolOf = (d: string) => schoolEvents[d]?.map((it) => it.name);
  const items = monthSheetItems<Entry>({ dates, eventsOn, periods: periodsInDates(dates, periods), textOf, doneOn: (ev, d) => !isGcal(ev) && doneOnDay(ev, d), holidayOf, ddays, schoolOf });

  const openItem = (it: SheetItem<Entry>) => {
    if (it.item && isGcal(it.item)) openGcalEvent(it.item.gcal, it.date);
    else if (it.item) onOpenEvent(it.item, it.date);
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

      <div className="grid text-center text-2xs font-bold text-slate-500" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {dayNames.map((n) => (
          <div key={n} className={n === '일' ? 'text-red-400' : n === '토' ? 'text-cobalt-400' : ''}>
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
                const holiday = holidayOf(d);
                const tone = dayToneOf(d, holiday);
                const isToday = d === today;
                const dots = eventsOn(d).map((ev) => colorOf(ev));
                return (
                  <button
                    key={d}
                    type="button"
                    data-sheet-date={d}
                    data-today={isToday ? 'true' : undefined}
                    data-sheet-dots={dots.length || undefined}
                    data-sheet-holiday={holiday}
                    data-sheet-dday={ddayDates.has(d) ? '1' : undefined}
                    onClick={() => onDateClick(d)}
                    title={dayTooltip(d, items)}
                    className={`relative flex flex-col items-center pt-0.5 rounded-md hover:bg-slate-100 cursor-pointer ${holiday ? 'bg-red-50/70' : ''}`}
                  >
                    <span
                      className={`text-2xs font-bold w-[18px] h-[16px] leading-[16px] rounded-full tabular-nums ${
                        isToday ? 'bg-primary text-white' : tone === 'holiday' ? 'text-red-500' : tone === 'saturday' ? 'text-cobalt-500' : 'text-slate-700'
                      } ${ddayDates.has(d) ? 'ring-[1.5px] ring-amber-400' : ''}`}
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
                const g = isGcal(bar.item);
                const space = isGcal(bar.item) ? undefined : cal.spaceOf.get(bar.item);
                return (
                  <div
                    key={`${space?.sid ?? ''}/${bar.item.id}@${bar.start}`}
                    data-sheet-bar={bar.item.id}
                    data-gcal-bar={g ? '' : undefined}
                    data-event-space={space?.sid}
                    title={`${g ? '📅' : '📆'} ${textOf(bar.item)} (${md(bar.cells[0].date)} ~ ${md(bar.cells[bar.cells.length - 1].date)})`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `calc(${(bar.start / cols) * 100}% + ${bar.startsPeriod ? 3 : 0}px)`,
                      width: `calc(${(bar.len / cols) * 100}% - ${(bar.startsPeriod ? 3 : 0) + (bar.endsPeriod ? 3 : 0)}px)`,
                      top: 18 + bar.lane * LANE,
                      height: 3,
                      borderRadius: `${bar.startsPeriod ? 2 : 0}px ${bar.endsPeriod ? 2 : 0}px ${bar.endsPeriod ? 2 : 0}px ${bar.startsPeriod ? 2 : 0}px`,
                      backgroundColor: colorOf(bar.item),
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
            const gItem = it.item && isGcal(it.item) ? it.item.gcal : undefined;
            const space = it.item && !isGcal(it.item) ? cal.spaceOf.get(it.item) : undefined;
            return (
              <li key={`${it.kind}-${it.date}-${space?.sid ?? ''}${it.item?.id ?? i}`} className={extra ? 'hidden' : ''} data-sheet-extra={extra ? '' : undefined}>
                <button
                  type="button"
                  data-sheet-item={it.kind}
                  data-sheet-item-id={it.item?.id}
                  data-event-space={space?.sid}
                  {...(gItem ? { 'data-gcal-event': gItem.ev.id, 'data-gcal-cal': gItem.cal.id, 'data-gcal-at': 'sheet-month', 'data-gcal-day': it.date } : {})}
                  style={space?.tone}
                  onClick={() => openItem(it)}
                  className={`w-full flex items-start gap-1.5 text-left text-2xs leading-snug rounded hover:bg-slate-50 px-0.5 cursor-pointer ${gItem ? 'border border-dashed border-slate-300' : ''}`}
                  title={gItem ? gcalTip(gItem) : it.item ? '누르면 오른쪽 칸에서 고치기' : '그날 하루 화면'}
                >
                  <span className={`shrink-0 w-[34px] tabular-nums font-bold ${it.kind === 'holiday' ? 'text-red-500' : 'text-slate-500'}`}>
                    {Number(it.date.slice(8, 10))}({dow})
                  </span>
                  <span
                    className="shrink-0 mt-[4px] w-[6px] h-[6px] rounded-full"
                    style={{
                      backgroundColor:
                        it.kind === 'holiday' ? '#ef4444' : it.kind === 'dday' ? '#f59e0b' : it.kind === 'school' ? '#14b8a6' : it.item ? colorOf(it.item) : DEFAULT_DOT,
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
                            : 'text-slate-700 font-medium'
                    }`}
                  >
                    {/* 끝낸 일정은 글 앞에 ✓ (P10-1 - 색은 그대로) */}
                    {it.done && <DoneMark className="!mr-0.5" />}
                    {it.kind === 'dday' && <><Glyph e="🎯" /> </>}
                    {it.kind === 'period' && it.continuesBefore && '◂ '}
                    {it.text}
                    {it.kind === 'period' && it.endDate && it.endDate !== it.date && <span className="text-slate-500 font-semibold"> ~{md(it.endDate)}</span>}
                    {it.kind === 'period' && it.continuesAfter && ' ▸'}
                  </span>
                </button>
              </li>
            );
          })}
          {items.length > LIST_LIMIT && (
            <li data-print-hide>
              <button type="button" data-sheet-more onClick={() => setExpanded((v) => !v)} className="text-2xs font-bold text-slate-500 hover:text-primary px-0.5 cursor-pointer">
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

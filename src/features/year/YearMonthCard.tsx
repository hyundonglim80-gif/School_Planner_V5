// 년간 '자세히'의 달 카드 하나 (V4 features/year/YearMonthCard.tsx). 일정이 있는 날만 줄로 늘어놓는다.
//
//   - 기간 일정은 날마다 늘어서지 않게 이 달에서 처음 보이는 날 한 번만 범위와 함께(V4 그대로) - 누르면 그날 일정 칸.
//   - 일정 = 오른쪽 일정 칸, 라벨 칩 = 완료, ✕ = 지우기(묶음이면 범위를 묻는다), 🔗 n = 연결된 데이터, + 일정 = 그날 새 일정, 📝 n = 그날 기록 창,
//     날짜 = 그날 하루 화면, Ctrl·Shift·여러 개 고르기.
//   - 휴대폰: 이번 달만 펼치고 나머지는 머리글만(접은 달은 날을 그리지 않는다 - V4 그대로), 펼친 달은 두 칸을 다 쓴다.
//   - 일정을 끌어 다른 날 줄에 놓으면 옮긴다(P5-3 - 그리는 날에만 놓을 수 있다, V4 그대로). 수업 칩은 P6-1, 학사일정은 P6-3.
//   달 카드는 React.memo - 바뀐 달만 다시 그린다(V4 - 열두 달 요소가 11,000개였다).
import { memo, type MouseEvent as ReactMouseEvent } from 'react';
import { DAY_NAMES } from '../../domain/dateUtils';
import { DAY_CELL_BG, DAY_NUMBER_COLOR, dayToneOf } from '../../domain/dayTone';
import { labelColor } from '../../domain/labels';
import { periodIndexLabel, periodRangeLabel, periodsInDates, type ShownPeriod } from '../../domain/periodBars';
import { BODY_TEXT, SECTION_TITLE } from '../../domain/typeScale';
import { monthWeeks, type AcademicMonth } from '../../domain/yearSheet';
import { itemLabels, type LabelTree } from '../../data/select';
import { DROP_TARGET_CLASS, dropTargetProps, eventDragProps, type DropHandlers } from '../events/drag';
import { useHolidayName } from '../../data/holidays';
import HolidayName from '../../ui/HolidayName';
import { doneOnDay, type ItemDoc } from '../events/eventOps';
import type { CalendarEvents } from '../month/calendarEvents';

interface Props {
  m: AcademicMonth;
  cal: CalendarEvents;
  tree: LabelTree;
  noteCounts: ReadonlyMap<string, number>;
  showWeekend: boolean;
  showEvents: boolean;
  isMobile: boolean;
  isOpen: boolean;
  isCurrentMonth: boolean;
  today: string;
  /** 이 달에서 고른 것 ('id|날짜') */
  picked: ReadonlySet<string>;
  multiOn: boolean;
  onToggleMonth: (key: string, defaultCollapsed: boolean) => void;
  onDateClick: (date: string) => void;
  onAdd: (date: string) => void;
  onOpenNotes: (date: string) => void;
  onEventClick: (ev: ItemDoc, date: string, e: ReactMouseEvent) => void;
  onPeriodClick: (p: ShownPeriod<ItemDoc>, e: ReactMouseEvent) => void;
  onToggleDone: (ev: ItemDoc, date: string) => void;
  onDelete: (ev: ItemDoc, date: string) => void;
  onOpenLinks: (ev: ItemDoc) => void;
  /** 끌어 옮기기 - handlers·onDragEnd는 늘 같은 함수, overDate는 이 달 것일 때만 (다른 달은 다시 그리지 않는다) */
  dropHandlers?: DropHandlers;
  dragEnabled: boolean;
  onDragEnd: () => void;
  overDate: string | null;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function LinksButton({ ev, onOpen }: { ev: ItemDoc; onOpen: (ev: ItemDoc) => void }) {
  const n = ev.linkIds?.length ?? 0;
  if (n === 0) return null;
  return (
    <button
      type="button"
      data-year-event-links={n}
      onClick={(e) => {
        stop(e);
        onOpen(ev);
      }}
      className="inline-flex align-middle ml-1 bg-yellow-100 text-yellow-800 text-2xs px-1 py-0.5 rounded font-bold border border-yellow-300 shrink-0 hover:bg-yellow-200 cursor-pointer"
      title={`링크된 항목 ${n}개`}
    >
      🔗 {n}
    </button>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      data-year-event-delete
      onClick={(e) => {
        stop(e);
        onDelete();
      }}
      title="일정 삭제"
      aria-label="일정 삭제"
      className="absolute -top-1.5 -right-1 w-4 h-4 hidden group-hover/ev:flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs text-2xs text-slate-400 hover:text-rose-600 cursor-pointer"
    >
      ✕
    </button>
  );
}

function YearMonthCard(p: Props) {
  const dates = monthWeeks(p.m.year, p.m.month, p.showWeekend)
    .flat()
    .filter((d): d is string => !!d);
  const periods = p.showEvents ? periodsInDates(dates, p.cal.periods) : [];
  const startsOn = new Map<string, ShownPeriod<ItemDoc>[]>();
  for (const sp of periods) startsOn.set(sp.cells[0].date, [...(startsOn.get(sp.cells[0].date) ?? []), sp]);
  const eventsOn = (d: string) => (p.showEvents ? (p.cal.byDate.get(d) ?? []) : []);
  const holidayOf = useHolidayName();
  // 그릴 날 = 일정이 있는 날·공휴일 (수업은 P6-1, 학사일정 P6-3이 더한다)
  const activeDays = dates.filter((d) => eventsOn(d).length > 0 || startsOn.has(d) || !!holidayOf(d));
  const firstLabel = (ev: ItemDoc) => itemLabels(p.tree, ev.labelIds)[0];
  const isPicked = (id: string, d: string) => p.picked.has(`${id}|${d}`);

  const renderPeriod = (sp: ShownPeriod<ItemDoc>) => {
    const ev = sp.item;
    const label = firstLabel(ev);
    const c = label ? labelColor(label.color) : null;
    const allDone = sp.cells.every((cell) => doneOnDay(ev, cell.date));
    const anyPicked = sp.cells.some((cell) => isPicked(ev.id, cell.date));
    const allPicked = sp.cells.every((cell) => isPicked(ev.id, cell.date));
    const range = periodRangeLabel(sp.cells);
    const indexLabel = periodIndexLabel(sp.cells, sp.total);
    return (
      <div
        key={`period-${ev.id}`}
        data-year-period={ev.id}
        data-year-period-done={allDone ? '1' : '0'}
        data-event-picked={anyPicked ? '1' : undefined}
        {...eventDragProps(ev, sp.cells[0].date, p.dragEnabled, p.onDragEnd)}
        onClick={(e) => {
          stop(e);
          p.onPeriodClick(sp, e);
        }}
        className={`group/ev relative px-1.5 py-1 rounded-lg ${BODY_TEXT.month} leading-snug transition-all border border-l-4 block hover:shadow-sm cursor-pointer break-words ${
          anyPicked ? 'bg-primary/10 border-primary text-primary' : allDone ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-blue-50/60 border-blue-100 text-slate-700 font-medium'
        }`}
        style={anyPicked || allDone ? undefined : { borderLeftColor: c?.border || '#93c5fd' }}
        title={`${ev.text} (${indexLabel}) · ${range}${sp.startsPeriod ? '' : ' · 앞 달에서 이어짐'}${sp.endsPeriod ? '' : ' · 다음 달로 이어짐'} - 누르면 고치기`}
      >
        {p.multiOn && <input type="checkbox" checked={allPicked} readOnly tabIndex={-1} className="inline-block align-middle mr-1.5 pointer-events-none" />}
        {label && c && (
          <span
            className="inline-block align-middle mr-1.5 text-2xs font-bold px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap"
            style={{
              backgroundColor: allDone ? 'var(--color-slate-100)' : c.bg,
              color: allDone ? 'var(--color-slate-400)' : c.text,
              border: '1px solid ' + (allDone ? 'var(--color-slate-200)' : c.border),
            }}
          >
            {label.name}
          </span>
        )}
        <span className={`inline align-middle ${allDone ? 'line-through text-slate-400' : ''}`}>{ev.text}</span>
        <span data-year-period-range className="inline-block align-middle ml-1.5 text-2xs font-semibold text-slate-500 whitespace-nowrap">
          {sp.startsPeriod ? '' : '◂ '}📆 {range} ({indexLabel}){sp.endsPeriod ? '' : ' ▸'}
        </span>
        <LinksButton ev={ev} onOpen={p.onOpenLinks} />
        {!p.multiOn && <DeleteButton onDelete={() => p.onDelete(ev, sp.cells[0].date)} />}
      </div>
    );
  };

  const renderEvent = (ev: ItemDoc, d: string) => {
    const label = firstLabel(ev);
    const c = label ? labelColor(label.color) : null;
    const done = doneOnDay(ev, d);
    const picked = isPicked(ev.id, d);
    return (
      <div
        key={ev.id}
        data-year-event={ev.id}
        data-year-event-done={done ? '1' : '0'}
        data-event-picked={picked ? '1' : undefined}
        {...eventDragProps(ev, d, p.dragEnabled, p.onDragEnd)}
        onClick={(e) => {
          stop(e);
          p.onEventClick(ev, d, e);
        }}
        className={`group/ev relative px-1.5 py-1 rounded-lg ${BODY_TEXT.month} leading-snug transition-all border block hover:shadow-sm cursor-pointer break-words ${
          picked ? 'bg-primary/10 border-primary text-primary' : done ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-200 text-slate-700 font-medium'
        }`}
        title="누르면 오른쪽 칸에서 고치기"
      >
        {p.multiOn && <input type="checkbox" checked={picked} readOnly tabIndex={-1} className="inline-block align-middle mr-1.5 pointer-events-none" />}
        {/* 라벨 칩 = 완료 (V4 그대로) */}
        {label && c && !p.multiOn && (
          <span
            data-year-event-chip={ev.id}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              stop(e);
              p.onToggleDone(ev, d);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              stop(e);
              p.onToggleDone(ev, d);
            }}
            title={done ? '눌러서 완료 풀기' : '눌러서 완료'}
            className="inline-block align-middle mr-1.5 text-2xs font-bold px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap cursor-pointer"
            style={{
              backgroundColor: done ? 'var(--color-slate-100)' : c.bg,
              color: done ? 'var(--color-slate-400)' : c.text,
              border: '1px solid ' + (done ? 'var(--color-slate-200)' : c.border),
            }}
          >
            {label.name}
          </span>
        )}
        <span className={`inline align-middle ${done ? 'line-through text-slate-400' : ''}`}>{ev.text}</span>
        <LinksButton ev={ev} onOpen={p.onOpenLinks} />
        {!p.multiOn && <DeleteButton onDelete={() => p.onDelete(ev, d)} />}
      </div>
    );
  };

  return (
    <div
      data-year-month={p.m.key}
      data-year-month-open={p.isOpen ? '1' : '0'}
      // 둘째 줄 날짜를 누르면 오늘로 (app/todayScroll) - 오늘 일정이 없어 그날 줄이 없거나 달을 접었으면 이 달로
      data-today-area={p.isCurrentMonth ? 'true' : undefined}
      className={`bg-white rounded-2xl border shadow-sm flex flex-col transition-all ${p.isMobile ? 'p-2.5' : 'p-4 sm:p-5'} ${p.isMobile && p.isOpen ? 'col-span-2' : ''} ${
        p.isCurrentMonth ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200/80 hover:shadow-md'
      }`}
    >
      <button
        type="button"
        data-year-month-toggle={p.m.key}
        onClick={() => p.isMobile && p.onToggleMonth(p.m.key, !p.isCurrentMonth)}
        className={`text-center font-black text-blue-800 ${SECTION_TITLE} flex items-center justify-center gap-2 ${p.isOpen ? 'mb-4 pb-2 border-b-2 border-blue-100' : ''} ${
          p.isMobile ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {p.isMobile && <span className="text-xs text-slate-400">{p.isOpen ? '▼' : '▶'}</span>}
        <span>{p.m.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg">{p.m.semester}학기</span>
        {!p.isOpen && <span className="text-xs font-bold text-slate-400">{activeDays.length > 0 ? `${activeDays.length}일` : '비어 있음'}</span>}
      </button>

      {/* 접은 달은 아예 그리지 않는다 (V4 - 감춰 그리던 것이 요소의 90%였다) */}
      {p.isOpen && (
        <div className="flex flex-col gap-3 flex-1">
          {activeDays.length > 0 ? (
            activeDays.map((d) => {
              const holiday = holidayOf(d);
              const tone = dayToneOf(d, holiday);
              const isToday = d === p.today;
              const notes = p.noteCounts.get(d) ?? 0;
              const evs = eventsOn(d);
              const starts = startsOn.get(d) ?? [];
              return (
                <div
                  key={d}
                  data-year-day={d}
                  data-today={isToday ? 'true' : undefined}
                  {...(p.dropHandlers ? dropTargetProps(p.dropHandlers, d) : {})}
                  className={`flex flex-col gap-1.5 p-2 -mx-2 rounded-xl border-b border-dashed border-slate-200 last:border-0 ${DAY_CELL_BG[tone]} ${isToday ? 'ring-1 ring-primary/40 border-solid' : ''} ${p.overDate === d ? DROP_TARGET_CLASS : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 min-w-0">
                    <button
                      type="button"
                      data-year-day-label={d}
                      onClick={() => p.onDateClick(d)}
                      title="그날 하루 화면"
                      className={`font-black cursor-pointer hover:underline flex flex-wrap items-center gap-1 text-xs min-w-0 ${DAY_NUMBER_COLOR[tone]}`}
                    >
                      <span className="shrink-0">
                        {Number(d.slice(8, 10))}일 ({DAY_NAMES[new Date(`${d}T00:00:00`).getDay()]})
                      </span>
                      {isToday && <span className="text-2xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full ml-1 shrink-0">오늘</span>}
                      {holiday && <HolidayName name={holiday} tier="month" fill={false} className="ml-1 bg-red-50 border border-red-100 px-1 py-0.5 rounded" />}
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {notes > 0 && (
                        <button
                          type="button"
                          data-year-notes={notes}
                          onClick={(e) => {
                            stop(e);
                            p.onOpenNotes(d);
                          }}
                          title={`기록 ${notes}건 보기`}
                          aria-label={`기록 ${notes}건 보기`}
                          className="inline-flex items-center gap-px px-1 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-2xs font-bold leading-none hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
                        >
                          <span aria-hidden>📝</span>
                          <span>{notes}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-year-add={d}
                        onClick={(e) => {
                          stop(e);
                          p.onAdd(d);
                        }}
                        title="이 날 새 일정 (오른쪽 칸)"
                        className="text-2xs font-bold text-slate-400 hover:text-primary bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        + 일정
                      </button>
                    </div>
                  </div>
                  {(starts.length > 0 || evs.length > 0) && (
                    <div className="flex flex-col gap-1">
                      {starts.map(renderPeriod)}
                      {evs.map((ev) => renderEvent(ev, d))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div data-year-month-empty className="text-center text-slate-400 text-xs py-8 font-semibold">
              기록된 일정이 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(YearMonthCard);

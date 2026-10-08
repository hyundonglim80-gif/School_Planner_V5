// 년간 화면 (V4 features/year/YearScreen.tsx). 학년도(3월~이듬해 2월) 열두 달 - 둘째 줄의 학기 칩으로 1·2학기만.
//   - 📅 학사력: 열두 달을 작은 달력 한 장으로(점·가는 막대, 달 아래 목록). 📋 자세히: 일정이 있는 날만 줄로(고치기·완료·여러 개 고르기).
//     고른 보기는 이 기기에 남는다(year/prefs).
//   - 열두 달을 한 판에 그리면 화면이 1초 넘게 굳는다(V4) - 세 달씩 프레임마다 나눠 그린다. 달 카드는 memo.
//   - 자료는 기기 사본에서(그 학년도 범위). '달력' 속성을 켠 일정만(월간과 같은 calendarEvents).
//   - 오늘 칸 data-today, 이번 달 data-today-area (app/todayScroll).
//   - 자세히에서 일정을 끌어 다른 날 줄에 놓으면 옮긴다(P5-3). 인쇄(🖨️ 학사력 A4 가로)는 P6-3, 학사일정은 P6-3, 자세히의 수업 칩은 P6-1.
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { setDate, setScope, useNav } from '../../app/nav';
import { academicYearOf, academicYearRange } from '../../domain/dateUtils';
import { onPeriodDay } from '../../domain/period';
import type { ShownPeriod } from '../../domain/periodBars';
import { academicMonths, monthWeeks, type AcademicMonth } from '../../domain/yearSheet';
import { itemsBetween, useDocs, useLabelTree, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { useIsMobile } from '../../ui/useIsMobile';
import { useToday } from '../../ui/useToday';
import { deleteEvent, setEventDone } from '../events/actions';
import EventDeleteChooser from '../events/EventDeleteChooser';
import { useEventDrop } from '../events/drag';
import EventMoveChooser from '../events/EventMoveChooser';
import { doneOnDay, isGrouped, type ItemDoc } from '../events/eventOps';
import { pickKey, pickRange, togglePick, useMulti, type EventPick } from '../events/multi';
import { openEventPanel } from '../events/open';
import { openLinkViewer } from '../links/open';
import { calendarEvents, type CalendarEvents } from '../month/calendarEvents';
import { openDayNotes } from '../notes/open';
import { setYearView, useYearView, type YearView } from './prefs';
import YearMonthCard from './YearMonthCard';
import YearSheetMonth from './YearSheetMonth';

/** 한 번에 그릴 달의 수 (V4 MONTHS_PER_FRAME) */
const MONTHS_PER_FRAME = 3;

const VIEWS: ReadonlyArray<readonly [YearView, string, string]> = [
  ['sheet', '📅 학사력', '열두 달을 작은 달력 한 장으로 (달력 일정·기간 일정)'],
  ['detail', '📋 자세히', '날마다 일정을 모두 (고치기·완료·여러 개 고르기)'],
];

/** 학사력 아래 범례 (공휴일·D-Day는 P5-3, 학사일정은 P6-3에서 더한다) */
const LEGEND = (
  <span className="hidden sm:flex items-center gap-2.5 text-2xs font-bold text-slate-500" data-year-legend>
    <span className="flex items-center gap-1">
      <span className="w-[6px] h-[6px] rounded-full bg-blue-400" />
      달력 일정(라벨 빛깔)
    </span>
    <span className="flex items-center gap-1">
      <span className="w-[14px] h-[3px] rounded-full bg-blue-400" />
      기간 일정
    </span>
  </span>
);

const EMPTY: ReadonlySet<string> = new Set();
const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};

/** 그 달에 보이는 일정 (Shift 범위 고르기의 차례 - 날짜 차례, 그날은 기간 → 일정) */
function visiblePicks(months: readonly AcademicMonth[], cal: CalendarEvents, showWeekend: boolean): EventPick[] {
  const out: EventPick[] = [];
  for (const m of months)
    for (const d of monthWeeks(m.year, m.month, showWeekend).flat())
      if (d) for (const ev of [...cal.periods.filter((p) => onPeriodDay(p, d)), ...(cal.byDate.get(d) ?? [])]) out.push({ id: ev.id, day: d });
  return out;
}

export default function YearScreen() {
  const sid = useCurrentSpaceId();
  const date = useNav((s) => s.date);
  const showWeekend = useNav((s) => s.showWeekend);
  const showEvents = useNav((s) => s.showEvents);
  const semesterFilter = useNav((s) => s.semesterFilter);
  const view = useYearView((s) => s.view);
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const status = useMirrorStatus('items');
  const today = useToday();
  const multi = useMulti();
  const isMobile = useIsMobile();
  const drop = useEventDrop(sid);
  const [scopeFor, setScopeFor] = useState<{ item: ItemDoc; day: string } | null>(null);

  const academicYear = academicYearOf(date);
  const [from, to] = academicYearRange(academicYear);
  const months = useMemo(() => academicMonths(academicYear).filter((m) => semesterFilter === 'all' || m.semester === semesterFilter), [academicYear, semesterFilter]);
  const cal = useMemo(() => calendarEvents(items, from, to, tree), [items, from, to, tree]);
  const noteCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of itemsBetween(items, from, to, 'note')) map.set(n.date!, (map.get(n.date!) ?? 0) + 1);
    return map;
  }, [items, from, to]);
  const thisMonth = today.slice(0, 7);

  // 세 달씩 나눠 그린다 - 학년도·학기·보기가 바뀌면 처음부터 (V4: 한 흐름 안에서 끝까지 걸어간다 - 둘로 나누면 서로 물려 멈췄다)
  const runKey = `${academicYear}|${semesterFilter}|${view}`;
  const [shown, setShown] = useState({ key: runKey, n: MONTHS_PER_FRAME });
  let shownCount = shown.n;
  if (shown.key !== runKey) {
    shownCount = MONTHS_PER_FRAME;
    setShown({ key: runKey, n: MONTHS_PER_FRAME });
  }
  useEffect(() => {
    if (shownCount >= months.length) return;
    const id = requestAnimationFrame(() => setShown((s) => (s.key === runKey ? { key: runKey, n: Math.min(s.n + MONTHS_PER_FRAME, months.length) } : s)));
    return () => cancelAnimationFrame(id);
  }, [shownCount, runKey, months.length]);

  // 휴대폰 자세히: 이번 달만 펼친다. 사용자가 누른 달만 적는다
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleMonth = useCallback((key: string, defaultCollapsed: boolean) => setCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultCollapsed) })), []);

  // 달 카드에 넘기는 일은 늘 같은 함수 (memo가 살도록) - 그때그때의 값은 latest에서
  const latest = useRef({ sid, months, cal, showWeekend });
  useEffect(() => {
    latest.current = { sid, months, cal, showWeekend };
  });

  const goDay = useCallback((d: string) => {
    setDate(d);
    setScope('day');
  }, []);
  const goMonth = useCallback((m: AcademicMonth) => {
    const cur = useNav.getState().date;
    setDate(cur.startsWith(m.key) ? cur : `${m.key}-01`);
    setScope('month');
  }, []);
  const openEvent = useCallback((ev: ItemDoc, d: string) => {
    const s = latest.current.sid;
    if (s) openEventPanel({ sid: s, date: d, id: ev.id });
  }, []);
  const addEvent = useCallback((d: string) => {
    const s = latest.current.sid;
    if (s) openEventPanel({ sid: s, date: d });
  }, []);
  const openNotes = useCallback((d: string) => {
    const s = latest.current.sid;
    if (s) openDayNotes({ sid: s, date: d });
  }, []);
  const openLinks = useCallback((ev: ItemDoc) => {
    const s = latest.current.sid;
    if (s) openLinkViewer({ sid: s, id: ev.id });
  }, []);
  const eventClick = useCallback(
    (ev: ItemDoc, d: string, e: ReactMouseEvent) => {
      const p = { id: ev.id, day: d };
      const { months: ms, cal: c, showWeekend: wk } = latest.current;
      if (e.shiftKey) pickRange(visiblePicks(ms, c, wk), p);
      else if (useMulti.getState().on || e.ctrlKey || e.metaKey) togglePick(p);
      else openEvent(ev, d);
    },
    [openEvent],
  );
  // 기간은 그 달에 든 날을 함께 고른다 (일부만 골라져 있으면 나머지를 더 - V4 그대로)
  const periodClick = useCallback(
    (sp: ShownPeriod<ItemDoc>, e: ReactMouseEvent) => {
      const s = useMulti.getState();
      if (!(s.on || e.ctrlKey || e.metaKey || e.shiftKey)) {
        openEvent(sp.item, sp.cells[0].date);
        return;
      }
      const has = (d: string) => s.on && s.picks.some((x) => x.id === sp.item.id && x.day === d);
      const all = sp.cells.every((c) => has(c.date));
      for (const c of sp.cells) if (all || !has(c.date)) togglePick({ id: sp.item.id, day: c.date });
    },
    [openEvent],
  );
  const toggleDone = useCallback((ev: ItemDoc, d: string) => {
    const s = latest.current.sid;
    if (s) void setEventDone(s, ev, !doneOnDay(ev, d), { day: d }).catch(quiet);
  }, []);
  const remove = useCallback((ev: ItemDoc, d: string) => {
    const s = latest.current.sid;
    if (!s) return;
    if (isGrouped(ev)) setScopeFor({ item: ev, day: d });
    else void deleteEvent(s, ev).catch(quiet);
  }, []);

  const pickedFor = (m: AcademicMonth): ReadonlySet<string> => {
    const keys = multi.picks.filter((p) => p.day.startsWith(m.key)).map(pickKey);
    return keys.length ? new Set(keys) : EMPTY;
  };
  const visible = months.slice(0, shownCount);
  const waiting = (status === 'idle' || status === 'loading') && Object.keys(items).length === 0;

  return (
    <div data-screen="year" data-year={academicYear} className="animate-fade-in pb-12">
      <div className="flex flex-wrap items-center gap-2 mb-3" data-print-hide>
        <div className="inline-flex bg-slate-100 p-0.5 rounded-xl gap-0.5" role="group" aria-label="년간 보기">
          {VIEWS.map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              data-year-view={v}
              aria-pressed={view === v}
              onClick={() => setYearView(v)}
              title={hint}
              className={`px-2.5 py-1 text-xs rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${view === v ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'sheet' && LEGEND}
      </div>

      {waiting ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" data-year-waiting>
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary" />
          <p className="text-xs text-slate-400 font-medium">데이터를 불러오는 중...</p>
        </div>
      ) : view === 'sheet' ? (
        <div data-year-sheet className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 items-start">
          {visible.map((m) => (
            <YearSheetMonth
              key={m.key}
              m={m}
              cal={cal}
              tree={tree}
              showWeekend={showWeekend}
              showEvents={showEvents}
              isCurrentMonth={m.key === thisMonth}
              today={today}
              onDateClick={goDay}
              onMonthClick={goMonth}
              onOpenEvent={openEvent}
            />
          ))}
        </div>
      ) : (
        // 휴대폰에서도 두 열 (한 열이면 접힌 달 머리글 열두 개가 세로로 쌓인다 - V4)
        <div data-year-detail className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
          {visible.map((m) => {
            const isCurrent = m.key === thisMonth;
            return (
              <YearMonthCard
                key={m.key}
                m={m}
                cal={cal}
                tree={tree}
                noteCounts={noteCounts}
                showWeekend={showWeekend}
                showEvents={showEvents}
                isMobile={isMobile}
                isOpen={!isMobile || (collapsed[m.key] ?? !isCurrent) === false}
                isCurrentMonth={isCurrent}
                today={today}
                picked={pickedFor(m)}
                multiOn={multi.on}
                onToggleMonth={toggleMonth}
                onDateClick={goDay}
                onAdd={addEvent}
                onOpenNotes={openNotes}
                onEventClick={eventClick}
                onPeriodClick={periodClick}
                onToggleDone={toggleDone}
                onDelete={remove}
                onOpenLinks={openLinks}
                dropHandlers={drop.handlers}
                dragEnabled={drop.dragEnabled}
                onDragEnd={drop.clearOver}
                overDate={drop.overDate?.startsWith(m.key) ? drop.overDate : null}
              />
            );
          })}
        </div>
      )}
      {scopeFor && sid && <EventDeleteChooser sid={sid} item={scopeFor.item} day={scopeFor.day} onClose={() => setScopeFor(null)} />}
      {drop.pending && sid && <EventMoveChooser sid={sid} {...drop.pending} onClose={drop.cancel} />}
    </div>
  );
}

// 월간 화면 (V4 features/month/MonthScreen.tsx). 날짜·◀▶는 둘째 줄. 자료는 기기 사본에서(그 달 달력의 날 범위).
//   - '달력' 속성을 켠 일정만 올린다(V4 그대로) - 하루짜리는 칸에, 기간 일정은 막대(항목의 date ~ endDate 그대로).
//   - PC: 칸 빈 곳 = 그날 하루 화면, 일정 = 오른쪽 일정 칸, 라벨 칩 = 완료, + = 그날 새 일정, 📝 n = 그날 기록 창.
//   - 휴대폰: 날짜를 누르면 아래에 그날 목록(MonthDaySheet), 같은 날을 한 번 더 누르면 하루 화면.
//   - 오늘 칸 data-today, 이번 주 줄 data-today-area (app/todayScroll).
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { setDate, setScope, useNav } from '../../app/nav';
import { monthGridDates } from '../../domain/dateUtils';
import { onPeriodDay } from '../../domain/period';
import { itemLabels, itemsOn, useDocs, useLabelTree } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { useIsMobile } from '../../ui/useIsMobile';
import { useToday } from '../../ui/useToday';
import { deleteEvent, setEventDone } from '../events/actions';
import EventDeleteChooser from '../events/EventDeleteChooser';
import { doneOnDay, isGrouped, type ItemDoc } from '../events/eventOps';
import { pickRange, togglePick, useMulti, type EventPick } from '../events/multi';
import { openEventPanel } from '../events/open';
import { openLinkViewer } from '../links/open';
import { openDayNotes } from '../notes/open';
import { calendarEvents } from './calendarEvents';
import MonthDaySheet from './MonthDaySheet';
import MonthGrid from './MonthGrid';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};

export default function MonthScreen() {
  const sid = useCurrentSpaceId();
  const date = useNav((s) => s.date);
  const showWeekend = useNav((s) => s.showWeekend);
  const showEvents = useNav((s) => s.showEvents);
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const today = useToday();
  const multi = useMulti();
  const isMobile = useIsMobile();
  const [scopeFor, setScopeFor] = useState<{ item: ItemDoc; day: string } | null>(null);

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const monthKey = date.slice(0, 7);
  const dates = useMemo(() => monthGridDates(year, month), [year, month]);
  const cal = useMemo(() => calendarEvents(items, dates[0], dates[dates.length - 1], tree), [items, dates, tree]);
  const eventsOn = (d: string) => cal.byDate.get(d) ?? [];

  // 휴대폰: 날짜를 누르면 아래 그날 목록, 같은 날을 한 번 더 = 하루 화면. 달을 넘기거나 넓어지면 닫는다
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState(`${monthKey}|${isMobile}`);
  if (sheetFor !== `${monthKey}|${isMobile}`) {
    setSheetFor(`${monthKey}|${isMobile}`);
    setSheetDate(null);
  }

  const goDay = (d: string) => {
    setDate(d);
    setScope('day');
  };
  const selectDate = (d: string) => {
    if (isMobile && sheetDate !== d) {
      setSheetDate(d);
      return;
    }
    goDay(d);
  };

  const visiblePicks = (): EventPick[] =>
    dates.flatMap((d) => [...eventsOn(d), ...cal.periods.filter((p) => onPeriodDay(p, d))].map((ev) => ({ id: ev.id, day: d })));
  const eventClick = (ev: ItemDoc, day: string, e: ReactMouseEvent) => {
    const p = { id: ev.id, day };
    if (e.shiftKey) pickRange(visiblePicks(), p);
    else if (multi.on || e.ctrlKey || e.metaKey) togglePick(p);
    // 휴대폰: 칸 안 일정은 작아 겨누기 어렵다 - 그날 목록을 연다 (V4 ROADMAP 15)
    else if (isMobile) selectDate(day);
    else if (sid) openEventPanel({ sid, date: day, id: ev.id });
  };
  const toggleDone = (ev: ItemDoc, day: string) => sid && void setEventDone(sid, ev, !doneOnDay(ev, day), { day }).catch(quiet);
  const remove = (ev: ItemDoc, day: string) => {
    if (!sid) return;
    if (isGrouped(ev)) setScopeFor({ item: ev, day });
    else void deleteEvent(sid, ev).catch(quiet);
  };

  const sheetEvents = sheetDate ? [...eventsOn(sheetDate), ...cal.periods.filter((p) => onPeriodDay(p, sheetDate))] : [];
  const sheetHidden = sheetDate ? itemsOn(items, sheetDate, 'event').length - sheetEvents.length : 0;

  return (
    <div data-screen="month" className={`animate-fade-in ${sheetDate ? 'pb-[48vh]' : 'pb-12'}`}>
      <MonthGrid
        dates={dates}
        month={monthKey}
        today={today}
        showWeekend={showWeekend}
        showEvents={showEvents}
        compact={isMobile}
        selectedDate={sheetDate}
        eventsOn={eventsOn}
        periods={cal.periods}
        noteCount={(d) => itemsOn(items, d, 'note').length}
        labelsOf={(ev) => itemLabels(tree, ev.labelIds)}
        pickedOn={(d) => new Set(multi.picks.filter((p) => p.day === d).map((p) => p.id))}
        multiOn={multi.on}
        onSelectDate={selectDate}
        onAdd={(d) => sid && openEventPanel({ sid, date: d })}
        onOpenNotes={(d) => sid && openDayNotes({ sid, date: d })}
        onEventClick={eventClick}
        onToggleDone={toggleDone}
        onDelete={remove}
        onOpenLinks={(ev) => sid && openLinkViewer({ sid, id: ev.id })}
      />
      {isMobile && sheetDate && (
        <MonthDaySheet
          date={sheetDate}
          events={sheetEvents}
          hiddenCount={sheetHidden}
          showEvents={showEvents}
          labelsOf={(ev) => itemLabels(tree, ev.labelIds)}
          onClose={() => setSheetDate(null)}
          onGoDay={() => goDay(sheetDate)}
          onAdd={() => sid && openEventPanel({ sid, date: sheetDate })}
          onOpenEvent={(ev) => sid && openEventPanel({ sid, date: sheetDate, id: ev.id })}
          onToggleDone={multi.on ? undefined : (ev) => toggleDone(ev, sheetDate)}
        />
      )}
      {scopeFor && sid && <EventDeleteChooser sid={sid} item={scopeFor.item} day={scopeFor.day} onClose={() => setScopeFor(null)} />}
    </div>
  );
}

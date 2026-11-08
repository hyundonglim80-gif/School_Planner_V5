// 요일 카드 줄 (P24-2 - 주간 화면 grid()를 떼어 주간·한눈에가 함께 쓴다).
//   훅 하나가 셈(일정·라벨 트리·이월·겹친 공간·조사표 수·수업 줄·진도)과 손잡이(여러 개 고르기·끌어 옮기기·지우기)를 들고,
//   grid(보이는 날들, 고를 것)가 카드 줄을 그린다 - 주간은 이번 주·다음 주 두 줄, 한눈에는 첫 칸(달력) + 한 주.
//   끌어 옮기기는 훅 하나(useEventDrop)라 이번 주 줄에서 다음 주 줄로도 끈다. 묻는 창(지우기 범위·옮기기 범위)은 dialogs를 화면에 한 번.
//   수업 줄은 셈할 날들(days)을 한 번에 - 요일끼리 교시 줄 수가 같다(보이는 줄마다 7교시 보충이 있으면 그만큼).
//   주간만의 것(다음 주 줄·작년 이맘때·주간학습안내)은 주간 화면에 - 작년 칸은 extra로 카드 아래에 덧붙인다.
import { useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { setDate, setScope, useNav } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { periodStateAt, timesOf } from '../../domain/periodTimes';
import { itemLabels, itemsOn, useDocs, useHolidayVersion, useLabelTree, useOverlaySpaces, type OverlaySpace } from '../../data/select';
import { useClock } from '../../ui/useClock';
import { deleteEvent, setEventDone } from '../events/actions';
import EventDeleteChooser from '../events/EventDeleteChooser';
import { useEventDrop } from '../events/drag';
import EventMoveChooser from '../events/EventMoveChooser';
import { doneOnDay, isGrouped, orderAfter, type ItemDoc } from '../events/eventOps';
import { useCarried } from '../events/forward';
import { pickRange, togglePick, useMulti, type EventPick } from '../events/multi';
import { openEventPanel } from '../events/open';
import { useEvalCountsByDate } from '../evaluations/evalData';
import { openLessonPanel } from '../lessons/open';
import { useClassColorOf, useTeaching } from '../lessons/teaching';
import { useLessonsFor } from '../lessons/useLessons';
import WeekLessonRows from '../lessons/WeekLessonRows';
import { lessonLinkId } from '../links/linkOps';
import { openLinkViewer } from '../links/open';
import { openDayNotes } from '../notes/open';
import { useProgressMarks } from '../progress/useProgress';
import WeekDayCard from './WeekDayCard';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};

/** 요일 수에 따라 칸 수 (본문 폭 @container - 오른쪽 칸이 열리면 그만큼 접는다, V4 그대로) */
export const weekGridClass = (n: number) =>
  'grid grid-cols-2 @min-[720px]:grid-cols-3 ' + (n === 5 ? '@min-[1200px]:grid-cols-5' : '@min-[980px]:grid-cols-4 @min-[1200px]:grid-cols-7') + ' gap-2 sm:gap-3';

export interface WeekGridOptions {
  /** 칸 줄 class (주지 않으면 주간 칸 수 - weekGridClass) */
  className?: string;
  /** 칸 줄 style */
  style?: CSSProperties;
  /** 요일 카드 앞 첫 칸 (한눈에 - 작은 달력) */
  lead?: ReactNode;
  /** 요일 카드 빈 곳을 누르면 (주지 않으면 그날 하루 화면) */
  onOpenDay?: (day: string) => void;
  /** 요일 카드 빈 곳 title */
  openDayTitle?: string;
  /** 고른 날 (테두리 - 한눈에) */
  selected?: string;
  /** 카드가 칸 높이에 맞추고 넘치면 카드 안에서 스크롤 (한눈에 - 두 줄이 반씩) */
  fill?: boolean;
  /** 카드 아래 덧붙임 (주간 - 작년 이맘때) */
  extra?: (day: string) => ReactNode;
}

/**
 * 요일 카드 줄의 셈과 손잡이.
 * @param date 반 색(교과 모드)을 고르는 날 - 보는 날
 * @param days 셈할 날들 (수업 줄·겹친 공간 - 그리는 줄들을 모두 덮는다)
 */
export function useWeekCards(sid: string | null, date: string, days: readonly string[]) {
  const evalCounts = useEvalCountsByDate(sid);
  const showEvents = useNav((s) => s.showEvents);
  const showClass = useNav((s) => s.showClass);
  const items = useDocs('items', sid);
  const eventTree = useLabelTree('event', sid);
  const carried = useCarried(sid);
  const today = carried.today;
  const overlays = useOverlaySpaces();
  const holidays = useHolidayVersion();
  const multi = useMulti();
  const drop = useEventDrop(sid);
  const [scopeFor, setScopeFor] = useState<{ item: ItemDoc; day: string } | null>(null);

  // ─── 수업 (P6-1) - 셈할 날들을 함께. 교시 줄 수는 보이는 요일끼리 같게(7교시 보충이 있으면 그만큼) ───
  const lessons = useLessonsFor(days, sid);
  const periodDefs = useCommonSettings((s) => s.periods);
  const times = useMemo(() => timesOf(periodDefs), [periodDefs]);
  const nowMs = useClock(showClass && days.includes(today));
  const { isClassUnit } = useTeaching();
  const classColorOf = useClassColorOf(date, sid);
  // 진도 (P6-2) - 셈하는 마지막 날까지 (개인 공간에서만 겹친다)
  const { marks } = useProgressMarks(days[days.length - 1]);
  const rowsOf = (shown: readonly string[]) => Math.max(periodDefs.length, ...shown.map((d) => lessons[d]?.cells.length ?? 0));
  const lessonRows = (day: string, rows: number) => {
    const view = lessons[day];
    if (!showClass || !view || !sid) return undefined;
    const state = day === today ? periodStateAt(times, new Date(nowMs), rows) : null;
    return (
      <WeekLessonRows
        date={day}
        view={view}
        rows={rows}
        nowPeriod={state?.kind === 'during' ? state.period : null}
        isClassUnit={isClassUnit}
        classColorOf={classColorOf}
        marks={marks}
        onOpen={(n) => openLessonPanel({ sid, date: day, n })}
        onLinks={(n) => openLinkViewer({ sid, id: lessonLinkId(day, n) })}
      />
    );
  };

  const eventsOf = (day: string) => itemsOn(items, day, 'event');
  // 겹친 공간 그날 일정 (셈할 날들 - 공간마다 그 공간 문서에서) + 항목 → 공간
  const overlayDays = useMemo(() => {
    void holidays;
    const byDay = new Map<string, ItemDoc[]>();
    const spaceOf = new Map<ItemDoc, OverlaySpace>();
    for (const o of overlays)
      for (const day of days)
        for (const ev of itemsOn(o.items, day, 'event')) {
          spaceOf.set(ev, o);
          byDay.set(day, [...(byDay.get(day) ?? []), ev]);
        }
    return { byDay, spaceOf };
  }, [overlays, days, holidays]);
  const spaceOf = (ev: ItemDoc) => overlayDays.spaceOf.get(ev);
  const sidOf = (ev: ItemDoc) => spaceOf(ev)?.sid ?? sid;

  // ─── 일정 ───
  const visiblePicks = (shown: readonly string[]): EventPick[] => shown.flatMap((d) => eventsOf(d).map((ev) => ({ id: ev.id, day: d })));
  const eventClick = (ev: ItemDoc, day: string, shown: readonly string[], e: ReactMouseEvent) => {
    const p = { id: ev.id, day };
    const space = spaceOf(ev);
    // 겹친 일정은 고르기에 들지 않는다 - 고르는 동안은 눌러도 아무 일 없음
    if (space) {
      if (!multi.on) openEventPanel({ sid: space.sid, date: day, id: ev.id });
      return;
    }
    if (e.shiftKey) pickRange(visiblePicks(shown), p);
    else if (multi.on || e.ctrlKey || e.metaKey) togglePick(p);
    else if (sid) openEventPanel({ sid, date: day, id: ev.id });
  };
  const toggleDone = (ev: ItemDoc, day: string, isCarried: boolean) => {
    const space = spaceOf(ev);
    if (space) {
      void setEventDone(space.sid, ev, !doneOnDay(ev, day), { day }).catch(quiet);
      return;
    }
    if (!sid) return;
    // 따라오던 일정을 오늘 칸에서 끝내면 오늘로 옮겨 적는다 (하루 화면과 같다)
    if (isCarried) void setEventDone(sid, ev, true, { carried: { today, order: orderAfter(eventsOf(today)) } }).catch(quiet);
    else void setEventDone(sid, ev, !doneOnDay(ev, day), { day }).catch(quiet);
  };
  const remove = (ev: ItemDoc, day: string) => {
    if (!sid) return;
    if (isGrouped(ev)) setScopeFor({ item: ev, day });
    else void deleteEvent(sid, ev).catch(quiet);
  };

  const grid = (shown: readonly string[], opts: WeekGridOptions = {}) => {
    const rows = rowsOf(shown);
    const openDay =
      opts.onOpenDay ??
      ((day: string) => {
        setDate(day);
        setScope('day');
      });
    return (
      <div data-week-grid className={opts.className ?? weekGridClass(shown.length)} style={{ ['--week-cols' as string]: shown.length, ...opts.style }}>
        {opts.lead}
        {shown.map((day) => {
          const pickedHere = new Set(multi.picks.filter((p) => p.day === day).map((p) => p.id));
          return (
            <WeekDayCard
              key={day}
              date={day}
              today={today}
              events={eventsOf(day)}
              carried={day === today ? carried.list : undefined}
              overlay={overlayDays.byDay.get(day)}
              spaceOf={spaceOf}
              noteCount={itemsOn(items, day, 'note').length}
              evalCount={evalCounts[day] ?? 0}
              sid={sid}
              showEvents={showEvents}
              lessons={lessonRows(day, rows)}
              labelsOf={(ev) => itemLabels(spaceOf(ev)?.tree ?? eventTree, ev.labelIds)}
              pickedIds={pickedHere}
              multiOn={multi.on}
              selected={opts.selected === day}
              fill={opts.fill}
              openDayTitle={opts.openDayTitle}
              onOpenDay={() => openDay(day)}
              onAdd={() => sid && openEventPanel({ sid, date: day })}
              onOpenNotes={() => sid && openDayNotes({ sid, date: day })}
              onEventClick={(ev, e) => eventClick(ev, day, shown, e)}
              onToggleDone={(ev, isCarried) => toggleDone(ev, day, isCarried)}
              onDelete={(ev) => remove(ev, day)}
              onOpenLinks={(ev) => {
                const s = sidOf(ev);
                if (s) openLinkViewer({ sid: s, id: ev.id });
              }}
              drop={{ handlers: drop.handlers, over: drop.overDate === day, dragEnabled: drop.dragEnabled, onDragEnd: drop.clearOver }}
              lastYear={opts.extra?.(day)}
            />
          );
        })}
      </div>
    );
  };

  const dialogs = (
    <>
      {scopeFor && sid && <EventDeleteChooser sid={sid} item={scopeFor.item} day={scopeFor.day} onClose={() => setScopeFor(null)} />}
      {drop.pending && sid && <EventMoveChooser sid={sid} {...drop.pending} onClose={drop.cancel} />}
    </>
  );

  return { grid, dialogs, today };
}

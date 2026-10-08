// 주간 화면 (V4 features/week/WeekScreen.tsx·WeekGrid.tsx). 한 주를 요일 카드로 - 날짜·◀▶는 둘째 줄(SecondRow).
//   - 본문 폭이 1200px 이상이면 요일이 한 줄로 서고 아래에 다음 주도 한 줄. 읽는 범위는 늘 두 주 - 기기 사본에서 고르므로 폭이 바뀌어도 다시 읽지 않는다.
//   - 🕰️ 작년 이맘때: 이번 주 줄의 카드 아래에 작년 학년도 같은 주 같은 요일(domain/lastYearWeek), 골라서 📥 올해로 가져오기.
//   - 주간학습안내·인쇄는 P6-3, 수업 칸은 P6-1, 끌어 옮기기는 P5-3, 공휴일은 P5-3.
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { setDate, setScope, useNav } from '../../app/nav';
import { addDays, weekDates } from '../../domain/dateUtils';
import { lastYearWeekOf } from '../../domain/lastYearWeek';
import { itemLabels, itemsOn, useDocs, useLabelTree } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { useMainWidth } from '../../ui/useMainWidth';
import { deleteEvent, setEventDone } from '../events/actions';
import EventDeleteChooser from '../events/EventDeleteChooser';
import { doneOnDay, isGrouped, orderAfter, type ItemDoc } from '../events/eventOps';
import { useCarried } from '../events/forward';
import { pickRange, togglePick, useMulti, type EventPick } from '../events/multi';
import { openEventPanel } from '../events/open';
import { openLinkViewer } from '../links/open';
import { openDayNotes } from '../notes/open';
import { importLastYear } from './actions';
import { existsThisYear, isImportableNote, pickKeyOf, type LastYearPick } from './lastYear';
import LastYearDay from './LastYearDay';
import { toggleLastYear, useShowLastYear } from './prefs';
import WeekDayCard from './WeekDayCard';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};

/** 요일 수에 따라 칸 수 (본문 폭 @container - 오른쪽 칸이 열리면 그만큼 접는다, V4 그대로) */
const gridClass = (n: number) =>
  'grid grid-cols-2 @min-[720px]:grid-cols-3 ' + (n === 5 ? '@min-[1200px]:grid-cols-5' : '@min-[980px]:grid-cols-4 @min-[1200px]:grid-cols-7') + ' gap-2 sm:gap-3';

export default function WeekScreen() {
  const sid = useCurrentSpaceId();
  const date = useNav((s) => s.date);
  const showWeekend = useNav((s) => s.showWeekend);
  const showEvents = useNav((s) => s.showEvents);
  const showLastYear = useShowLastYear((s) => s.on);
  const items = useDocs('items', sid);
  const eventTree = useLabelTree('event', sid);
  const noteTree = useLabelTree('note', sid);
  const carried = useCarried(sid);
  const today = carried.today;
  const multi = useMulti();
  const showNextWeek = useMainWidth() >= 1200;
  const [scopeFor, setScopeFor] = useState<{ item: ItemDoc; day: string } | null>(null);

  const thisWeek = useMemo(() => weekDates(date), [date]);
  const nextWeek = useMemo(() => weekDates(addDays(thisWeek[0], 7)), [thisWeek]);
  const visible = (days: string[]) => (showWeekend ? days : days.filter((d) => ![0, 6].includes(new Date(`${d}T00:00:00`).getDay())));
  const shownThis = visible(thisWeek);
  const shownNext = visible(nextWeek);

  // 작년 이맘때 (이번 주 줄에만)
  const lastYear = useMemo(() => lastYearWeekOf(thisWeek), [thisWeek]);
  // 고른 작년 항목 - 주·공간이 바뀌거나 끄면 풀린다
  const pickScope = `${lastYear?.label}|${sid}|${showLastYear}`;
  const [pickState, setPickState] = useState<{ scope: string; picks: Record<string, LastYearPick> }>({ scope: '', picks: {} });
  const picks = pickState.scope === pickScope ? pickState.picks : {};
  const pickedKeys = new Set(Object.keys(picks));
  const setPicks = (next: Record<string, LastYearPick>) => setPickState({ scope: pickScope, picks: next });
  const [importing, setImporting] = useState(false);

  const eventsOf = (day: string) => itemsOn(items, day, 'event');
  const lastYearOf = (day: string) => {
    const from = lastYear?.dateMap[day];
    if (!from) return null;
    return { from, events: showEvents ? itemsOn(items, from, 'event') : [], notes: itemsOn(items, from, 'note') };
  };

  const togglePickItem = (p: LastYearPick) => {
    const key = pickKeyOf(p);
    const next = { ...picks };
    if (next[key]) delete next[key];
    else next[key] = p;
    setPicks(next);
  };
  /** 보이는 요일의 작년 항목 중 고를 수 있는 것 모두 (올해 있는 것은 빼고) */
  const pickAll = () => {
    const next: Record<string, LastYearPick> = {};
    for (const day of shownThis) {
      const ly = lastYearOf(day);
      if (!ly) continue;
      for (const it of [...ly.events, ...ly.notes.filter(isImportableNote)]) {
        if (existsThisYear(items, it, day)) continue;
        const p = { item: it, toDate: day };
        next[pickKeyOf(p)] = p;
      }
    }
    setPicks(next);
  };
  const runImport = async () => {
    const list = Object.values(picks);
    if (!sid || list.length === 0 || importing) return;
    setImporting(true);
    try {
      await importLastYear(sid, items, list);
      setPicks({});
    } catch {
      // 안내는 저장 도우미가 했다 - 고른 것은 그대로 (다시 누를 수 있게, 같은 글은 건너뛴다)
    } finally {
      setImporting(false);
    }
  };

  // ─── 일정 ───
  const visiblePicks = (days: string[]): EventPick[] => days.flatMap((d) => eventsOf(d).map((ev) => ({ id: ev.id, day: d })));
  const eventClick = (ev: ItemDoc, day: string, days: string[], e: ReactMouseEvent) => {
    const p = { id: ev.id, day };
    if (e.shiftKey) pickRange(visiblePicks(days), p);
    else if (multi.on || e.ctrlKey || e.metaKey) togglePick(p);
    else if (sid) openEventPanel({ sid, date: day, id: ev.id });
  };
  const toggleDone = (ev: ItemDoc, day: string, isCarried: boolean) => {
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

  const grid = (days: string[], withLastYear: boolean) => (
    <div data-week-grid className={gridClass(days.length)} style={{ ['--week-cols' as string]: days.length }}>
      {days.map((day) => {
        const pickedHere = new Set(multi.picks.filter((p) => p.day === day).map((p) => p.id));
        const ly = withLastYear && showLastYear ? lastYearOf(day) : null;
        return (
          <WeekDayCard
            key={day}
            date={day}
            today={today}
            events={eventsOf(day)}
            carried={day === today ? carried.list : undefined}
            noteCount={itemsOn(items, day, 'note').length}
            showEvents={showEvents}
            labelsOf={(ev) => itemLabels(eventTree, ev.labelIds)}
            pickedIds={pickedHere}
            multiOn={multi.on}
            onOpenDay={() => {
              setDate(day);
              setScope('day');
            }}
            onAdd={() => sid && openEventPanel({ sid, date: day })}
            onOpenNotes={() => sid && openDayNotes({ sid, date: day })}
            onEventClick={(ev, e) => eventClick(ev, day, days, e)}
            onToggleDone={(ev, isCarried) => toggleDone(ev, day, isCarried)}
            onDelete={(ev) => remove(ev, day)}
            onOpenLinks={(ev) => sid && openLinkViewer({ sid, id: ev.id })}
            lastYear={
              ly && (
                <LastYearDay
                  lastDate={ly.from}
                  toDate={day}
                  events={ly.events}
                  notes={ly.notes}
                  existsThisYear={(it) => existsThisYear(items, it, day)}
                  eventLabels={(it) => itemLabels(eventTree, it.labelIds)}
                  noteLabels={(it) => itemLabels(noteTree, it.labelIds)}
                  picked={pickedKeys}
                  onTogglePick={togglePickItem}
                />
              )
            }
          />
        );
      })}
    </div>
  );

  const pickedCount = pickedKeys.size;
  const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

  return (
    <div data-screen="week" className="animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 mb-2 px-1">
        {showLastYear && lastYear && (
          <span data-last-year-label className="text-xs text-slate-500 min-w-0">
            작년 같은 주 · <strong className="font-bold text-slate-700">{lastYear.label}</strong>
          </span>
        )}
        {showLastYear &&
          (pickedCount > 0 ? (
            <span data-last-year-picks={pickedCount} className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-700">{pickedCount}개 고름</span>
              <button
                type="button"
                data-last-year-import
                disabled={importing}
                onClick={() => void runImport()}
                title="고른 작년 일정·기록을 올해 같은 요일에 복사합니다 (작년 것은 그대로)"
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 shadow-xs whitespace-nowrap cursor-pointer"
              >
                {importing ? '가져오는 중…' : '📥 올해로 가져오기'}
              </button>
              <button type="button" data-last-year-unpick onClick={() => setPicks({})} className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 whitespace-nowrap cursor-pointer">
                풀기
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-last-year-pick-all
              onClick={pickAll}
              title="보이는 요일의 작년 일정·기록을 모두 고릅니다 (올해 이미 있는 것은 빼고)"
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
            >
              모두 고르기
            </button>
          ))}
        <button
          type="button"
          data-last-year-toggle
          aria-pressed={showLastYear}
          onClick={toggleLastYear}
          title={showLastYear ? '작년 이맘때 숨기기' : '작년 학년도 같은 주의 일정·기록을 요일 카드 아래에 흐리게 보기'}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
            showLastYear ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          🕰️ 작년 이맘때
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* 날짜(둘째 줄)를 누르면 오늘로 - 오늘 카드가 없으면(주말을 감춘 토·일) 이번 주 (app/todayScroll) */}
        <div data-today-area={thisWeek.includes(today) ? 'true' : undefined} data-week-this>
          {grid(shownThis, true)}
        </div>
        {showNextWeek && (
          <section aria-label="다음 주" data-week-next>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs font-extrabold text-slate-500">다음 주</span>
              <span className="text-xs text-slate-400">
                {md(nextWeek[0])} ~ {md(nextWeek[6])}
              </span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>
            {grid(shownNext, false)}
          </section>
        )}
      </div>
      {scopeFor && sid && <EventDeleteChooser sid={sid} item={scopeFor.item} day={scopeFor.day} onClose={() => setScopeFor(null)} />}
    </div>
  );
}

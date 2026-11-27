// 하루 화면의 일정 칸 (V4 features/day/DayEvents.tsx).
//
// - 머리줄 `▼ 📅 일정 N [+ 추가] ……… ⚙️` (기록 칸과 같은 배치 - V4 사용자 결정).
// - 카드: 휴대폰 2열, PC 1열. 라벨 칩(누르면 완료 - 끝내면 칩 앞에 ✓, 라벨이 없으면 회색 ○ 칩 - P10-1) · ⏰ 알림 · ⏳ 기한 · 글 · 🔗 링크 수 · 첨부.
//   카드를 누르면 오른쪽 일정 칸(수정)이 열린다(카드 ✏️는 없다 - 11-24 메모 요청 #200, 누르기와 같은 일). 고치는 일정은 파란 테두리로 짚는다.
//   PC(마우스)의 ▲▼는 수업 카드처럼 카드 왼쪽 테두리에 걸친 손잡이(ui/cardTools ORDER_ARROWS_EDGE - #200, 자리를 차지하지 않는다).
// - 카드 / 목록(11-25 메모 요청 #204 - 머리 ☰/▦, 이 기기에 기억 dayView): 목록은 일정 하나 = 한 줄(휴대폰도 1열·글은 말줄임·첨부는 📎 n) -
//   누르기·완료 칩·⏰·▲▼·끌기·🗑️는 카드와 같다(🗑️는 줄 오른쪽 끝에 겹쳐 뜬다 - FLOAT_TOOLS_LIST).
// - ▲▼ 순서 = 옮긴 일정의 order 하나만 (features/events/eventOps reorderOps).
// - 이월(DESIGN 5-1 - 계산): 오늘 칸은 오늘 것 아래에 따라오는 일정을 '↪ 10/5부터'와 함께(▲▼는 각 무리 안에서),
//   지난 날 칸에서는 그 일정을 흐리게 '→ 오늘로'(누르면 오늘). 오늘 칸에서 끝내면 그날로 옮겨 적는다(eventOps carriedDoneChanges).
// - 여러 개 고르기(features/events/multi): Ctrl+누르기·Shift 범위·휴대폰 길게 누르기로 바로 시작, 고르는 동안 누르면 고르기·풀기(V4 그대로).
// - 쓰기마다 문서 하나, 되돌리기는 Ctrl+Z(완료·순서는 안내 없이 - V4도 띄우지 않았다).
// - 겹쳐 보기(P17-2 - 둘째 줄 공간 칩 Ctrl·길게 누르기): 주 공간 것 아래에 공간마다 구분 줄 '👥 그룹A n' + 그 공간 일정(그 공간 라벨 트리로, 카드 = 공간 색 배경).
//   누르기 = 그 공간 칸 · 라벨 칩 = 그 공간에 완료. ▲▼·끌기·고르기·🗑️·이월은 없다(주 공간 것만). 머리 수(data-event-count)는 주 공간 것만.
// - 구글 캘린더 겹쳐 보기(P36-4): 맨 뒤에 '📅 구글 캘린더 n' 구분 줄 + 읽기 전용 카드(점선 - 누르면 그 일정 창). 수에 넣지 않는다.
// 새로 쓰고 고치는 칸은 여기 없다 - 오른쪽 일정 칸(EventPanel) 하나로 어느 화면에서나 같게 (V4 그대로).
import { Suspense, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { lazyWithReload } from '../../app/lazyWithReload';
import { OfflineInlineWindow } from '../../app/OfflineChunk';
import { goToday } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { GRID_COLS, useCardCols } from '../../app/cardCols';
import { cappedColumns, useFitColumns } from '../../ui/useFitColumns';
import { useReorderToggle } from '../../ui/useReorderToggle';
import { openWindow } from '../../app/windows';
import { monthDayLabel, shortDateLabel } from '../../domain/dateUtils';
import { carriedSince } from '../../domain/forward';
import { periodPosition } from '../../domain/period';
import { spaceTitle } from '../../domain/spaceColor';
import { itemLabels, useItemsOn, useLabelTree, useMirrorStatus, useOverlayEventsOn, type OverlaySpace } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import type { YMD } from '../../data/types';
import { useLongPress } from '../../ui/longPress';
import { reorderDragProps } from '../../ui/reorderDrag';
import { deleteEvent, moveEventInList, setEventAlarm, setEventDone } from '../events/actions';
import DueBadge from '../events/DueBadge';
import EventDoneChip from '../events/EventDoneChip';
import { doneOnDay, isGrouped, orderAfter, type ItemDoc } from '../events/eventOps';
import { useCarried } from '../events/forward';
import { pickRange, togglePick, useMulti, type EventPick } from '../events/multi';
import DayPastEvents from './DayPastEvents';
import { openLinkViewer } from '../links/open';
import { openEventPanel, shownEventKey, useShownEventId, useShownEventKey } from '../events/open';
import { useFocusReveal } from '../search/focus';
import { shortcutTarget } from '../../ui/shortcutTarget';
import DecorSpot from '../../ui/DecorSpot';
import { useGcalShown } from '../gcal/gcalView';
import { pressKeys } from '../../ui/pressKeys';
import { FLOAT_TOOLS, FLOAT_TOOLS_LIST, ORDER_ARROWS_EDGE } from '../../ui/cardTools';
import { Glyph } from '../../ui/Icon';
import { useDayView } from './dayView';
import { isRowExpanded } from '../../domain/entryCollapse';
import { setEntryOpen, useEntryOpen } from '../notes/entryOpen';
import DayViewToggle from './DayViewToggle';

// 누를 때만 뜨는 창 - 열 때 받는다 (P49-3 첫 화면 JS)
const EventAlarmWindow = lazyWithReload(() => import('../events/EventAlarmWindow'), OfflineInlineWindow);
const EventDeleteChooser = lazyWithReload(() => import('../events/EventDeleteChooser'), OfflineInlineWindow);
// 구글 캘린더 일정이 그날 있을 때만 받는다 (P55-1 첫 화면 JS) - 끊겨 못 받으면 그리지 않는다
const GcalDayList = lazyWithReload(() => import('../gcal/GcalDayList'), () => null);

const NONE: readonly ItemDoc[] = [];

/** 그날 끝냈나 (기간 일정은 그날만) */
const doneOn = doneOnDay;

/** 목록의 맨 뒤 차례 값 (없으면 null) */
function lastOrderOf(list: readonly ItemDoc[]): string | null {
  let last: string | null = null;
  for (const d of list) if (d.order && (last === null || d.order > last)) last = d.order;
  return last;
}

const quiet = () => {
  /* 실패 안내는 저장 도우미가 이미 했다 */
};
const nothing = () => {};

/** 겹쳐 보는 공간 하나의 구분 줄 '👥 그룹A 2 ----'(이름은 공간 색 배경 - 카드와 같은 색) + 그 공간 카드 (휴대폰 2열에서도 줄은 한 줄을 다 쓴다) */
function OverlayGroup({ space, count, children }: { space: OverlaySpace; count: number; children: ReactNode }) {
  return (
    <>
      <div
        data-overlay-group={space.sid}
        title={`겹쳐 보는 공간 - 누르면 ${space.name} 공간에서 고칩니다`}
        className="col-span-full flex items-center gap-1.5 pt-1.5 text-2xs font-bold text-slate-500 min-w-0"
      >
        <span data-overlay-name className="truncate px-1.5 py-0.5 rounded-lg border text-slate-600" style={space.tone}>
          {spaceTitle(space)}
        </span>
        <span data-overlay-count={count} className="px-1.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
          {count}
        </span>
        <span className="flex-1 border-t border-dashed border-slate-200" />
      </div>
      {children}
    </>
  );
}

export default function DayEvents({ date }: { date: YMD }) {
  const sid = useCurrentSpaceId();
  const events = useItemsOn(date, 'event');
  const carried = useCarried(sid);
  const forwardDays = useCommonSettings((s) => s.forwardDays);
  // 카드 열 (#206 - 환경설정 화면 배치 '카드 열', 이 기기에만): 자동(0) = 휴대폰 2열·PC(sm 이상) 1열
  const pickedCols = useCardCols((s) => s.eventCols);
  // 고른 열이라도 칸 폭에 드는 만큼만 (P61 - 한눈에 하루 칸에 5열이면 카드가 한 글자 폭이었다)
  const [gridRef, fitCols] = useFitColumns(12, pickedCols > 0);
  const cardCols = cappedColumns(pickedCols, fitCols);
  // 카드 / 목록 (#204 - 목록은 한 줄에 일정 하나, 휴대폰도 1열)
  const view = useDayView((s) => s.events);
  const asList = view === 'list';
  const { reorderAttr, reorderButton } = useReorderToggle('events');
  const today = carried.today;
  // 오늘 칸이면 오늘로 따라오는 일정을 오늘 것 아래에 (지난 날에서 따라오는 것만 - 제 날짜는 그대로다)
  const follow = date === today ? carried.list : NONE;
  const count = events.length + follow.length;
  const tree = useLabelTree('event');
  const status = useMirrorStatus('items');
  const shownId = useShownEventId(sid);
  // 겹쳐 보는 다른 공간의 그날 일정 (P17-2 - 주 공간 것 아래에 공간마다 구분 줄, 수에는 넣지 않는다)
  const overlays = useOverlayEventsOn(date);
  const overlayCount = overlays.reduce((n, o) => n + o.events.length, 0);
  // 구글 캘린더 일정 (P36-4 - 맨 뒤, 수에 넣지 않는다. 끄거나 인쇄면 없다)
  const gcal = useGcalShown(date, date);
  const shownCount = count + overlayCount + gcal.length;
  const shownKey = useShownEventKey();
  const [collapsed, setCollapsed] = useState(false);
  // 검색 결과로 이 날 일정을 짚으러 오면 접힌 칸을 편다
  useFocusReveal((t) => t.kind === 'event' && t.date === date, () => setCollapsed(false));
  // ⏰ 표시를 누르면 알림 시각 창 (여기서는 누르는 즉시 저장 - V4 그대로)
  const [alarmFor, setAlarmFor] = useState<ItemDoc | null>(null);
  // 사본도 서버 소식도 아직 없으면 '없다' 대신 받는 중이라고 한다
  const waiting = shownCount === 0 && (status === 'idle' || status === 'loading');

  const openCreate = () => sid && openEventPanel({ sid, date });
  const openEdit = (ev: ItemDoc) => sid && openEventPanel({ sid, date, id: ev.id });
  // 겹친 일정 = 보기·열기·완료만 (그 공간 칸에서 고친다 - 고르기·끌기·순서·지우기는 주 공간 것만, PLAN 5장 P17)
  const openOverlay = (space: OverlaySpace, ev: ItemDoc) => openEventPanel({ sid: space.sid, date, id: ev.id });
  const toggleOverlayDone = (space: OverlaySpace, ev: ItemDoc) => void setEventDone(space.sid, ev, !doneOn(ev, date), { day: date }).catch(quiet);
  // 여러 개 고르기: 고르는 동안이거나 Ctrl·Shift와 함께 누르면 고른다 (아니면 수정 칸)
  const multi = useMulti();
  const pickedHere = new Set(multi.picks.filter((p) => p.day === date).map((p) => p.id));
  const visible: EventPick[] = [...events, ...follow].map((ev) => ({ id: ev.id, day: date }));
  const cardClick = (ev: ItemDoc, e: ReactMouseEvent) => {
    const p = { id: ev.id, day: date };
    if (e.shiftKey) pickRange(visible, p);
    else if (multi.on || e.ctrlKey || e.metaKey) togglePick(p);
    else openEdit(ev);
  };
  // 기간 일정은 그날만 (doneDates)
  const toggleDone = (ev: ItemDoc) => sid && void setEventDone(sid, ev, !doneOn(ev, date), { day: date }).catch(quiet);
  // 따라오던 일정을 오늘 칸에서 끝내면 오늘로 옮겨 적는다 - 오늘 목록의 맨 뒤(따라오는 줄 바로 위)
  const finishCarried = (ev: ItemDoc) => sid && void setEventDone(sid, ev, true, { carried: { today, order: orderAfter(events) } }).catch(quiet);
  const move = (list: readonly ItemDoc[], from: number, to: number) => sid && void moveEventInList(sid, list, from, to).catch(quiet);
  // 묶인 일정(기간)은 어디까지 지울지 먼저 묻는다
  const [scopeFor, setScopeFor] = useState<ItemDoc | null>(null);
  const remove = (ev: ItemDoc) => {
    if (!sid) return;
    if (isGrouped(ev)) setScopeFor(ev);
    else void deleteEvent(sid, ev).catch(quiet);
  };

  return (
    <section
      data-day-events={date}
      data-event-view={view}
      {...reorderAttr}
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col ${collapsed ? '' : 'h-full'}`}
    >
      {/* 머리줄: ▼ 📅 일정 8 [+ 추가] ……… ⚙️ */}
      {/* 좁은 칸(한눈에 화면 - P24)에서는 '+ 추가'가 제목 뒤에서 줄을 바꾼다 - 제목은 꺾이지 않는다('일/정') */}
      <div className={`flex items-center justify-between gap-2 ${collapsed ? '' : 'mb-4 sm:mb-1'}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
          <button
            type="button"
            data-event-collapse
            onClick={() => setCollapsed(!collapsed)}
            className="tap-area text-slate-500 hover:text-slate-700 text-xs px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
            title={collapsed ? '펼치기' : '접기'}
          >
            <Glyph e={collapsed ? '▶' : '▼'} />
          </button>
          <span className="flex text-primary" aria-hidden>
            <Glyph e="📅" className="w-5 h-5" />
          </span>
          <h3 className="text-base font-extrabold text-slate-800 whitespace-nowrap">일정</h3>
          <span data-event-count={count} className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {count}
          </span>
          {!collapsed && (
            <button
              type="button"
              data-event-add
              {...shortcutTarget('newEvent')}
              onClick={openCreate}
              aria-label="일정 추가"
              title="일정 추가 (오른쪽 칸)"
              className="tap-area px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              + 추가
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* 휴대폰 카드 ▲▼ '⇅ 누를 때만'(P59-1)이면 ⇅ */}
          {!collapsed && reorderButton}
          {/* 카드 / 목록 (#204 - 메모 화면 머리줄 ☰/▦와 같은 꼴) */}
          {!collapsed && <DayViewToggle pane="events" />}
          <button
            type="button"
            data-event-labels-settings
            {...shortcutTarget('labels')}
            onClick={() => openWindow('labels', { tab: 'event' })}
            className="tap-area w-7 h-7 flex items-center justify-center rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="일정 라벨 설정"
            aria-label="일정 라벨 설정"
          >
            <Glyph e="⚙" />
          </button>
        </div>
      </div>

      {!collapsed && (
        // 카드. 휴대폰은 2열, PC(sm 이상)는 1열 - 환경설정 화면 배치 '카드 열'(#206)에서 1~5열을 고르면 어디서나 그 수
        // PC 위 여백 12px(머리줄 아래 여백에서 옮김 - 합은 그대로): 카드 위 테두리에 걸쳐 뜨는 🗑️(ui/cardTools FLOAT_TOOLS)가 첫 카드에서 이 스크롤 칸에 잘리지 않게
        // 마우스 화면 왼쪽 여백 12px(칸 여백 p-5에서 빌림 - 카드 자리는 그대로): 카드 왼쪽 테두리에 걸친 ▲▼ 손잡이(ORDER_ARROWS_EDGE)가 이 스크롤 칸에 잘리지 않게(#200)
        // 목록(#204): 휴대폰도 1열·줄 사이 4px, 🗑️가 줄 안에 떠서 위 여백은 4px(손잡이가 첫 줄 위로 조금 나온다)
        <div
          ref={gridRef}
          className={`flex-1 overflow-y-auto pr-1 ${asList ? 'sm:pt-1' : 'sm:pt-3'} pointer-fine:-ml-3 pointer-fine:pl-3 min-h-[110px] ${
            shownCount > 0 ? `grid ${asList ? 'grid-cols-1' : cardCols ? GRID_COLS[cardCols] : 'grid-cols-2 sm:grid-cols-1'} ${asList ? 'gap-1' : 'gap-2 pointer-fine:gap-x-3'} content-start` : ''
          }`}
        >
          {shownCount > 0 ? (
            <>
              {events.map((ev, idx) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  list={asList}
                  day={date}
                  labels={itemLabels(tree, ev.labelIds)}
                  editing={shownId === ev.id}
                  today={today}
                  first={idx === 0}
                  last={idx === events.length - 1}
                  dragProps={reorderDragProps(`event:${date}`, idx, (f, t) => move(events, f, t), !multi.on)}
                  // 지난 날 칸: 오늘로 따라가는 일정은 흐리게 '→ 오늘로'
                  away={carried.ids.has(ev.id)}
                  picked={pickedHere.has(ev.id)}
                  onCardClick={(e) => cardClick(ev, e)}
                  onLongPress={() => togglePick({ id: ev.id, day: date })}
                  onOpenLinks={() => sid && openLinkViewer({ sid, id: ev.id })}
                  onAlarm={() => setAlarmFor(ev)}
                  onDelete={() => remove(ev)}
                  onToggle={() => toggleDone(ev)}
                  onUp={() => move(events, idx, idx - 1)}
                  onDown={() => move(events, idx, idx + 1)}
                />
              ))}
              {follow.map((ev, idx) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  list={asList}
                  day={date}
                  labels={itemLabels(tree, ev.labelIds)}
                  editing={shownId === ev.id}
                  today={today}
                  first={idx === 0}
                  last={idx === follow.length - 1}
                  dragProps={reorderDragProps(`event-follow:${date}`, idx, (f, t) => move(follow, f, t), !multi.on)}
                  since={carriedSince(ev)}
                  picked={pickedHere.has(ev.id)}
                  onCardClick={(e) => cardClick(ev, e)}
                  onLongPress={() => togglePick({ id: ev.id, day: date })}
                  onOpenLinks={() => sid && openLinkViewer({ sid, id: ev.id })}
                  onAlarm={() => setAlarmFor(ev)}
                  onDelete={() => remove(ev)}
                  onToggle={() => finishCarried(ev)}
                  onUp={() => move(follow, idx, idx - 1)}
                  onDown={() => move(follow, idx, idx + 1)}
                />
              ))}
              {overlays.map(({ space, events: list }) => (
                <OverlayGroup key={space.sid} space={space} count={list.length}>
                  {list.map((ev) => (
                    <EventCard
                      key={`${space.sid}/${ev.id}`}
                      ev={ev}
                      list={asList}
                      day={date}
                      labels={itemLabels(space.tree, ev.labelIds)}
                      editing={shownKey === shownEventKey(space.sid, ev.id)}
                      today={today}
                      first
                      last
                      overlay={space}
                      onCardClick={() => !multi.on && openOverlay(space, ev)}
                      onLongPress={nothing}
                      onOpenLinks={() => openLinkViewer({ sid: space.sid, id: ev.id })}
                      // 알림 시각도 그 공간 칸에서
                      onAlarm={() => openOverlay(space, ev)}
                      onDelete={nothing}
                      onToggle={() => toggleOverlayDone(space, ev)}
                      onUp={nothing}
                      onDown={nothing}
                    />
                  ))}
                </OverlayGroup>
              ))}
              {gcal.length > 0 && (
                <Suspense fallback={null}>
                  <GcalDayList list={gcal} date={date} />
                </Suspense>
              )}
            </>
          ) : waiting ? (
            <p data-event-waiting className="py-10 text-center text-xs text-slate-500">
              일정을 받는 중…
            </p>
          ) : (
            <div data-event-empty className="flex flex-col items-center justify-center py-10 text-center text-slate-500 text-xs">
              <DecorSpot
                slot="events"
                fallback={
                  <span className="text-3xl mb-2" aria-hidden>
                    <Glyph e="📋" />
                  </span>
                }
              />
              <p>오늘의 일정이 없습니다.</p>
              <p className="mt-1 text-slate-500">+ 추가 버튼을 눌러 일정을 넣어 보세요.</p>
            </div>
          )}
        </div>
      )}
      {/* 오늘이면 아래에 '📥 지난 일정 N개 ▸' (있을 때만 - V4 '지난 일정 오늘로 가져오기' 창) */}
      {!collapsed && sid && date === today && (
        <DayPastEvents sid={sid} today={today} stale={carried.stale} forwardDays={forwardDays} lastOrder={lastOrderOf(events)} />
      )}
      {scopeFor && sid && (
        <Suspense fallback={null}>
          <EventDeleteChooser sid={sid} item={scopeFor} day={date} onClose={() => setScopeFor(null)} />
        </Suspense>
      )}
      {alarmFor && sid && (
        <Suspense fallback={null}>
          <EventAlarmWindow
            onClose={() => setAlarmFor(null)}
            date={alarmFor.date ?? date}
            initialTime={alarmFor.time ?? ''}
            onSave={(time) => setEventAlarm(sid, alarmFor, time)}
            onTurnOff={() => setEventAlarm(sid, alarmFor, '')}
          />
        </Suspense>
      )}
    </section>
  );
}

interface EventCardProps {
  ev: ItemDoc;
  /** 겹쳐 보는 다른 공간의 일정 (P17-2) - 공간 색 배경, ▲▼·🗑️·끌기 없음 */
  overlay?: OverlaySpace;
  /** 여러 개 고르기로 골랐나 */
  picked?: boolean;
  /** 카드를 누름 (여러 개 고르기면 고르기, 아니면 수정 칸) */
  onCardClick: (e: ReactMouseEvent) => void;
  /** 휴대폰 길게 누르기 = 여러 개 고르기 시작 */
  onLongPress: () => void;
  /** 보이는 날 (기간 일정의 그날 완료·'(2/5)') */
  day: string;
  labels: ReturnType<typeof itemLabels>;
  editing: boolean;
  today: string;
  first: boolean;
  last: boolean;
  /** 끌어 놓아 순서 바꾸기 속성 (ui/reorderDrag) */
  dragProps?: object;
  /** 오늘로 따라오는 일정 - 처음 날 ('↪ 10/5부터') */
  since?: string;
  /** 지난 날 칸에서, 오늘로 따라간 일정 (흐리게 '→ 오늘로') */
  away?: boolean;
  /** 목록 보기 한 줄 (#204 - 글은 말줄임, 첨부는 📎 n · 줄 맨 앞 ▶ = 그 줄을 펴서 카드처럼 - #206) */
  list?: boolean;
  /** 🔗 n - 이은 항목 보기 */
  onOpenLinks: () => void;
  onAlarm: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
}

function EventCard({ ev, overlay, day, dragProps, picked, onCardClick, onLongPress, labels, editing, today, first, last, since, away, list, onOpenLinks, onAlarm, onDelete, onToggle, onUp, onDown }: EventCardProps) {
  const done = doneOn(ev, day);
  // 휴대폰 길게 누르기 = 여러 개 고르기 시작 (ui/longPress)
  const longPress = useLongPress(onLongPress);
  // 기간 일정의 그날 차례 '(2/5)' - 글에 적지 않고 센다 (DESIGN 5-3)
  const pos = periodPosition(ev, day);
  const links = ev.linkIds?.length ?? 0;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  // 목록 줄 펴기 (#206 - 메모 화면 목록 줄 ▶/▼와 같다): 편 줄은 글 전체·첨부를 카드처럼. 누른 것만 이 기기에 기억(메모 펼침과 같은 곳 - 일정 id)
  const open = useEntryOpen((s) => !!list && isRowExpanded(s.open, ev.id));
  const oneLine = list && !open;

  return (
    <div
      data-event-card={ev.id}
      role="button"
      tabIndex={0}
      onKeyDown={pressKeys}
      data-event-done={done ? '1' : '0'}
      data-event-carried={since}
      data-event-away={away ? '1' : undefined}
      data-event-picked={picked ? '1' : undefined}
      data-event-space={overlay?.sid}
      style={overlay?.tone}
      {...dragProps}
      {...longPress.handlers}
      onClick={(e) => {
        // 길게 눌러 고른 뒤 손을 떼면 click이 한 번 더 온다 - 그것은 넘긴다
        if (longPress.consumed()) return;
        onCardClick(e);
      }}
      title={overlay ? `${overlay.name} 공간 일정 - 클릭하여 오른쪽 칸에서 수정 (겹쳐 보기)` : '클릭하여 오른쪽 칸에서 수정 (Ctrl·Shift와 함께 누르면 여러 개 고르기)'}
      className={`group relative ${
        list ? `flex flex-row ${open ? 'items-start' : 'items-center'} gap-1.5 px-2.5 py-1 rounded-lg` : 'flex flex-col gap-1.5 sm:flex-row sm:items-start p-2.5 sm:p-3 rounded-xl shadow-xs'
      } border transition-all cursor-pointer min-w-0 select-none sm:select-auto ${away ? 'opacity-50 hover:opacity-80 ' : ''}${
        picked
          ? 'border-primary ring-2 ring-primary bg-blue-50 text-slate-800'
          : editing
          ? 'border-primary ring-1 ring-primary bg-primary/5'
          : 'bg-white border-slate-200/60 hover:border-slate-300 text-slate-800'
      }`}
    >
      {/* 목록 줄 맨 앞 ▶/▼ (#206) - 누르면 이 줄만 펴고 접는다(수정 칸은 열지 않는다) */}
      {list && (
        <button
          type="button"
          data-event-row-expand={ev.id}
          aria-expanded={open}
          onClick={(e) => {
            stop(e);
            setEntryOpen(ev.id, !open);
          }}
          title={open ? '접기' : '펼치기'}
          aria-label={open ? '접기' : '펼치기'}
          className={`tap-area order-first text-slate-500 hover:text-slate-700 text-xs w-5 h-5 -ml-1 flex items-center justify-center rounded hover:bg-slate-100 shrink-0 cursor-pointer ${open ? 'mt-0.5' : ''}`}
        >
          <Glyph e={open ? '▼' : '▶'} />
        </button>
      )}
      {/* 휴대폰(2열 카드): 위 줄에 순서 바꾸기, 아래에 내용. PC(1열): 한 줄 - 가운데 내용, 오른쪽 위 테두리에 🗑️.
          PC에서는 이 줄 틀을 없는 셈 치고(sm:contents) 순서(order)로 자리를 잡는다 (V4 그대로).
          마우스 화면은 ▲▼가 왼쪽 테두리에 걸친 손잡이라(#200 - 흐름 밖) 좁은 창에서도 이 줄 틀이 빈 줄로 남지 않게 contents.
          목록(#204)은 어디서나 한 줄 - 휴대폰 ▲▼는 글 앞에 가로로, 🗑️는 줄 오른쪽 끝에 겹쳐 뜬다 */}
      <div className={list ? 'contents' : 'flex items-center justify-between -mt-0.5 sm:contents pointer-fine:contents'}>
        {/* 겹친 일정은 ▲▼ 자리를 비워 둔다 (순서는 공간마다라 섞어 바꾸지 않는다 - 글 줄은 위 카드와 맞춘다 · 마우스 화면은 ▲▼가 자리를 차지하지 않아 비울 것도 없다) */}
        {overlay ? (
          <span aria-hidden className={`w-4 shrink-0 ${list ? 'order-1' : 'sm:order-1'} pointer-fine:hidden`} />
        ) : (
          <div
            className={`flex items-center gap-0.5 pointer-coarse:gap-1.5 shrink-0 ${list ? 'order-1' : 'sm:flex-col sm:order-1 sm:pointer-coarse:mt-0.5'} pointer-fine:flex-col ${ORDER_ARROWS_EDGE}`}
          >
            <button
              type="button"
              data-event-up
              onClick={(e) => {
                stop(e);
                if (!first) onUp();
              }}
              disabled={first}
              title="위로"
              aria-label="위로"
              className="tap-area text-slate-500 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-500 p-0.5 leading-none text-xs"
            >
              <Glyph e="▲" />
            </button>
            <button
              type="button"
              data-event-down
              onClick={(e) => {
                stop(e);
                if (!last) onDown();
              }}
              disabled={last}
              title="아래로"
              aria-label="아래로"
              className="tap-area text-slate-500 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-500 p-0.5 leading-none text-xs"
            >
              <Glyph e="▼" />
            </button>
          </div>
        )}
        {/* 마우스를 올리면 나오는 🗑️ 삭제 (V4 EventItemActions - 확인 창 없이 지우고 안내의 되돌리기로 돌아온다).
            P41-2: 카드 오른쪽 위에 떠서 자리를 차지하지 않는다(ui/cardTools) · 휴대폰에는 없다 - 예전에는 휴대폰에서도 안 보인 채 눌려 카드 오른쪽 위를 누르면 지워졌다. 휴대폰은 카드를 눌러 연 수정 칸에서.
            ✏️ 수정은 뺐다(11-24 메모 요청 #200 - 카드를 누르면 곧바로 수정 칸). 겹친 일정은 지우기가 없어 묶음도 없다 */}
        {!overlay && (
          <span data-event-tools className={list ? FLOAT_TOOLS_LIST : FLOAT_TOOLS}>
            <button
              type="button"
              data-event-delete
              onClick={(e) => {
                stop(e);
                onDelete();
              }}
              className="p-1 text-xs leading-none text-slate-500 hover:text-red-500 cursor-pointer"
              title="일정 삭제"
              aria-label="일정 삭제"
            >
              <Glyph e="🗑" />
            </button>
          </span>
        )}
      </div>

      <div className={`min-w-0 ${list ? 'order-2 flex-1' : 'sm:order-2 sm:flex-1'}`}>
        {/* 목록(#204): 한 줄 - 글만 줄어 말줄임(…), 칩·🔗 n은 그대로 보인다 · 편 줄(#206)은 카드처럼 글이 줄을 바꾼다 */}
        <div className={`leading-relaxed text-sm ${oneLine ? 'flex items-center min-w-0 whitespace-nowrap' : 'break-words'}`}>
          {/* 라벨 칩 = 완료 (P10-1: ☐는 없앴다, 끝내면 칩 앞에 ✓ - 색·글은 그대로). 라벨이 없으면 회색 ○ 칩 */}
          {(labels.length > 0 ? labels : [null]).map((l, i) => (
            <EventDoneChip
              key={l?.id ?? 'none'}
              label={l}
              done={done}
              mark={i === 0}
              onToggle={onToggle}
              forward={!!l?.props?.forward}
              className={`tap-area mr-1.5 text-xs px-2 py-0.5 rounded-lg ${oneLine ? 'shrink-0 max-w-[8rem]' : ''}`}
              data={{ 'data-event-chip': l?.id ?? '' }}
            />
          ))}

          {/* 알림이 걸린 일정에만 ⏰ (없는 일정까지 보이면 모두 걸린 것처럼 헷갈린다 - V4). 누르면 시각 바꾸기·끄기 */}
          {ev.time && (
            <button
              type="button"
              data-event-alarm={ev.time}
              onClick={(e) => {
                stop(e);
                onAlarm();
              }}
              title="클릭하여 알림 시간 변경"
              className={`tap-area inline-flex items-center align-middle mr-1.5 text-xs font-bold px-1.5 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                ev.alarmDone ? 'text-slate-500 bg-slate-100 border-slate-200' : 'text-primary bg-blue-50 border-blue-200'
              }`}
            >
              <Glyph e="⏰" /> {ev.time}
            </button>
          )}

          {/* 이월로 따라오는 중 - 처음 날 (V5: 제 날짜에 그대로 있고 오늘 칸에 함께 보인다) */}
          {since && (
            <span
              data-event-since={since}
              title={`${shortDateLabel(since)}부터 끝내지 않아 오늘로 따라왔습니다. 끝내면 오늘 일정이 됩니다.`}
              className="inline-flex items-center align-middle mr-1.5 text-xs font-bold px-1.5 py-0.5 rounded-lg border text-emerald-700 bg-emerald-50 border-emerald-200 whitespace-nowrap"
            >
              <Glyph e="↪" /> {monthDayLabel(since)}부터
            </span>
          )}
          {/* 지난 날 칸 - 이 일정은 오늘로 따라갔다. 누르면 오늘로 */}
          {away && (
            <button
              type="button"
              data-event-to-today
              onClick={(e) => {
                stop(e);
                goToday();
              }}
              title="끝내지 않아 오늘로 따라간 일정입니다. 누르면 오늘로 갑니다."
              className="inline-flex items-center align-middle mr-1.5 text-xs font-bold px-1.5 py-0.5 rounded-lg border text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
            >
              → 오늘로
            </button>
          )}

          <DueBadge due={ev.due} today={today} completed={done} />

          <span data-event-text className={oneLine ? 'min-w-0 truncate' : 'inline align-middle'}>
            {ev.text}
          </span>
          {ev.seriesId && (
            <span data-event-series title="반복 일정 - 고치거나 지우면 어디까지 할지 묻습니다" className="inline align-middle ml-1 text-xs text-purple-500">
              <Glyph e="🔁" />
            </span>
          )}
          {pos && (
            <span
              data-event-period={`${pos.k}/${pos.n}`}
              title={`기간 일정 - ${pos.n}일 가운데 ${pos.k}째 날`}
              className="inline align-middle ml-1 text-xs font-bold text-indigo-500"
            >
              ({pos.k}/{pos.n})
            </span>
          )}

          {/* 이은 항목 - 누르면 📑 연결된 데이터 */}
          {links > 0 && (
            <button
              type="button"
              data-event-links={links}
              onClick={(e) => {
                stop(e);
                onOpenLinks();
              }}
              className="inline-flex align-middle ml-1 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded font-bold border border-yellow-300 hover:bg-yellow-200 transition-colors cursor-pointer items-center gap-1"
              title={`링크된 항목 ${links}개`}
            >
              <Glyph e="🔗" /> {links}
            </button>
          )}

          {/* 첨부 (드라이브 파일 - 올리기는 P4-2) · 목록은 📎 n만 (수정 칸에서 연다 - 편 줄은 카드처럼) */}
          {oneLine && ev.attachments && ev.attachments.length > 0 && (
            <span data-event-files={ev.attachments.length} title={`첨부 ${ev.attachments.length}개`} className="shrink-0 ml-1 text-xs text-slate-500">
              <Glyph e="📎" />
              {ev.attachments.length}
            </span>
          )}
          {!oneLine && ev.attachments && ev.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {ev.attachments.map((att, i) =>
                att.type === 'image' ? (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={stop}
                    className="block w-8 h-8 rounded overflow-hidden border border-slate-200"
                  >
                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={stop}
                    className="block px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 truncate max-w-[150px] hover:bg-slate-100 transition-colors"
                    title={att.name}
                  >
                    <Glyph e="📎" /> {att.name}
                  </a>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

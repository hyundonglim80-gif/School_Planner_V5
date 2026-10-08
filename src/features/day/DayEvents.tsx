// 하루 화면의 일정 칸 (V4 features/day/DayEvents.tsx).
//
// - 머리줄 `▼ 📅 일정 N [+ 추가] ……… ⚙️` (기록 칸과 같은 배치 - V4 사용자 결정).
// - 카드: 휴대폰 2열, PC 1열. ☐ 완료 · 라벨 칩(누르면 완료) · ⏰ 알림 · ⏳ 기한 · 글 · 🔗 링크 수 · 첨부.
//   카드를 누르면 오른쪽 일정 칸(수정)이 열린다. 고치는 일정은 파란 테두리로 짚는다.
// - ▲▼ 순서 = 옮긴 일정의 order 하나만 (features/events/eventOps reorderOps).
// - 이월(DESIGN 5-1 - 계산): 오늘 칸은 오늘 것 아래에 따라오는 일정을 '↪ 10/5부터'와 함께(▲▼는 각 무리 안에서),
//   지난 날 칸에서는 그 일정을 흐리게 '→ 오늘로'(누르면 오늘). 오늘 칸에서 끝내면 그날로 옮겨 적는다(eventOps carriedDoneChanges).
// - 여러 개 고르기(features/events/multi): Ctrl+누르기·Shift 범위·휴대폰 길게 누르기로 바로 시작, 고르는 동안 누르면 고르기·풀기(V4 그대로).
// - 쓰기마다 문서 하나, 되돌리기는 Ctrl+Z(완료·순서는 안내 없이 - V4도 띄우지 않았다).
// 새로 쓰고 고치는 칸은 여기 없다 - 오른쪽 일정 칸(EventPanel) 하나로 어느 화면에서나 같게 (V4 그대로).
import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { goToday } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { openWindow } from '../../app/windows';
import { monthDayLabel, shortDateLabel } from '../../domain/dateUtils';
import { carriedSince } from '../../domain/forward';
import { isPeriod, periodDoneOn, periodPosition } from '../../domain/period';
import { labelColor } from '../../domain/labels';
import { itemLabels, useItemsOn, useLabelTree, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import type { YMD } from '../../data/types';
import { deleteEvent, moveEventInList, setEventAlarm, setEventDone } from '../events/actions';
import DueBadge from '../events/DueBadge';
import EventAlarmWindow from '../events/EventAlarmWindow';
import { isGrouped, orderAfter, type ItemDoc } from '../events/eventOps';
import { useCarried } from '../events/forward';
import { pickRange, togglePick, useMulti, type EventPick } from '../events/multi';
import EventDeleteChooser from '../events/EventDeleteChooser';
import DayPastEvents from './DayPastEvents';
import { openLinkViewer } from '../links/open';
import { openEventPanel, useEditingEventIds } from '../events/open';

const NONE: readonly ItemDoc[] = [];

/** 그날 끝냈나 (기간 일정은 그날만) */
const doneOn = (ev: ItemDoc, day: string) => (isPeriod(ev) ? periodDoneOn(ev, day) : !!ev.done);

/** 목록의 맨 뒤 차례 값 (없으면 null) */
function lastOrderOf(list: readonly ItemDoc[]): string | null {
  let last: string | null = null;
  for (const d of list) if (d.order && (last === null || d.order > last)) last = d.order;
  return last;
}

const quiet = () => {
  /* 실패 안내는 저장 도우미가 이미 했다 */
};

export default function DayEvents({ date }: { date: YMD }) {
  const sid = useCurrentSpaceId();
  const events = useItemsOn(date, 'event');
  const carried = useCarried(sid);
  const forwardDays = useCommonSettings((s) => s.forwardDays);
  const today = carried.today;
  // 오늘 칸이면 오늘로 따라오는 일정을 오늘 것 아래에 (지난 날에서 따라오는 것만 - 제 날짜는 그대로다)
  const follow = date === today ? carried.list : NONE;
  const count = events.length + follow.length;
  const tree = useLabelTree('event');
  const status = useMirrorStatus('items');
  const editing = useEditingEventIds(sid);
  const [collapsed, setCollapsed] = useState(false);
  // ⏰ 표시를 누르면 알림 시각 창 (여기서는 누르는 즉시 저장 - V4 그대로)
  const [alarmFor, setAlarmFor] = useState<ItemDoc | null>(null);
  // 사본도 서버 소식도 아직 없으면 '없다' 대신 받는 중이라고 한다
  const waiting = count === 0 && (status === 'idle' || status === 'loading');

  const openCreate = () => sid && openEventPanel({ sid, date });
  const openEdit = (ev: ItemDoc) => sid && openEventPanel({ sid, date, id: ev.id });
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
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col ${collapsed ? '' : 'h-full'}`}
    >
      {/* 머리줄: ▼ 📅 일정 8 [+ 추가] ……… ⚙️ */}
      <div className={`flex items-center justify-between gap-2 ${collapsed ? '' : 'mb-4'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            data-event-collapse
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-slate-700 text-xs px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
            title={collapsed ? '펼치기' : '접기'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <span className="text-xl" aria-hidden>
            📅
          </span>
          <h3 className="text-base font-extrabold text-slate-800">일정</h3>
          <span data-event-count={count} className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {count}
          </span>
          {!collapsed && (
            <button
              type="button"
              data-event-add
              onClick={openCreate}
              aria-label="일정 추가"
              title="일정 추가 (오른쪽 칸)"
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              + 추가
            </button>
          )}
        </div>
        <button
          type="button"
          data-event-labels-settings
          onClick={() => openWindow('labels', { tab: 'event' })}
          className="w-7 h-7 flex items-center justify-center rounded-md text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          title="일정 라벨 설정"
          aria-label="일정 라벨 설정"
        >
          ⚙️
        </button>
      </div>

      {!collapsed && (
        // 카드. 휴대폰은 2열, PC(sm 이상)는 1열
        <div className={`flex-1 overflow-y-auto pr-1 min-h-[110px] ${count > 0 ? 'grid grid-cols-2 sm:grid-cols-1 gap-2 content-start' : ''}`}>
          {count > 0 ? (
            <>
              {events.map((ev, idx) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  day={date}
                  labels={itemLabels(tree, ev.labelIds)}
                  editing={editing.has(ev.id)}
                  today={today}
                  first={idx === 0}
                  last={idx === events.length - 1}
                  // 지난 날 칸: 오늘로 따라가는 일정은 흐리게 '→ 오늘로'
                  away={carried.ids.has(ev.id)}
                  picked={pickedHere.has(ev.id)}
                  onCardClick={(e) => cardClick(ev, e)}
                  onLongPress={() => togglePick({ id: ev.id, day: date })}
                  onOpen={() => openEdit(ev)}
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
                  day={date}
                  labels={itemLabels(tree, ev.labelIds)}
                  editing={editing.has(ev.id)}
                  today={today}
                  first={idx === 0}
                  last={idx === follow.length - 1}
                  since={carriedSince(ev)}
                  picked={pickedHere.has(ev.id)}
                  onCardClick={(e) => cardClick(ev, e)}
                  onLongPress={() => togglePick({ id: ev.id, day: date })}
                  onOpen={() => openEdit(ev)}
                  onOpenLinks={() => sid && openLinkViewer({ sid, id: ev.id })}
                  onAlarm={() => setAlarmFor(ev)}
                  onDelete={() => remove(ev)}
                  onToggle={() => finishCarried(ev)}
                  onUp={() => move(follow, idx, idx - 1)}
                  onDown={() => move(follow, idx, idx + 1)}
                />
              ))}
            </>
          ) : waiting ? (
            <p data-event-waiting className="py-10 text-center text-xs text-slate-400">
              일정을 받는 중…
            </p>
          ) : (
            <div data-event-empty className="flex flex-col items-center justify-center py-10 text-center text-slate-400 text-xs">
              <span className="text-3xl mb-2" aria-hidden>
                📋
              </span>
              <p>오늘의 일정이 없습니다.</p>
              <p className="mt-1 text-slate-400">+ 추가 버튼을 눌러 일정을 넣어 보세요.</p>
            </div>
          )}
        </div>
      )}
      {/* 오늘이면 아래에 '📥 지난 일정 N개 ▸' (있을 때만 - V4 '지난 일정 오늘로 가져오기' 창) */}
      {!collapsed && sid && date === today && (
        <DayPastEvents sid={sid} today={today} stale={carried.stale} forwardDays={forwardDays} lastOrder={lastOrderOf(events)} />
      )}
      {scopeFor && sid && <EventDeleteChooser sid={sid} item={scopeFor} day={date} onClose={() => setScopeFor(null)} />}
      {alarmFor && sid && (
        <EventAlarmWindow
          onClose={() => setAlarmFor(null)}
          date={alarmFor.date ?? date}
          initialTime={alarmFor.time ?? ''}
          onSave={(time) => setEventAlarm(sid, alarmFor, time)}
          onTurnOff={() => setEventAlarm(sid, alarmFor, '')}
        />
      )}
    </section>
  );
}

interface EventCardProps {
  ev: ItemDoc;
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
  /** 오늘로 따라오는 일정 - 처음 날 ('↪ 10/5부터') */
  since?: string;
  /** 지난 날 칸에서, 오늘로 따라간 일정 (흐리게 '→ 오늘로') */
  away?: boolean;
  onOpen: () => void;
  /** 🔗 n - 이은 항목 보기 */
  onOpenLinks: () => void;
  onAlarm: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
}

/** 길게 누르기 (손가락만 - 0.5초, 움직이면 그만) */
const LONG_PRESS_MS = 500;

function EventCard({ ev, day, picked, onCardClick, onLongPress, labels, editing, today, first, last, since, away, onOpen, onOpenLinks, onAlarm, onDelete, onToggle, onUp, onDown }: EventCardProps) {
  const done = doneOn(ev, day);
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({ timer: null, x: 0, y: 0, fired: false });
  const cancelPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };
  // 기간 일정의 그날 차례 '(2/5)' - 글에 적지 않고 센다 (DESIGN 5-3)
  const pos = periodPosition(ev, day);
  const links = ev.linkIds?.length ?? 0;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div
      data-event-card={ev.id}
      data-event-done={done ? '1' : '0'}
      data-event-carried={since}
      data-event-away={away ? '1' : undefined}
      data-event-picked={picked ? '1' : undefined}
      onClick={(e) => {
        // 길게 눌러 고른 뒤 손을 떼면 click이 한 번 더 온다 - 그것은 넘긴다
        if (press.current.fired) {
          press.current.fired = false;
          return;
        }
        onCardClick(e);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        cancelPress();
        press.current = {
          x: e.clientX,
          y: e.clientY,
          fired: false,
          timer: setTimeout(() => {
            press.current.fired = true;
            press.current.timer = null;
            onLongPress();
          }, LONG_PRESS_MS),
        };
      }}
      onPointerMove={(e) => {
        if (press.current.timer && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => {
        // 길게 누르기에 뜨는 휴대폰 메뉴를 막는다
        if (press.current.fired) e.preventDefault();
      }}
      title="클릭하여 오른쪽 칸에서 수정 (Ctrl·Shift와 함께 누르면 여러 개 고르기)"
      className={`group flex flex-col gap-1.5 sm:flex-row sm:items-start p-2.5 sm:p-3 rounded-xl border shadow-2xs transition-all cursor-pointer min-w-0 select-none sm:select-auto ${away ? 'opacity-50 hover:opacity-80 ' : ''}${
        picked
          ? 'border-primary ring-2 ring-primary bg-blue-50 text-slate-800'
          : editing
          ? 'border-primary ring-1 ring-primary bg-primary/5'
          : done
            ? 'bg-slate-50 border-slate-100 text-slate-400'
            : 'bg-white border-slate-200/60 hover:border-slate-300 text-slate-800'
      }`}
    >
      {/* 휴대폰(2열 카드): 위 줄에 순서 바꾸기 · 수정, 아래에 내용. PC(1열): 한 줄 - 왼쪽 ▲▼(세로), 가운데 내용, 오른쪽 수정.
          PC에서는 이 줄 틀을 없는 셈 치고(sm:contents) 순서(order)로 자리를 잡는다 (V4 그대로). */}
      <div className="flex items-center justify-between -mt-0.5 sm:contents">
        <div className="flex items-center gap-0.5 shrink-0 sm:flex-col sm:order-1 sm:mt-0.5">
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
            className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs"
          >
            ▲
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
            className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs"
          >
            ▼
          </button>
        </div>
        {/* 마우스를 올리면 나오는 ✏️ 수정 · 🗑️ 삭제 (V4 EventItemActions - 확인 창 없이 지우고 안내의 되돌리기로 돌아온다) */}
        <span className="shrink-0 sm:order-3 inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            data-event-edit
            onClick={(e) => {
              stop(e);
              onOpen();
            }}
            className="px-1 text-2xs leading-none text-slate-400 hover:text-primary cursor-pointer"
            title="일정 수정"
            aria-label="일정 수정"
          >
            ✏️
          </button>
          <button
            type="button"
            data-event-delete
            onClick={(e) => {
              stop(e);
              onDelete();
            }}
            className="px-1 text-2xs leading-none text-slate-400 hover:text-red-500 cursor-pointer"
            title="일정 삭제"
            aria-label="일정 삭제"
          >
            🗑️
          </button>
        </span>
      </div>

      <div className="min-w-0 sm:order-2 sm:flex-1">
        <div className="leading-relaxed text-sm break-words">
          {/* 완료 체크 (UX-AUDIT H1) - 라벨 칩 누르기도 그대로 완료다 */}
          <input
            type="checkbox"
            checked={done}
            data-event-complete
            aria-label="일정 완료"
            title={done ? '완료 풀기' : '완료'}
            onClick={stop}
            onChange={onToggle}
            className="inline-block align-middle mr-1.5 w-4 h-4 rounded text-primary border-slate-300 accent-primary cursor-pointer"
          />

          {/* 라벨 칩: 누르면 완료 (이월 라벨이면 이월도 멈춘다) */}
          {labels.map((l) => {
            const c = labelColor(l.color);
            return (
              <span
                key={l.id}
                data-event-chip={l.id}
                onClick={(e) => {
                  stop(e);
                  onToggle();
                }}
                title={l.props?.forward ? '클릭하여 완료 처리 (이월 정지)' : '클릭하여 완료 처리'}
                className="inline-block align-middle mr-1.5 text-xs font-bold px-2 py-0.5 rounded-md shadow-2xs whitespace-nowrap cursor-pointer"
                style={{
                  backgroundColor: done ? 'var(--color-slate-100)' : c.bg,
                  color: done ? 'var(--color-slate-400)' : c.text,
                  border: '1px solid ' + (done ? 'var(--color-slate-200)' : c.border),
                }}
              >
                {l.name}
              </span>
            );
          })}

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
              className={`inline-flex items-center align-middle mr-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md border transition-colors cursor-pointer ${
                ev.alarmDone ? 'text-slate-400 bg-slate-100 border-slate-200' : 'text-primary bg-blue-50 border-blue-200'
              }`}
            >
              ⏰ {ev.time}
            </button>
          )}

          {/* 이월로 따라오는 중 - 처음 날 (V5: 제 날짜에 그대로 있고 오늘 칸에 함께 보인다) */}
          {since && (
            <span
              data-event-since={since}
              title={`${shortDateLabel(since)}부터 끝내지 않아 오늘로 따라왔습니다. 끝내면 오늘 일정이 됩니다.`}
              className="inline-flex items-center align-middle mr-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200 whitespace-nowrap"
            >
              ↪ {monthDayLabel(since)}부터
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
              className="inline-flex items-center align-middle mr-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
            >
              → 오늘로
            </button>
          )}

          <DueBadge due={ev.due} today={today} completed={done} />

          <span data-event-text className={`inline align-middle ${done ? 'line-through text-slate-400' : ''}`}>
            {ev.text}
          </span>
          {ev.seriesId && (
            <span data-event-series title="반복 일정 - 고치거나 지우면 어디까지 할지 묻습니다" className="inline align-middle ml-1 text-xs text-purple-500">
              🔁
            </span>
          )}
          {pos && (
            <span
              data-event-period={`${pos.k}/${pos.n}`}
              title={`기간 일정 - ${pos.n}일 가운데 ${pos.k}째 날`}
              className={`inline align-middle ml-1 text-xs font-bold ${done ? 'text-slate-400' : 'text-indigo-500'}`}
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
              🔗 {links}
            </button>
          )}

          {/* 첨부 (드라이브 파일 - 올리기는 P4-2) */}
          {ev.attachments && ev.attachments.length > 0 && (
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
                    📎 {att.name}
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

// 주간 요일 카드 하나 (V4 features/week/WeekGrid.tsx의 카드). 주간 화면이 이번 주·다음 주 줄에 쓴다.
//   머리: 요일 · 날짜(토 파랑·일 빨강) · 📝 기록 수(누르면 그날 기록 창 - 하루 화면으로 가지 않는다).
//   수업: 교시 줄(features/lessons/WeekLessonRows - P6-1) - 누르면 'N교시 수정' 칸.
//   일정: 라벨 칩 누르기 = 완료, 글 누르기 = 오른쪽 일정 칸, 마우스를 올리면 ✕, 🔗 n = 연결된 데이터. 오늘 카드에는 이월로 따라오는 일정도(↪).
//   카드 빈 곳 = 그날 하루 화면. + = 그날 새 일정. 일정을 끌어 다른 요일 카드에 놓으면 옮긴다(P5-3 - 마우스 화면만).
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { DAY_CELL_BG, DAY_NUMBER_COLOR, dayToneOf } from '../../domain/dayTone';
import { DAY_NAMES, parseDateStr } from '../../domain/dateUtils';
import { periodPosition } from '../../domain/period';
import { labelColor } from '../../domain/labels';
import type { LabelDoc } from '../../data/select';
import DueBadge from '../events/DueBadge';
import { DROP_TARGET_CLASS, dropTargetProps, eventDragProps, type DropHandlers } from '../events/drag';
import { useHolidayName } from '../../data/holidays';
import HolidayName from '../../ui/HolidayName';
import SchoolEventName from '../school/SchoolEventName';
import { useSchoolSchedule } from '../school/school';
import { doneOnDay, type ItemDoc } from '../events/eventOps';

export interface WeekDayCardProps {
  date: string;
  today: string;
  events: readonly ItemDoc[];
  /** 오늘 카드에만 - 이월로 따라오는 일정 */
  carried?: readonly ItemDoc[];
  /** 그날 기록 수 */
  noteCount: number;
  showEvents: boolean;
  /** 수업 줄 (둘째 줄 '수업'을 켰을 때만) */
  lessons?: ReactNode;
  labelsOf: (ev: ItemDoc) => LabelDoc[];
  pickedIds: ReadonlySet<string>;
  multiOn: boolean;
  onOpenDay: () => void;
  onAdd: () => void;
  onOpenNotes: () => void;
  onEventClick: (ev: ItemDoc, e: ReactMouseEvent) => void;
  onToggleDone: (ev: ItemDoc, carried: boolean) => void;
  onDelete: (ev: ItemDoc) => void;
  onOpenLinks: (ev: ItemDoc) => void;
  /** 작년 이맘때 칸 (켰을 때만) */
  lastYear?: ReactNode;
  /** 끌어 옮기기 (drag.useEventDrop) - 놓을 칸·짚은 날·일정에 끌기를 붙일지 */
  drop?: { handlers: DropHandlers; over: boolean; dragEnabled: boolean; onDragEnd: () => void };
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function EventChip({
  ev,
  day,
  today,
  labels,
  picked,
  multiOn,
  carried,
  onClick,
  onToggle,
  onDelete,
  onLinks,
  drag,
}: {
  drag?: { enabled: boolean; onEnd: () => void };
  ev: ItemDoc;
  day: string;
  today: string;
  labels: LabelDoc[];
  picked: boolean;
  multiOn: boolean;
  carried: boolean;
  onClick: (e: ReactMouseEvent) => void;
  onToggle: () => void;
  onDelete: () => void;
  onLinks: () => void;
}) {
  const done = doneOnDay(ev, day);
  const label = labels[0];
  const c = label ? labelColor(label.color) : null;
  const pos = periodPosition(ev, day);
  const links = ev.linkIds?.length ?? 0;
  return (
    <div
      data-week-event={ev.id}
      data-week-event-done={done ? '1' : '0'}
      data-week-carried={carried ? '1' : undefined}
      data-event-picked={picked ? '1' : undefined}
      {...eventDragProps(ev, day, !!drag?.enabled, drag?.onEnd)}
      onClick={(e) => {
        stop(e);
        onClick(e);
      }}
      title={`누르면 오른쪽 칸에서 고치기 (Ctrl·Shift와 함께 누르면 여러 개 고르기)${drag?.enabled ? ' · 끌어서 다른 날로 옮기기' : ''}`}
      className={`group relative px-2 py-1.5 rounded-lg text-xs leading-snug transition-all border block hover:shadow-sm cursor-pointer break-words ${
        picked
          ? 'bg-primary/10 border-primary text-primary'
          : done
            ? 'bg-slate-50 border-slate-100 text-slate-400'
            : carried
              ? 'bg-amber-50/60 border-amber-100 text-slate-800 font-medium'
              : 'bg-blue-50/60 border-blue-100 text-slate-800 font-medium'
      }`}
    >
      {multiOn && <input type="checkbox" checked={picked} readOnly tabIndex={-1} className="inline-block align-middle mr-1.5 pointer-events-none" />}
      {carried && (
        <span className="inline-block align-middle mr-1 text-2xs font-bold text-amber-700" title="지난 날에서 이월로 따라오는 일정">
          ↪
        </span>
      )}
      {/* 라벨 칩을 누르면 완료 (V4 그대로) */}
      {label && c && !multiOn && (
        <span
          data-week-event-chip={ev.id}
          role="button"
          tabIndex={0}
          onClick={(e) => {
            stop(e);
            onToggle();
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            stop(e);
            onToggle();
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
      <DueBadge due={ev.due} today={today} completed={done} small />
      <span className={`inline align-middle ${done ? 'line-through text-slate-400' : ''}`}>{ev.text}</span>
      {pos && <span className="inline align-middle ml-1 text-2xs font-bold text-slate-400">({pos.k}/{pos.n})</span>}
      {links > 0 && (
        <button
          type="button"
          data-week-event-links={links}
          onClick={(e) => {
            stop(e);
            onLinks();
          }}
          className="inline-flex align-middle ml-1 bg-yellow-100 text-yellow-800 text-2xs px-1 py-0.5 rounded font-bold border border-yellow-300 shrink-0 hover:bg-yellow-200 cursor-pointer"
          title={`링크된 항목 ${links}개`}
        >
          🔗 {links}
        </button>
      )}
      {!multiOn && (
        <button
          type="button"
          data-week-event-delete={ev.id}
          onClick={(e) => {
            stop(e);
            onDelete();
          }}
          title="일정 삭제"
          aria-label="일정 삭제"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 hidden group-hover:flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs text-2xs text-slate-400 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
          data-print-hide
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function WeekDayCard(props: WeekDayCardProps) {
  const { date, today, events, carried = [], noteCount, showEvents } = props;
  const holiday = useHolidayName()(date);
  // 우리 학교 학사일정 (P6-3 - 나이스, 학교·달마다 담아 둔다)
  const { byDate: schoolEvents } = useSchoolSchedule([date.slice(0, 7)]);
  const tone = dayToneOf(date, holiday);
  const [, m, d] = date.split('-').map(Number);
  const isToday = date === today;
  const count = events.length + carried.length;

  return (
    <div
      data-week-day={date}
      data-today={isToday ? 'true' : undefined}
      onClick={props.onOpenDay}
      {...(props.drop ? dropTargetProps(props.drop.handlers, date) : {})}
      className={`${DAY_CELL_BG[tone]} rounded-2xl border p-2.5 flex flex-col transition-all cursor-pointer group/day hover:shadow-md hover:border-primary/50 min-h-[250px] min-w-0 overflow-hidden ${
        isToday ? 'border-primary ring-2 ring-primary/20 shadow-xs' : 'border-slate-200/80 shadow-xs'
      } ${props.drop?.over ? DROP_TARGET_CLASS : ''}`}
      title="누르면 그날 하루 화면"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1 pb-2.5 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-1 min-w-0 min-h-9">
          {/* 오늘이 아닐 때만 흰 바탕 - 둘을 함께 두면 흰 바탕이 이겨 오늘 요일 글자가 사라졌다(V4) */}
          <span className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-black text-xs ${isToday ? 'bg-primary text-white shadow-xs' : `bg-white/70 ${DAY_NUMBER_COLOR[tone]}`}`}>
            {DAY_NAMES[parseDateStr(date).getDay()]}
          </span>
          <span className={`text-xs font-bold ${DAY_NUMBER_COLOR[tone]}`} data-week-day-label>
            {m}.{d}
          </span>
          {holiday && <HolidayName name={holiday} tier="week" fill={false} />}
          <SchoolEventName items={schoolEvents[date]} />
        </div>
        {noteCount > 0 && (
          <button
            type="button"
            data-week-notes={noteCount}
            onClick={(e) => {
              stop(e);
              props.onOpenNotes();
            }}
            title={`기록 ${noteCount}건 보기`}
            aria-label={`기록 ${noteCount}건 보기`}
            className="inline-flex items-center gap-px px-1 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-2xs font-bold leading-none hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
          >
            <span aria-hidden>📝</span>
            <span>{noteCount}</span>
          </button>
        )}
      </div>

      {props.lessons}

      {showEvents && (
        <div>
          <div className="h-5 text-xs font-extrabold text-slate-400 mb-2 flex items-center justify-between">
            <span>일정</span>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <span data-week-count={count} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                  {count}
                </span>
              )}
              <button
                type="button"
                data-week-add={date}
                data-print-hide
                onClick={(e) => {
                  stop(e);
                  props.onAdd();
                }}
                className="ml-1 w-5 h-5 rounded hover:bg-slate-200 text-slate-400 hover:text-primary flex items-center justify-center transition-colors text-xs font-bold leading-none cursor-pointer"
                title="이 날 새 일정 (오른쪽 칸)"
                aria-label="이 날 새 일정"
              >
                +
              </button>
            </div>
          </div>
          {count > 0 ? (
            <div className="space-y-1.5">
              {[...events.map((ev) => [ev, false] as const), ...carried.map((ev) => [ev, true] as const)].map(([ev, isCarried]) => (
                <EventChip
                  key={ev.id}
                  ev={ev}
                  day={date}
                  today={today}
                  labels={props.labelsOf(ev)}
                  picked={props.pickedIds.has(ev.id)}
                  multiOn={props.multiOn}
                  carried={isCarried}
                  onClick={(e) => props.onEventClick(ev, e)}
                  onToggle={() => props.onToggleDone(ev, isCarried)}
                  onDelete={() => props.onDelete(ev)}
                  onLinks={() => props.onOpenLinks(ev)}
                  drag={props.drop ? { enabled: props.drop.dragEnabled, onEnd: props.drop.onDragEnd } : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-300 py-1 pl-1">일정이 없습니다.</div>
          )}
        </div>
      )}
      {props.lastYear}
    </div>
  );
}

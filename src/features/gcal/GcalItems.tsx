// 겹쳐 그린 구글 캘린더 일정 (P36-4 - PLAN 5장 'P36-4 구글 캘린더 겹쳐 그리기 ■0 정한 것' ①②). 하루·주간·월간·년간·한눈에가 함께 쓴다.
//   읽기 전용 - 누르면 '📅 구글 캘린더 일정' 창(features/gcal/GcalEventWindow). 완료·끌기·고르기·▲▼·✕·🔗 없음.
//   모양 = 흰 바탕 + **점선 테두리** + 캘린더 색 점 + 캘린더 이름 칩 + 시각(시각 일정만) + 제목.
//   색만으로 가르지 않는다(CLAUDE.md 5장 '보기 쉽게' - 점선·이름 칩이 앱 일정과 가른다. 색은 slate 변수라 어둡게·고대비도 따라간다).
//   여러 개 고르는 동안은 눌러도 아무 일 없음(겹친 공간 일정과 같다).
//   data-*: data-gcal-event(일정 id)·data-gcal-cal(캘린더 id)·data-gcal-at(자리 - day·week·month·year·sheet·board·sheet-day)·data-gcal-day(그 날).
import type { CSSProperties, ReactNode } from 'react';
import { gcalPosition, gcalTimeOn, type GcalBarItem, type GcalShown } from '../../domain/gcalShow';
import type { WeekBar } from '../../domain/periodBars';
import { fitToWidthFontSize } from '../../domain/typeScale';
import { pressKeys } from '../../ui/pressKeys';
import { useMulti } from '../events/multi';
import { gcalClick, gcalTip } from './gcalActions';
import { openGcalEvent } from './open';
import { Glyph } from '../../ui/Icon';

type GcalAt = 'day' | 'week' | 'month' | 'compact' | 'year' | 'sheet' | 'board';

export function GcalDot({ color, className = 'w-2 h-2' }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full align-middle ${className}`} style={{ backgroundColor: color }} />;
}

/** 라벨 칩 자리의 캘린더 이름 칩 (색 점 + 이름) - 누르면 완료가 아니라 그 일정 창(감싼 줄이 받는다) */
export function GcalCalChip({ s, className }: { s: GcalShown; className: string }) {
  return (
    <span data-gcal-chip className={`inline-flex items-center gap-1 align-middle font-bold rounded border border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap ${className}`}>
      <GcalDot color={s.cal.color} />
      <span className="truncate min-w-0">{s.cal.name}</span>
    </span>
  );
}

function data(s: GcalShown, at: GcalAt, date: string) {
  return { 'data-gcal-event': s.ev.id, 'data-gcal-cal': s.cal.id, 'data-gcal-at': at, 'data-gcal-day': date };
}

/** 시각 글 (없으면 그리지 않는다) */
function Time({ s, date, short, className }: { s: GcalShown; date: string; short?: boolean; className: string }) {
  const t = gcalTimeOn(s, date, short);
  if (!t) return null;
  return (
    <span data-gcal-time={t} className={`inline align-middle font-bold tabular-nums text-slate-500 whitespace-nowrap ${className}`}>
      {t}
    </span>
  );
}

/** 여러 날 일정의 그날 차례 '(2/3)' (앱 기간 일정과 같은 꼴) */
function Position({ s, date, className }: { s: GcalShown; date: string; className: string }) {
  const pos = gcalPosition(s, date);
  if (!pos) return null;
  return (
    <span data-gcal-period={`${pos.k}/${pos.n}`} className={`inline align-middle ml-1 font-bold text-slate-500 ${className}`}>
      ({pos.k}/{pos.n})
    </span>
  );
}

/** 하루 화면 카드 (EventCard 자리 - 휴대폰 2열·PC 1열) */
export function GcalDayCard({ s, date }: { s: GcalShown; date: string }) {
  return (
    <div
      {...data(s, 'day', date)}
      role="button"
      tabIndex={0}
      onKeyDown={pressKeys}
      onClick={gcalClick(s, date)}
      title={gcalTip(s)}
      className="flex flex-col gap-1 p-2.5 sm:p-3 rounded-xl border border-dashed border-slate-300 bg-white text-slate-800 shadow-xs hover:border-slate-400 transition-all cursor-pointer min-w-0"
    >
      <div className="leading-relaxed text-sm break-words min-w-0">
        <GcalCalChip s={s} className="mr-1.5 text-xs px-2 py-0.5 max-w-[min(12rem,100%)]" />
        <Time s={s} date={date} className="mr-1.5 text-xs" />
        <span data-gcal-text className="inline align-middle">
          {s.ev.title}
        </span>
        <Position s={s} date={date} className="text-xs" />
      </div>
      {s.ev.location && <div className="text-xs text-slate-500 truncate"><Glyph e="📍" /> {s.ev.location}</div>}
    </div>
  );
}

const LINE: Record<Exclude<GcalAt, 'day' | 'compact'>, { box: string; chip: string; time: string }> = {
  week: { box: 'px-2 py-1.5 rounded-lg text-xs leading-snug', chip: 'mr-1.5 text-2xs px-1.5 py-0.5 max-w-[min(8rem,100%)]', time: 'mr-1 text-2xs' },
  month: { box: 'px-1.5 py-0.5 rounded text-2xs leading-tight', chip: '', time: 'mr-1' },
  year: { box: 'px-1.5 py-1 rounded-lg text-xs leading-snug', chip: 'mr-1.5 text-2xs px-1.5 py-0.5 max-w-[min(8rem,100%)]', time: 'mr-1 text-2xs' },
  sheet: { box: 'px-2 py-1.5 rounded-lg text-xs leading-snug', chip: 'mr-1.5 text-2xs px-1.5 py-0.5 max-w-[min(8rem,100%)]', time: 'mr-1 text-2xs' },
  // 한눈에 달 목록은 이름 칩 없이 색 점 (GcalBoardRow)
  board: { box: 'px-1.5 py-1 rounded-lg text-xs leading-snug', chip: '', time: 'mr-1 text-2xs' },
};

/**
 * 한 줄 (주간·한눈에 요일 칸 'week' · 월간 칸 'month'(좁아 이름 칩 대신 색 점) · 휴대폰 월간 칸 'compact'(색 띠 한 줄) ·
 * 년간 자세히 'year' · 휴대폰 월간 그날 목록 'sheet'). after = 줄 뒤(년간 기간 줄의 범위).
 */
export function GcalLine({ s, date, at, instead, after }: { s: GcalShown; date: string; at: Exclude<GcalAt, 'day' | 'board'>; instead?: () => void; after?: ReactNode }) {
  if (at === 'compact')
    return (
      <div
        {...data(s, at, date)}
        role="button"
        tabIndex={0}
        onKeyDown={pressKeys}
        onClick={gcalClick(s, date, instead)}
        title={gcalTip(s)}
        style={{ borderLeftWidth: '3px', borderLeftColor: s.cal.color, borderLeftStyle: 'solid' }}
        className="block px-1 py-[1px] rounded text-2xs font-medium leading-tight truncate whitespace-nowrap border border-dashed border-slate-300 bg-white text-slate-700 cursor-pointer [container-type:inline-size]"
      >
        <span data-gcal-text style={{ fontSize: fitToWidthFontSize(s.ev.title) }}>
          {s.ev.title}
        </span>
      </div>
    );
  const look = LINE[at];
  return (
    <div
      {...data(s, at, date)}
      role="button"
      tabIndex={0}
      onKeyDown={pressKeys}
      onClick={gcalClick(s, date, instead)}
      title={gcalTip(s)}
      className={`block break-words border border-dashed border-slate-300 bg-white text-slate-700 font-medium hover:shadow-xs hover:border-slate-400 transition-all cursor-pointer ${look.box}`}
    >
      {at === 'month' ? <GcalDot color={s.cal.color} className="w-2 h-2 mr-1" /> : <GcalCalChip s={s} className={look.chip} />}
      <Time s={s} date={date} short={at === 'month'} className={look.time} />
      <span data-gcal-text className="inline align-middle">
        {s.ev.title}
      </span>
      {(at === 'week' || at === 'sheet') && <Position s={s} date={date} className="text-2xs" />}
      {after}
    </div>
  );
}

/** 한눈에 달 목록 한 줄 (button - 목록 줄과 같은 꼴, 날짜 글은 부르는 쪽) */
export function GcalBoardRow({ s, day, dateLabel, mark, selected, onPick }: { s: GcalShown; day: string; dateLabel: string; mark: string; selected: boolean; onPick: () => void }) {
  const look = LINE.board;
  return (
    <button
      type="button"
      {...data(s, 'board', day)}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        if (!useMulti.getState().on) openGcalEvent(s, day);
      }}
      title={gcalTip(s)}
      className={`w-full text-left flex items-start gap-1 border border-dashed text-slate-800 cursor-pointer hover:shadow-xs ${look.box} ${mark || 'bg-white border-slate-300 hover:border-slate-400'} ${selected ? 'ring-2 ring-primary/60' : ''}`}
    >
      <span className="shrink-0 font-bold text-2xs text-slate-500 tabular-nums pt-0.5">{dateLabel}</span>
      {/* 좁은 달 목록이라 이름 칩 대신 색 점(월간 칸과 같게 - P36-4 PC 확인: 기본 캘린더 이름 칩이 자리를 다 차지해 제목이 두 글자씩 꺾였다). 이름은 title에 */}
      <GcalDot color={s.cal.color} className="w-2 h-2 mt-1" />
      <span data-gcal-text className="min-w-0 flex-1 break-words">
        <Time s={s} date={day} short className={look.time} />
        {s.ev.title}
      </span>
    </button>
  );
}

/** 월간 여러 날 막대 (PeriodBar 자리 - 앱 기간 막대와 한 막대 줄 배치). 누르면 그 조각 날로 창 */
export function GcalBar({ bar, compact, isCurrentMonth, style, instead }: { bar: WeekBar<GcalBarItem>; compact: boolean; isCurrentMonth: (d: string) => boolean; style?: CSSProperties; instead?: (date: string) => void }) {
  const s = bar.item.gcal;
  const radius = compact ? '3px' : '5px';
  const time = gcalTimeOn(s, bar.cells[0].date, true);
  return (
    <div
      {...data(s, 'month', bar.cells[0].date)}
      data-gcal-bar
      className={`relative z-10 min-w-0 self-start ${compact ? 'h-[14px]' : ''}`}
      style={{ ...style, marginLeft: bar.startsPeriod ? (compact ? 2 : 4) : 0, marginRight: bar.endsPeriod ? (compact ? 2 : 4) : 0 }}
      title={gcalTip(s)}
    >
      <div
        className="absolute inset-0 flex overflow-hidden border border-dashed border-slate-400 bg-white"
        style={{
          borderTopLeftRadius: bar.startsPeriod ? radius : 0,
          borderBottomLeftRadius: bar.startsPeriod ? radius : 0,
          borderTopRightRadius: bar.endsPeriod ? radius : 0,
          borderBottomRightRadius: bar.endsPeriod ? radius : 0,
          borderLeftWidth: bar.startsPeriod ? 1 : 0,
          borderRightWidth: bar.endsPeriod ? 1 : 0,
        }}
      >
        {bar.cells.map((cell) => (
          <div
            key={cell.date}
            data-gcal-bar-cell={cell.date}
            role="button"
            tabIndex={0}
            onKeyDown={pressKeys}
            onClick={gcalClick(s, cell.date, instead ? () => instead(cell.date) : undefined)}
            className={`relative flex-1 min-w-0 cursor-pointer hover:bg-slate-50 ${isCurrentMonth(cell.date) ? '' : 'opacity-40'}`}
          />
        ))}
      </div>
      {/* 글은 막대 전체에 한 줄로 (누르는 것은 아래 조각으로 지나간다) */}
      <div
        className={`relative pointer-events-none flex items-center gap-1 whitespace-nowrap overflow-hidden text-slate-700 ${compact ? 'h-full px-1 text-2xs leading-none' : 'px-1.5 py-0.5 text-2xs leading-tight'} font-bold`}
      >
        {!bar.startsPeriod && <span className="shrink-0 opacity-60"><Glyph e="◂" /></span>}
        {/* 앱 막대의 라벨 칩 자리 = 캘린더 색 띠 (색 점보다 굵게 - 막대 끝이 어디 것인지) */}
        <span aria-hidden className={`shrink-0 rounded-sm ${compact ? 'w-1 h-2' : 'w-1.5 h-3'}`} style={{ backgroundColor: s.cal.color }} />
        {!compact && time && bar.startsPeriod && <span className="shrink-0 tabular-nums text-slate-500">{time}</span>}
        <span data-gcal-text className="truncate">
          {s.ev.title}
        </span>
        {!bar.endsPeriod && <span className="ml-auto shrink-0 opacity-60"><Glyph e="▸" /></span>}
      </div>
    </div>
  );
}

/** 하루 화면 구분 줄 '📅 구글 캘린더 n ----' (겹친 공간 구분 줄과 같은 꼴 - 휴대폰 2열에서도 한 줄을 다 쓴다) */
export function GcalGroupHeader({ count }: { count: number }) {
  return (
    <div data-gcal-group title="구글 캘린더 일정 - 보기만 합니다 (둘째 줄 '📅 구글'로 끄고 켭니다)" className="col-span-full flex items-center gap-1.5 pt-1.5 text-2xs font-bold text-slate-500 min-w-0">
      <span className="truncate px-1.5 py-0.5 rounded-lg border border-dashed border-slate-300 bg-white text-slate-600"><Glyph e="📅" /> 구글 캘린더</span>
      <span data-gcal-group-count={count} className="px-1.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
        {count}
      </span>
      <span className="flex-1 border-t border-dashed border-slate-200" />
    </div>
  );
}

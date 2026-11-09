// 한눈에 화면 달 칸 (P24-2) - 작은 달력(월요일부터, 보는 주 한 줄 칠함) + 그 달 '달력' 일정 목록.
//   11-09 사용자 요청: 왼쪽 위 칸 = 이번 달(고른 날의 달), 그 아래 칸 = 다음 달 - 보는 달은 부르는 쪽(BoardScreen)이 하나로 들고, 아래 칸은 위 칸 + 1달.
//   달력 날짜를 누르면 그날을 고른다(요일 칸·오른쪽이 따라온다). ◀▶(위 칸에만)는 두 칸을 함께 한 달씩 넘겨 보고 고른 날은 그대로 - 고른 날이 바뀌면 그 달로 돌아온다.
//   날 칸: 고른 날 = 채운 칸, 오늘 = 테두리, 토 파랑·일·공휴일 빨강(domain/dayTone), '달력' 일정이 있는 날 = 아래 점(겹친 공간 것도 - P17-2).
//   달력 판은 ui/MiniMonth(📅 뜨는 달력과 함께 - 그쪽은 일요일부터).
//   아래 목록 = 보는 달의 '달력' 일정(monthList - 하루짜리 + 걸친 기간, 날짜 차례). 줄을 누르면 그날 고르기 + 그 일정 칸, 라벨 칩 = 완료(기간은 전체 - 월간 막대와 같다).
//   겹친 공간 것은 공간 색 배경(P17-2) - 그 공간 칸에서 열고 그 공간에 완료. 둘째 줄 '일정'을 끄면 목록·점이 없다.
import { useMemo } from 'react';
import { setDate, useNav } from '../../app/nav';
import { useHolidayName } from '../../data/holidays';
import { itemLabels, useDocs, useLabelTree, useOverlaySpaces } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { DAY_NUMBER_COLOR, dayToneOf } from '../../domain/dayTone';
import { monthEnd, monthGridDates } from '../../domain/dateUtils';
import { onPeriodDay } from '../../domain/period';
import MiniMonth from '../../ui/MiniMonth';
import { useToday } from '../../ui/useToday';
import { setEventDone } from '../events/actions';
import EventDoneChip from '../events/EventDoneChip';
import { doneAll, doneOnDay, type ItemDoc } from '../events/eventOps';
import { useMulti } from '../events/multi';
import { openEventPanel } from '../events/open';
import { calendarEvents } from '../month/calendarEvents';
import { monthCalendarList, rowDateLabel, type MonthListRow } from './monthList';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};

interface Props {
  /** 고른 날 */
  date: string;
  /** 보는 주 (월 ~ 일) */
  week: readonly string[];
  /** 화면 높이에 맞춘 칸 - 칸 안에서 스크롤 */
  fit: boolean;
  /** 보여 줄 달 'YYYY-MM' */
  ym: string;
  /** 위 칸(이번 달) / 아래 칸(다음 달) */
  slot: 'this' | 'next';
  /** ◀▶ - 위 칸에만 (두 칸을 함께 넘긴다) */
  onStep?: (n: 1 | -1) => void;
}

export default function BoardMonth({ date, week, fit, ym, slot, onStep }: Props) {
  const sid = useCurrentSpaceId();
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const overlays = useOverlaySpaces();
  const showEvents = useNav((s) => s.showEvents);
  const multiOn = useMulti((s) => s.on);
  const today = useToday();
  const holidayName = useHolidayName();

  const [y, m] = ym.split('-').map(Number);

  // 달력 칸 범위의 '달력' 일정 수 (날마다 - 하루짜리 + 그날에 걸친 기간)
  const dates = useMemo(() => monthGridDates(y, m, 1), [y, m]);
  const cal = useMemo(() => calendarEvents(items, dates[0], dates[dates.length - 1], tree, overlays), [items, dates, tree, overlays]);
  const countOn = useMemo(() => {
    const out = new Map<string, number>();
    for (const d of dates) {
      const n = (cal.byDate.get(d)?.length ?? 0) + cal.periods.filter((p) => onPeriodDay(p, d)).length;
      if (n) out.set(d, n);
    }
    return out;
  }, [dates, cal]);
  const rows = useMemo(() => monthCalendarList(cal, `${ym}-01`, monthEnd(y, m)), [cal, ym, y, m]);

  // 겹친 일정은 그 공간에서 열고 끝낸다 (라벨도 그 공간 트리)
  const spaceOf = (ev: ItemDoc) => cal.spaceOf.get(ev);
  const sidOf = (ev: ItemDoc) => spaceOf(ev)?.sid ?? sid;
  const openRow = (row: MonthListRow) => {
    setDate(row.day);
    const s = sidOf(row.ev);
    // 여러 개 고르는 동안은 날만 고른다 (목록 줄은 고르기에 들지 않는다)
    if (s && !multiOn) openEventPanel({ sid: s, date: row.day, id: row.ev.id });
  };
  const doneOf = (row: MonthListRow) => (row.endDate ? doneAll(row.ev) : doneOnDay(row.ev, row.day));
  const toggleDone = (row: MonthListRow) => {
    const s = sidOf(row.ev);
    if (!s) return;
    // 기간 = 전체 (day 없이 - 날마다 끝낸 표시도 걷는다, 월간 막대와 같다)
    if (row.endDate) void setEventDone(s, row.ev, !doneAll(row.ev)).catch(quiet);
    else void setEventDone(s, row.ev, !doneOnDay(row.ev, row.day), { day: row.day }).catch(quiet);
  };

  return (
    <section
      data-board-month={ym}
      data-board-month-slot={slot}
      aria-label={`${slot === 'next' ? '다음 달 ' : ''}${y}년 ${m}월 달력`}
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-xs p-2 flex flex-col gap-2 min-w-0 ${fit ? 'h-full min-h-0 overflow-y-auto overscroll-contain' : 'min-h-[250px]'}`}
    >
      {/* 머리 - ◀▶는 위 칸에만, 아래 칸은 같은 높이에 이름만 (두 칸의 달력 줄이 나란하다) */}
      <div className={`flex items-center gap-1 mb-1 shrink-0 h-6 ${onStep ? 'justify-between' : 'justify-center'}`}>
        {onStep && (
          <button
            type="button"
            data-board-cal-prev
            onClick={() => onStep(-1)}
            title="이전 달 보기 - 아래 칸도 함께 (고른 날은 그대로)"
            aria-label="이전 달 보기"
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            ◀
          </button>
        )}
        <span data-board-cal-title className="min-w-0 truncate text-xs font-extrabold text-slate-700">
          {y}년 {m}월
        </span>
        {onStep && (
          <button
            type="button"
            data-board-cal-next
            onClick={() => onStep(1)}
            title="다음 달 보기 - 아래 칸도 함께 (고른 날은 그대로)"
            aria-label="다음 달 보기"
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            ▶
          </button>
        )}
      </div>
      <div className="shrink-0">
        <MiniMonth
          year={y}
          month={m}
          weekStart={1}
          week={(w) => (w[0] === week[0] ? { className: 'bg-primary/15 rounded-md', data: { 'data-board-cal-week': w[0] } } : undefined)}
          day={(d, inMonth) => {
            const holiday = holidayName(d);
            const selected = d === date;
            const count = showEvents ? (countOn.get(d) ?? 0) : 0;
            const color = selected ? 'text-white font-bold' : inMonth ? DAY_NUMBER_COLOR[dayToneOf(d, holiday)] : 'text-slate-300';
            const bg = selected ? 'bg-primary shadow-2xs' : 'hover:bg-blue-50 hover:text-blue-700';
            const border = !selected && d === today ? 'border border-primary font-bold' : 'border border-transparent';
            const [, mm, dd] = d.split('-').map(Number);
            return (
              <button
                type="button"
                data-board-cal-day={d}
                data-board-cal-count={count || undefined}
                aria-current={selected ? 'date' : undefined}
                onClick={() => setDate(d)}
                title={`${mm}월 ${dd}일${holiday ? ` ${holiday}` : ''}${count ? ` · 달력 일정 ${count}개` : ''} - 누르면 이 날을 고른다`}
                className={`relative h-7 min-w-0 flex flex-col items-center justify-center text-xs leading-none rounded transition-colors cursor-pointer ${color} ${bg} ${border}`}
              >
                {dd}
                {count > 0 && <span aria-hidden className={`absolute bottom-0.5 w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-amber-500'}`} />}
              </button>
            );
          }}
        />
      </div>
      {showEvents && (
        <div data-board-month-list={rows.length} className={`border-t border-slate-100 pt-1.5 ${fit ? 'flex-1 min-h-16 overflow-y-auto overscroll-contain' : ''}`}>
          {rows.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {rows.map((row) => {
                const ev = row.ev;
                const space = spaceOf(ev);
                const label = itemLabels(space?.tree ?? tree, ev.labelIds)[0];
                const done = doneOf(row);
                const here = row.endDate ? row.ev.date! <= date && date <= row.endDate : row.day === date;
                return (
                  <li key={space ? `${space.sid}/${ev.id}` : ev.id}>
                    <button
                      type="button"
                      data-board-month-item={ev.id}
                      data-board-month-item-day={row.day}
                      data-board-month-item-done={done ? '1' : '0'}
                      data-event-space={space?.sid}
                      style={space?.tone}
                      onClick={() => openRow(row)}
                      title={`${rowDateLabel(row)} ${ev.text ?? ''} - 누르면 그날을 고르고 오른쪽 칸에서 고치기`}
                      className={`w-full text-left flex items-start gap-1 px-1.5 py-1 rounded-lg border text-xs leading-snug cursor-pointer hover:shadow-xs ${
                        here ? 'bg-primary/5 border-primary/40' : 'bg-white border-slate-100 hover:border-slate-200'
                      } text-slate-800`}
                    >
                      <span className="shrink-0 font-bold text-2xs text-slate-500 tabular-nums pt-0.5">{rowDateLabel(row)}</span>
                      {/* 감싼 것이 <button>이라 칩은 span(role=button) - 누르면 일정을 열지 않고 완료만 뒤집는다. 끝내면 칩 앞에 ✓ (P10-1) */}
                      <EventDoneChip
                        label={label ?? null}
                        done={done}
                        onToggle={multiOn ? undefined : () => toggleDone(row)}
                        forward={!!label?.props?.forward}
                        whole={!!row.endDate}
                        className="shrink-0 text-2xs px-1 py-0.5"
                        data={{ 'data-board-month-item-chip': ev.id }}
                      />
                      <span data-board-month-item-text className="min-w-0 break-words">
                        {ev.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p data-board-month-empty className="text-xs text-slate-400 py-1 px-1">
              {m}월 달력 일정이 없습니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// 월간 달력 (V4 features/month/MonthGrid.tsx). 한 주가 한 줄 - 날짜 칸은 줄 높이를 다 차지하고(subgrid), 그 사이 줄에 기간 일정 막대.
//   1줄 = 날짜·📝·+ / 막대 줄들 / 마지막 줄 = 그날 일정. 막대가 칸을 건너 이어지도록 막대는 칸 밖(주 격자)에 있다.
//   - 일정은 접지 않고 다 보인다(V4 - '+1개'로 줄이면 무엇인지 몰라 결국 들어가 봐야 한다).
//   - 휴대폰(compact)은 칸 모양은 두고 안에 든 것만 줄인다: 라벨은 색 띠, 제목은 한 줄·칸 폭에 맞춘 글자, 일정·막대를 누르면 그날 목록.
//   - 수업 칩은 P6-1, 공휴일·끌어 옮기기는 P5-3.
import type { MouseEvent as ReactMouseEvent } from 'react';
import { DAY_CELL_BG, DAY_NUMBER_COLOR, dayToneOf } from '../../domain/dayTone';
import { labelColor } from '../../domain/labels';
import { layoutWeekBars, type BarCell } from '../../domain/periodBars';
import { fitToWidthFontSize } from '../../domain/typeScale';
import type { LabelDoc } from '../../data/select';
import { doneOnDay, type ItemDoc } from '../events/eventOps';
import PeriodBar from './PeriodBar';

const WEEKDAYS = [
  { name: '일', color: 'text-red-500' },
  { name: '월', color: 'text-slate-700' },
  { name: '화', color: 'text-slate-700' },
  { name: '수', color: 'text-slate-700' },
  { name: '목', color: 'text-slate-700' },
  { name: '금', color: 'text-slate-700' },
  { name: '토', color: 'text-blue-500' },
];

export interface MonthGridProps {
  /** 달력의 날 (일요일부터 주 단위) */
  dates: readonly string[];
  /** 그 달 'YYYY-MM' */
  month: string;
  today: string;
  showWeekend: boolean;
  showEvents: boolean;
  compact: boolean;
  /** 휴대폰에서 그날 목록을 띄운 날 (칸에 테) */
  selectedDate: string | null;
  eventsOn: (date: string) => ItemDoc[];
  periods: readonly ItemDoc[];
  noteCount: (date: string) => number;
  labelsOf: (ev: ItemDoc) => LabelDoc[];
  pickedOn: (date: string) => ReadonlySet<string>;
  multiOn: boolean;
  onSelectDate: (date: string) => void;
  onAdd: (date: string) => void;
  onOpenNotes: (date: string) => void;
  onEventClick: (ev: ItemDoc, date: string, e: ReactMouseEvent) => void;
  onToggleDone: (ev: ItemDoc, date: string) => void;
  onDelete: (ev: ItemDoc, date: string) => void;
  onOpenLinks: (ev: ItemDoc) => void;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export default function MonthGrid(p: MonthGridProps) {
  const cols = p.showWeekend ? 7 : 5;
  const shown = p.showWeekend ? p.dates : p.dates.filter((d) => ![0, 6].includes(new Date(`${d}T00:00:00`).getDay()));
  const weeks: string[][] = [];
  for (let i = 0; i < shown.length; i += cols) weeks.push(shown.slice(i, i + cols));
  const sundayOf = (d: string) => {
    const dt = new Date(`${d}T00:00:00`);
    dt.setDate(dt.getDate() - dt.getDay());
    return dt.toDateString();
  };
  const todayWeek = sundayOf(p.today);
  const weekdays = p.showWeekend ? WEEKDAYS : WEEKDAYS.slice(1, 6);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" data-month-grid={p.month}>
      <div className={`grid ${p.showWeekend ? 'grid-cols-7' : 'grid-cols-5'} border-b border-slate-200 bg-slate-50/70 text-center py-2.5`}>
        {weekdays.map((w) => (
          <div key={w.name} className={`text-xs font-black ${w.color}`}>
            {w.name}
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {weeks.map((week) => {
          const layout = p.showEvents ? layoutWeekBars(week, p.periods) : { bars: [], lanes: 0 };
          const lanes = layout.lanes;
          return (
            <div
              key={week[0]}
              data-month-week={week[0]}
              // 둘째 줄 날짜를 누르면 오늘로 (app/todayScroll) - 오늘 칸이 없으면(주말을 감춘 토·일) 이 줄
              data-today-area={sundayOf(week[0]) === todayWeek ? 'true' : undefined}
              className={`grid ${p.showWeekend ? 'grid-cols-7' : 'grid-cols-5'} ${p.compact ? 'min-h-[64px] gap-y-[2px]' : 'min-h-[74px] gap-y-1'}`}
              style={{ gridTemplateRows: `auto${lanes ? ` repeat(${lanes}, auto)` : ''} 1fr` }}
            >
              {week.map((date, col) => {
                const inMonth = date.startsWith(p.month);
                const tone = dayToneOf(date);
                const isToday = date === p.today;
                const day = Number(date.slice(8, 10));
                const notes = p.noteCount(date);
                const picked = p.pickedOn(date);
                return (
                  <div
                    key={date}
                    data-month-day={date}
                    data-today={isToday ? 'true' : undefined}
                    data-selected={p.selectedDate === date ? 'true' : undefined}
                    onClick={() => p.onSelectDate(date)}
                    style={{ gridColumn: col + 1, gridRow: '1 / -1', gridTemplateRows: 'subgrid' }}
                    className={`${p.compact ? 'p-1' : 'p-2'} grid transition-all cursor-pointer group hover:brightness-98 min-w-0 overflow-hidden ${col > 0 ? 'border-l border-slate-100' : ''} ${
                      !inMonth ? 'bg-slate-50/40 opacity-40' : DAY_CELL_BG[tone]
                    } ${p.selectedDate === date ? 'ring-2 ring-inset ring-primary' : isToday ? 'ring-2 ring-inset ring-primary/40' : ''}`}
                  >
                    <div className="min-w-0" style={{ gridRow: 1 }}>
                      <div className={`flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 ${p.compact ? 'mb-0.5' : 'mb-1.5'}`}>
                        <span
                          data-month-day-number
                          className={`text-xs font-black shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday ? 'bg-primary text-white shadow-xs' : DAY_NUMBER_COLOR[tone]}`}
                        >
                          {day}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {notes > 0 && (
                            <button
                              type="button"
                              data-month-notes={notes}
                              onClick={(e) => {
                                stop(e);
                                p.onOpenNotes(date);
                              }}
                              title={`기록 ${notes}건 보기`}
                              aria-label={`기록 ${notes}건 보기`}
                              className="inline-flex items-center gap-px px-1 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-2xs font-bold leading-none hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
                            >
                              <span aria-hidden>📝</span>
                              <span>{notes}</span>
                            </button>
                          )}
                          {!p.compact && (
                            <button
                              type="button"
                              data-month-add={date}
                              onClick={(e) => {
                                stop(e);
                                p.onAdd(date);
                              }}
                              className="w-5 h-5 rounded hover:bg-slate-200 text-slate-400 hover:text-primary flex items-center justify-center transition-colors text-xs font-bold leading-none opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="이 날 새 일정 (오른쪽 칸)"
                              aria-label="이 날 새 일정"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {p.showEvents && (
                      <div className={`min-w-0 ${p.compact ? 'space-y-[2px]' : 'space-y-1'}`} style={{ gridRow: lanes + 2 }}>
                        {p.eventsOn(date).map((ev) => {
                          const label = p.labelsOf(ev)[0];
                          const c = label ? labelColor(label.color) : null;
                          const done = doneOnDay(ev, date);
                          const links = ev.linkIds?.length ?? 0;
                          const isPicked = picked.has(ev.id);
                          return (
                            <div
                              key={ev.id}
                              data-month-event={ev.id}
                              data-month-event-done={done ? '1' : '0'}
                              data-event-picked={isPicked ? '1' : undefined}
                              onClick={(e) => {
                                stop(e);
                                p.onEventClick(ev, date, e);
                              }}
                              style={p.compact && c && !done ? { borderLeftWidth: '3px', borderLeftColor: c.border } : undefined}
                              title="누르면 오른쪽 칸에서 고치기"
                              className={`group/ev relative rounded text-2xs font-medium leading-tight transition-all border block hover:shadow-sm cursor-pointer ${
                                p.compact ? 'px-1 py-[1px] truncate whitespace-nowrap [container-type:inline-size]' : 'px-1.5 py-0.5 break-words'
                              } ${isPicked ? 'bg-primary/10 border-primary text-primary' : done ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-blue-50 text-blue-800 border-blue-100'}`}
                            >
                              {p.multiOn && <input type="checkbox" checked={isPicked} readOnly tabIndex={-1} className="inline-block align-middle mr-1 pointer-events-none" />}
                              {/* 휴대폰은 라벨 이름 대신 왼쪽 색 띠 (이름이 칸의 절반을 먹었다 - V4) */}
                              {label && c && !p.multiOn && !p.compact && (
                                <span
                                  data-month-event-chip={ev.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    stop(e);
                                    p.onToggleDone(ev, date);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                    e.preventDefault();
                                    stop(e);
                                    p.onToggleDone(ev, date);
                                  }}
                                  title={done ? '눌러서 완료 풀기' : '눌러서 완료'}
                                  className="inline-block align-middle mr-1 text-2xs font-bold px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap cursor-pointer"
                                  style={{
                                    backgroundColor: done ? 'var(--color-slate-100)' : c.bg,
                                    color: done ? 'var(--color-slate-400)' : c.text,
                                    border: '1px solid ' + (done ? 'var(--color-slate-200)' : c.border),
                                  }}
                                >
                                  {label.name}
                                </span>
                              )}
                              <span className={`inline align-middle ${done ? 'line-through text-slate-400' : ''}`} style={p.compact ? { fontSize: fitToWidthFontSize(ev.text) } : undefined}>
                                {ev.text}
                              </span>
                              {links > 0 && !p.compact && (
                                <button
                                  type="button"
                                  data-month-event-links={links}
                                  onClick={(e) => {
                                    stop(e);
                                    p.onOpenLinks(ev);
                                  }}
                                  className="inline-flex align-middle ml-1 bg-yellow-100 text-yellow-800 text-2xs px-1 py-0.5 rounded font-bold border border-yellow-300 hover:bg-yellow-200 cursor-pointer"
                                  title={`링크된 항목 ${links}개`}
                                >
                                  🔗 {links}
                                </button>
                              )}
                              {!p.multiOn && !p.compact && (
                                <button
                                  type="button"
                                  data-month-event-delete={ev.id}
                                  onClick={(e) => {
                                    stop(e);
                                    p.onDelete(ev, date);
                                  }}
                                  title="일정 삭제"
                                  aria-label="일정 삭제"
                                  className="absolute -top-1.5 -right-1 w-4 h-4 hidden group-hover/ev:flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs text-2xs text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {layout.bars.map((bar) => {
                const label = p.labelsOf(bar.item)[0];
                return (
                  <PeriodBar
                    key={`${bar.item.id}@${bar.start}`}
                    bar={bar}
                    labelName={label?.name ?? ''}
                    labelColor={label ? labelColor(label.color) : null}
                    compact={p.compact}
                    multiOn={p.multiOn}
                    picked={(cell: BarCell) => p.pickedOn(cell.date).has(bar.item.id)}
                    isCurrentMonth={(d) => d.startsWith(p.month)}
                    onOpen={(cell, e) => p.onEventClick(bar.item, cell.date, e)}
                    onOpenLinks={() => p.onOpenLinks(bar.item)}
                    style={{ gridColumn: `${bar.start + 1} / span ${bar.len}`, gridRow: bar.lane + 2 }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 휴대폰 월간의 '그날 목록' (V4 features/month/MonthDaySheet.tsx - V4 ROADMAP 15).
// 휴대폰 월간 칸은 53px 남짓이라 일정이 한 줄로 잘린다. 칸 모양은 두고, 날짜를 누르면 아래 탭바 위에 그날 목록이 올라온다.
// 달력은 가리지 않아 날짜를 연달아 눌러 볼 수 있고, 같은 날을 한 번 더 누르거나 '하루 화면'을 누르면 하루 화면으로 간다.
// 창(ModalShell)이 아니다 - 휴대폰 창은 오른쪽에서 화면을 덮어 달력이 가려진다. 이것은 화면의 일부다. 수업 칩은 P6-1.
import { useLayoutEffect, useState } from 'react';
import { DAY_NAMES, parseDateStr } from '../../domain/dateUtils';
import SchoolEventName from '../school/SchoolEventName';
import { useSchoolSchedule } from '../school/school';
import { labelColor } from '../../domain/labels';
import type { LabelDoc } from '../../data/select';
import { doneOnDay, type ItemDoc } from '../events/eventOps';

interface Props {
  date: string;
  /** 달력에 올린 그날 일정 (하루짜리 + 기간) */
  events: readonly ItemDoc[];
  /** 달력에 올리지 않은 그날 일정 수 */
  hiddenCount: number;
  showEvents: boolean;
  labelsOf: (ev: ItemDoc) => LabelDoc[];
  onClose: () => void;
  onGoDay: () => void;
  onAdd: () => void;
  onOpenEvent: (ev: ItemDoc) => void;
  /** 라벨 칩 = 완료 (여러 개 고르기 중에는 넘기지 않는다) */
  onToggleDone?: (ev: ItemDoc) => void;
}

export default function MonthDaySheet({ date, events, hiddenCount, showEvents, labelsOf, onClose, onGoDay, onAdd, onOpenEvent, onToggleDone }: Props) {
  // 아래 탭바 바로 위에 붙는다 (탭바 높이는 기기 안전 여백에 따라 달라 재서 쓴다)
  const [tabBarHeight, setTabBarHeight] = useState(0);
  useLayoutEffect(() => {
    const bar = document.querySelector('[data-mobile-tabbar]') as HTMLElement | null;
    if (!bar) return;
    const update = () => setTabBarHeight(bar.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
  // 우리 학교 학사일정 (P6-3)
  const { byDate: schoolEvents } = useSchoolSchedule([date.slice(0, 7)]);
  const d = parseDateStr(date);
  const title = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;

  return (
    <section
      data-month-day-sheet={date}
      aria-label={`${title} 목록`}
      style={{ bottom: tabBarHeight }}
      className="fixed left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-6px_20px_rgba(15,23,42,0.12)] rounded-t-2xl max-h-[46vh] flex flex-col animate-fade-in"
    >
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 border-b border-slate-100 shrink-0">
        <h3 className={`font-black text-sm whitespace-nowrap ${d.getDay() === 0 ? 'text-red-600' : d.getDay() === 6 ? 'text-blue-600' : 'text-slate-800'}`}>{title}</h3>
        <SchoolEventName items={schoolEvents[date]} />
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button type="button" data-sheet-add onClick={onAdd} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer">
            + 일정
          </button>
          <button type="button" data-sheet-go-day onClick={onGoDay} className="px-2 py-1 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer">
            하루 화면 →
          </button>
          <button type="button" data-sheet-close onClick={onClose} title="닫기" className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 flex flex-col gap-2" data-scroll-lock>
        {showEvents && (
          <ul className="flex flex-col gap-1">
            {events.map((ev) => {
              const label = labelsOf(ev)[0];
              const c = label ? labelColor(label.color) : null;
              const done = doneOnDay(ev, date);
              const links = ev.linkIds?.length ?? 0;
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    data-sheet-event={ev.id}
                    onClick={() => onOpenEvent(ev)}
                    className={`w-full text-left flex items-start gap-1.5 px-2 py-1.5 rounded-lg border text-sm leading-snug cursor-pointer ${
                      done ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {label && c && (
                      // 감싼 것이 <button>이라 칩은 span(role=button) - 누르면 일정을 열지 않고 완료만 뒤집는다
                      <span
                        role={onToggleDone ? 'button' : undefined}
                        data-sheet-event-chip={ev.id}
                        title={onToggleDone ? '눌러서 완료' : undefined}
                        onClick={
                          onToggleDone
                            ? (e) => {
                                e.stopPropagation();
                                onToggleDone(ev);
                              }
                            : undefined
                        }
                        className={`shrink-0 text-2xs font-bold px-1.5 py-0.5 rounded ${onToggleDone ? 'cursor-pointer' : ''}`}
                        style={{
                          backgroundColor: done ? 'var(--color-slate-100)' : c.bg,
                          color: done ? 'var(--color-slate-400)' : c.text,
                          border: `1px solid ${done ? 'var(--color-slate-200)' : c.border}`,
                        }}
                      >
                        {label.name}
                      </span>
                    )}
                    <span className={`min-w-0 break-words ${done ? 'line-through' : ''}`}>{ev.text}</span>
                    {links > 0 && <span className="ml-auto shrink-0 text-2xs font-bold text-yellow-700">🔗 {links}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {showEvents && events.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">달력에 올린 일정이 없습니다.</p>}
        {showEvents && hiddenCount > 0 && (
          <button type="button" data-sheet-hidden={hiddenCount} onClick={onGoDay} className="text-left text-xs text-slate-400 cursor-pointer">
            달력에 올리지 않은 일정 {hiddenCount}개 - 하루 화면에서 봅니다 →
          </button>
        )}
      </div>
    </section>
  );
}

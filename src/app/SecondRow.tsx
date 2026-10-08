// 머리줄 둘째 줄 (MENU.md 3-2 - 메모·학급 화면에는 없다). V4 그대로.
import MiniCalendarPicker from '../ui/MiniCalendarPicker';
import { useShortcutTitle } from './keys';
import { dateLabel, goToday, setDate, setSemesterFilter, setToggle, stepDate, useNav, type SemesterFilter } from './nav';

const VIEW_TOGGLES = [
  { key: 'showWeekend', label: '주말', shortcut: 'toggleWeekend' },
  { key: 'showEvents', label: '일정', shortcut: 'toggleEvents' },
  { key: 'showClass', label: '수업', shortcut: 'toggleClass' },
] as const;

const SEMESTERS: Array<{ id: SemesterFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 1, label: '1학기' },
  { id: 2, label: '2학기' },
];

/**
 * 둘째 줄 (메모·학급 화면에는 없다) - V4 그대로: 년간 학기 칩 · 토글(주말·일정·수업) · ◀ 날짜(누르면 오늘) 📅 · D-Day · ▶
 * ⚠️ 좁은 화면에서는 줄을 바꾼다. 한 줄에 밀어 넣었더니 년간의 '2학기' 칩 위에 '◀'가 올라앉아 2학기를 누르면 이전 학년도로 넘어갔다(V4).
 */
export default function SecondRow() {
  const nav = useNav();
  const withShortcut = useShortcutTitle();

  return (
    <div
      data-second-row
      className="flex flex-wrap sm:flex-nowrap items-center justify-between border-t border-dashed border-slate-200 pt-2.5 mt-0.5 max-w-7xl mx-auto w-full gap-2 sm:overflow-x-auto"
    >
      {/* 년간 학기 칩 - 좁은 화면에서는 아랫줄로 (토글·날짜 이동만으로 360px가 꽉 찬다) */}
      {nav.scope === 'year' && (
        <div className="order-3 w-full sm:order-1 sm:w-auto flex-none">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
            {SEMESTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-semester={s.id}
                aria-pressed={nav.semesterFilter === s.id}
                onClick={() => setSemesterFilter(s.id)}
                className={`px-1.5 py-0.5 text-2xs sm:px-2 sm:py-1 sm:text-xs rounded-lg font-bold whitespace-nowrap transition-all ${
                  nav.semesterFilter === s.id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 주말·일정·수업 토글 - 늘 쓰는 것이라 휴대폰에서도 ⋮에 넣지 않고 작게 줄여 날짜와 한 줄에 둔다 (V4) */}
      <div className="flex order-1 sm:order-2 items-center gap-1 sm:gap-1.5 flex-none">
        {VIEW_TOGGLES.map((t) => {
          const on = nav[t.key];
          return (
            <button
              key={t.key}
              type="button"
              data-view-toggle={t.key}
              aria-pressed={on}
              onClick={() => setToggle(t.key, !on)}
              title={withShortcut(`${t.label} ${on ? '숨기기' : '보이기'}`, t.shortcut)}
              className={`px-1.5 py-0.5 text-2xs sm:px-3 sm:py-1 sm:text-xs rounded-lg font-bold border transition-all whitespace-nowrap ${
                on ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-400 border-slate-200 line-through decoration-slate-300'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ◀ 날짜(누르면 오늘) 📅 ▶ */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-4 flex-1 min-w-0 order-2 sm:order-3">
        <button
          type="button"
          data-date-prev
          onClick={() => stepDate(-1)}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs sm:text-sm transition-all shadow-2xs cursor-pointer"
          title={withShortcut('이전 날짜', 'datePrev')}
        >
          ◀
        </button>
        <div className="flex items-center">
          <button
            type="button"
            data-date-label
            onClick={goToday}
            className="text-sm sm:text-base font-extrabold text-slate-800 hover:text-primary transition-colors cursor-pointer select-none text-center whitespace-nowrap px-1"
            title={withShortcut('오늘 날짜로 돌아가기', 'dateToday')}
          >
            {dateLabel(nav.scope, nav.date)}
          </button>
          <MiniCalendarPicker date={nav.date} onSelectDate={setDate} />
        </div>
        {/* P5-3: 보는 날 기준 D-Day 남은 날 (하루 화면에서 오늘이 아닐 때) */}
        <button
          type="button"
          data-date-next
          onClick={() => stepDate(1)}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs sm:text-sm transition-all shadow-2xs cursor-pointer"
          title={withShortcut('다음 날짜', 'dateNext')}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

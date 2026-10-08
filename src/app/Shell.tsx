// 로그인한 뒤의 껍데기: 머리줄(첫 줄·둘째 줄) · 본문(지금 화면) · 휴대폰 탭바. V4 components/Layout.tsx의 틀.
//
// V4 Layout은 창 30여 개의 열림 상태와 키 처리를 모두 들고 있었다(1,200줄). V5는 창을 창 목록(windows.ts)에,
// 키를 단축키 한 곳(shortcuts.ts)에 두고, 여기는 자리만 잡는다.
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSession } from '../data/session';
import ColumnResizer from '../ui/ColumnResizer';
import MiniCalendarPicker from '../ui/MiniCalendarPicker';
import { RIGHT_COLUMN_CSS_WIDTH, useSidePopups } from '../ui/sideColumn';
import SideTabs from '../ui/SideTabs';
import { MainWidthContext } from '../ui/useMainWidth';
import { startRouting } from './history';
import { useAppKeys, useShortcutTitle } from './keys';
import { useLayoutPrefs } from './layoutPrefs';
import MobileTabBar from './MobileTabBar';
import { dateLabel, goToday, setDate, setScope, setSemesterFilter, setToggle, stepDate, useNav, type SemesterFilter } from './nav';
import { isDatelessScope } from './route';
import { SCREEN_COMPONENTS, SCREENS } from './screens';
import { useGlobalGestures } from './useGlobalGestures';
import WindowHost from './WindowHost';
import './windowList';
import { closeAllWindows } from './windows';

export default function Shell() {
  const user = useSession((s) => s.user);
  const scope = useNav((s) => s.scope);

  // 주소와 맞물린다 (뒤로가기 = 앞 화면, 새로고침해도 그 자리)
  useEffect(() => startRouting(), []);
  useGlobalGestures();
  useAppKeys();

  // 오른쪽 줄(창·쓰는 칸)이 하나라도 서 있으면 그 폭만큼 화면을 줄인다. 폭은 모든 칸이 같다.
  const rightOpen = useSidePopups((s) => s.order.length > 0);
  // 경계선을 끌어 바꾼 폭. 칸들은 body 아래에 그려지므로(createPortal) 문서 맨 위에 건다.
  const rightPanelWidth = useLayoutPrefs((s) => s.rightPanelWidth);
  useEffect(() => {
    const root = document.documentElement.style;
    if (rightPanelWidth) root.setProperty('--right-column-w', `${rightPanelWidth}px`);
    else root.removeProperty('--right-column-w');
  }, [rightPanelWidth]);

  // 머리줄 높이를 --app-header-h로 알려 둔다. 머리줄에 붙어 따라 내려가는 칸(메모 화면의 라벨 거르개 등)이
  // 그만큼 아래에 멈춘다. 머리줄은 줄바꿈과 D-Day 표시에 따라 높이가 달라지므로 재서 쓴다.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--app-header-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--app-header-h');
    };
  }, []);

  // 본문의 실제 폭. 오른쪽 칸이 열려 좁아지면 화면들이 그에 맞춰 칸 수를 줄인다 (ui/useMainWidth)
  const mainRef = useRef<HTMLElement>(null);
  const [mainWidth, setMainWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const el = mainRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // 안쪽 여백을 뺀 폭 (CSS의 @container 가 재는 폭과 같게)
    const measure = () => {
      const cs = getComputedStyle(el);
      setMainWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // 어느 계정으로 들어와 있는지 언제든 확인할 수 있게 (V4 - 계정이 여럿이면 화면만 봐서는 알 수 없었다)
  const accountTitle = user?.email ? `${user.displayName || '사용자'} (${user.email})` : user?.displayName || '사용자';
  const Screen = SCREEN_COMPONENTS[scope];
  const withShortcut = useShortcutTitle();

  return (
    <div
      className="min-h-screen bg-bg-body text-slate-900 transition-[padding] duration-200"
      style={{ paddingRight: rightOpen ? RIGHT_COLUMN_CSS_WIDTH : undefined }}
    >
      <header ref={headerRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-border shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          {/* 자리가 모자라면 겹치는 대신 화면 탭 묶음이 아랫줄로 내려간다 (V4) */}
          <div className="flex flex-wrap items-center justify-between flex-1 gap-x-0.5 sm:gap-x-4 gap-y-1.5 pr-1 sm:pr-2 min-w-0">
            <div className="flex items-center gap-0.5 sm:gap-2 shrink">
              <h1 className="text-base sm:text-xl font-extrabold text-primary tracking-tighter pr-0 sm:pr-1 shrink-0">SP5</h1>
              {/* ■4: ⏳ D-Day · 🗑️ 휴지통 */}
            </div>
            <div className="flex flex-wrap items-center gap-0.5 sm:gap-2 gap-y-1.5 shrink min-w-0">
              {/* ■4: ＋ 새로 · 🔍 검색 */}
              {/* 화면 탭 - 좁은 화면에서는 아래 탭바(MobileTabBar)가 대신한다 */}
              <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0 overflow-hidden">
                {SCREENS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    data-scope-tab={s.id}
                    aria-pressed={scope === s.id}
                    onClick={() => setScope(s.id)}
                    title={withShortcut(`${s.label} 화면`, s.shortcut)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      scope === s.id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽 끝 (? · ⋮ · 사진) - ■4에서 ?·⋮, P1-4에서 사진을 누르면 계정 칸 */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0 pl-1 border-l border-slate-200">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                data-account
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white shadow-sm object-cover"
                title={accountTitle}
              />
            ) : (
              <div
                data-account
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm"
                title={accountTitle}
              >
                {(user?.displayName || '선').charAt(0)}
              </div>
            )}
          </div>
        </div>
        {!isDatelessScope(scope) && <SecondRow />}
      </header>

      {/* 아래 탭바에 내용이 가리지 않도록 아래 여백을 둔다 */}
      <main ref={mainRef} className="@container px-3 py-3 sm:p-5 max-w-7xl mx-auto pb-24 sm:pb-5">
        <MainWidthContext.Provider value={mainWidth}>
          <Suspense fallback={<p className="p-6 text-xs text-slate-400">불러오는 중…</p>}>
            <Screen />
          </Suspense>
        </MainWidthContext.Provider>
      </main>

      <MobileTabBar />

      {/* 창·쓰는 칸 (창 목록). 화면과 따로 살아서 다른 화면으로 옮겨도 남는다. */}
      <WindowHost />
      {/* 오른쪽 칸이 둘 이상이면 위에 탭 (V4 2026-10-07) */}
      <SideTabs />
      {rightOpen && <ColumnResizer side="right" width={RIGHT_COLUMN_CSS_WIDTH} />}
      {/* 오른쪽 줄을 닫는 작은 단추 (V4 2026-09-30) - ESC와 같다(저장 안 한 글이 있으면 먼저 묻는다) */}
      {rightOpen && (
        <button
          type="button"
          data-close-column
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => closeAllWindows()}
          title="오른쪽 칸 닫기 (ESC와 같음)"
          aria-label="오른쪽 칸 닫기"
          className="fixed top-1/2 -translate-y-1/2 z-[46] w-6 h-14 flex items-center justify-center rounded-l-xl bg-white/90 border border-r-0 border-slate-200 shadow-md text-xs text-slate-500 hover:bg-primary/10 hover:w-7 transition-all cursor-pointer"
          style={{ right: RIGHT_COLUMN_CSS_WIDTH }}
        >
          ▶
        </button>
      )}
    </div>
  );
}

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
function SecondRow() {
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

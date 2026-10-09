// 로그인한 뒤의 껍데기: 머리줄(첫 줄·둘째 줄) · 본문(지금 화면) · 휴대폰 탭바. V4 components/Layout.tsx의 틀.
//
// V4 Layout은 창 30여 개의 열림 상태와 키 처리를 모두 들고 있었다(1,200줄). V5는 창을 창 목록(windows.ts)에,
// 키를 단축키 한 곳(shortcuts.ts)에 두고, 여기는 자리만 잡는다.
import { Suspense, useEffect, useRef, useState } from 'react';
import EventAlarms from '../features/events/EventAlarms';
import ForwardMarks from '../features/events/ForwardMarks';
import MultiSelectBar from '../features/events/MultiSelectBar';
import { useEventShortcuts } from '../features/events/shortcuts';
import { useNoteShortcuts } from '../features/notes/shortcuts';
import { useTimetableShortcuts } from '../features/timetable/shortcuts';
import { useProgressShortcuts } from '../features/progress/shortcuts';
import { useClassBellRunner } from '../features/bell/bell';
import { usePrintShortcut } from './printScreen';
import { useClassShortcuts } from '../features/class/view';
import { useAttendanceShortcuts } from '../features/attendance/open';
import { useNoticeShortcuts } from '../features/notices/shortcuts';
import { useSearchFocusRunner } from '../features/search/focus';
import { useTrashAutoEmpty } from '../features/trash/auto';
import { useWeekShortcuts } from '../features/week/prefs';
import GoogleLoginPrompt from '../features/auth/GoogleLoginPrompt';
import { LEFT_COLUMN_CSS_WIDTH, useClipboardCapture, useClipboardPanel } from '../features/clipboard/capture';
import ClipboardColumn from '../features/clipboard/ClipboardColumn';
import ImportBanner from '../features/import/ImportBanner';
import ColumnResizer from '../ui/ColumnResizer';
import ImageViewer from '../ui/ImageViewer';
import { RIGHT_COLUMN_CSS_WIDTH, useDocked, useSidePopups } from '../ui/sideColumn';
import SideTabs from '../ui/SideTabs';
import { MainWidthContext } from '../ui/useMainWidth';
import { startRouting } from './history';
import Header from './Header';
import { useAppKeys } from './keys';
import { useLayoutPrefs } from './layoutPrefs';
import MobileTabBar from './MobileTabBar';
import { useNav } from './nav';
import { isDatelessScope } from './route';
import { SCREEN_COMPONENTS } from './screens';
import SecondRow from './SecondRow';
import { useGlobalGestures } from './useGlobalGestures';
import WindowHost from './WindowHost';
import './windowList';
import { closeAllWindows } from './windows';

export default function Shell() {
  const scope = useNav((s) => s.scope);

  // 주소와 맞물린다 (뒤로가기 = 앞 화면, 새로고침해도 그 자리)
  useEffect(() => startRouting(), []);
  useGlobalGestures();
  useAppKeys();
  // ＋ 새로 → 새 일정 (단축키 newEvent)
  useEventShortcuts();
  useNoteShortcuts();
  useTimetableShortcuts();
  useProgressShortcuts();
  useClassBellRunner();
  usePrintShortcut();
  useClassShortcuts();
  useAttendanceShortcuts();
  useNoticeShortcuts();
  // 작년 이맘때 보이기 / 숨기기 (주간)
  useWeekShortcuts();
  // 검색 결과로 간 카드 짚기 (P5-4)
  useSearchFocusRunner();
  // 휴지통 자동 비우기 - 하루 한 번 (P5-4)
  useTrashAutoEmpty();
  // 복사한 것 모으기 (왼쪽 📋 클립보드 칸 - 닫혀 있어도 모은다)
  useClipboardCapture();

  // 오른쪽 줄(창·쓰는 칸)이 하나라도 서 있으면 그 폭만큼 화면을 줄인다. 폭은 모든 칸이 같다.
  const rightOpen = useSidePopups((s) => s.order.length > 0);
  // 왼쪽 클립보드 칸이 화면 옆에 붙어 있으면 그 폭만큼 화면을 오른쪽으로 민다 (휴대폰은 위에 덮는다)
  const docked = useDocked();
  const leftOpen = useClipboardPanel((s) => s.open) && docked;
  // 경계선을 끌어 바꾼 폭. 칸들은 body 아래에 그려지므로(createPortal) 문서 맨 위에 건다.
  const rightPanelWidth = useLayoutPrefs((s) => s.rightPanelWidth);
  const leftPanelWidth = useLayoutPrefs((s) => s.leftPanelWidth);
  useEffect(() => {
    const root = document.documentElement.style;
    if (rightPanelWidth) root.setProperty('--right-column-w', `${rightPanelWidth}px`);
    else root.removeProperty('--right-column-w');
    if (leftPanelWidth) root.setProperty('--left-column-w', `${leftPanelWidth}px`);
    else root.removeProperty('--left-column-w');
  }, [rightPanelWidth, leftPanelWidth]);

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

  const Screen = SCREEN_COMPONENTS[scope];

  return (
    <div
      className="min-h-screen bg-bg-body text-slate-900 transition-[padding] duration-200"
      style={{ paddingRight: rightOpen ? RIGHT_COLUMN_CSS_WIDTH : undefined, paddingLeft: leftOpen ? LEFT_COLUMN_CSS_WIDTH : undefined }}
    >
      <header ref={headerRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-border shadow-xs flex flex-col gap-2.5">
        <Header />
        {!isDatelessScope(scope) && <SecondRow />}
      </header>

      {/* 아래 탭바에 내용이 가리지 않도록 아래 여백을 둔다 */}
      <main ref={mainRef} className="@container px-3 py-3 sm:p-5 max-w-7xl mx-auto pb-24 sm:pb-5">
        {/* 처음 로그인 'V4 자료 가져오기' 띠 (V4 자료가 있고 가져온 적이 없을 때만) */}
        <ImportBanner />
        <MainWidthContext.Provider value={mainWidth}>
          <Suspense fallback={<p className="p-6 text-xs text-slate-400">불러오는 중…</p>}>
            <Screen />
          </Suspense>
        </MainWidthContext.Provider>
      </main>

      <MobileTabBar />

      {/* 창·쓰는 칸 (창 목록). 화면과 따로 살아서 다른 화면으로 옮겨도 남는다. */}
      <WindowHost />
      {/* ⏰ 일정 알림 (앱 안 - 서버 푸시는 P8-2) */}
      <EventAlarms />
      {/* 이월: 처음 따라오는 일정에 carrying 한 번 (DESIGN 5-1) */}
      <ForwardMarks />
      {/* '구글 로그인이 필요합니다' - 드라이브·캘린더를 쓰다 토큰이 만료됐는데 로그인 창이 막힐 때 (data/google) */}
      <GoogleLoginPrompt />
      {/* 왼쪽 📋 클립보드 칸 (이 기기에만) */}
      <ClipboardColumn />
      {leftOpen && <ColumnResizer side="left" width={LEFT_COLUMN_CSS_WIDTH} />}
      {/* 사진 크게 보기 (ui/imageViewer) */}
      <ImageViewer />
      {/* 여러 개 고르기 - 고르는 동안 화면 아래 동작 줄 */}
      <MultiSelectBar />
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


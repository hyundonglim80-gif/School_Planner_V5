// 한눈에 화면 (P24 - 사용자 손 그림 11-06). 왼쪽 = 이번 달·다음 달 작은 달력 + 한 주 요일 칸(P24-2 · 11-09), 오른쪽 = 고른 날의 수업·일정·메모(하루 화면 칸 그대로).
// 고른 날 = 둘째 줄 날짜(app/nav), ◀▶ = 한 주. 화면 탭은 맨 앞·Shift+7(P24-3 · 11-09 차례), 휴대폰 탭바·밀기에는 없다(주소로 열면 쌓아 보인다).
//
//   ┌11월┬ 월 ┬ 화 ┬ 수 ┐┃┌ 11월 6일 (금) ─────┐
//   │    │    │    │    │┃│ 수업 ┃ 일정        │   ┃ ━ = 경계선(ui/SplitPane) - 끌어서 크기, 두 번 누르면 기본. 비율은 이 기기에(app/boardPrefs)
//   ├12월┼ 목 ┼ 금 ┼ 토 ┤┃├━━━━━━┻━━━━━━━━━━━━━┤
//   │    │    │ ★  ├ 일 ┤┃│ 메모                │   칸마다 칸 안에서 스크롤, 화면은 창 높이에 맞춘다
//   └────┴────┴────┴────┘┃└─────────────────────┘
// 왼쪽 요일 칸 = 주간 요일 카드 그대로(week/useWeekCards - 수업 줄·일정 칩·📝 n·끌어 옮기기·여러 개 고르기·겹쳐 보기). 카드 빈 곳 = 그날 고르기(★ outline).
// 11-09 사용자 요청: 왼쪽 위 칸 = 이번 달(고른 날의 달), 그 아래 칸 = 다음 달(작은 달력 + 그 달 '달력' 일정 목록 - BoardMonth, ◀▶는 위 칸에서 두 칸을 함께),
//   토·일은 수업이 없으니 수업 줄 없이 한 칸을 위(토)·아래(일)로 나눈다. 주말을 감추면 그 칸이 빈다(요일 칸 자리·크기는 그대로).
// 기준(P24-1 ■0): 본문 780px 밑이면 두 무리를 위아래로 쌓고(경계선 없이 화면이 스크롤), 오른쪽 무리 480px 밑이면 수업/일정을 위아래로.
// 수정 칸이 열리면 본문이 줄어도 비율 그대로 접힌다(5장 'P24 오른쪽 칸').
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { setBoardSplit, useBoardSplit } from '../../app/boardPrefs';
import { setDate, useNav } from '../../app/nav';
import { useCurrentSpaceId } from '../../data/session';
import { DAY_NAMES, weekDates, weekdayOf } from '../../domain/dateUtils';
import SplitPane from '../../ui/SplitPane';
import { useElementWidth } from '../../ui/useElementWidth';
import { MainWidthContext, unscaledWidth, useMainWidth } from '../../ui/useMainWidth';
import { useToday } from '../../ui/useToday';
import DayBody from '../day/DayBody';
import DayEvents from '../day/DayEvents';
import DayJournal from '../day/DayJournal';
import { journalColumnsFor } from '../day/journalColumns';
import DayLessons from '../lessons/DayLessons';
import { useWeekCards } from '../week/useWeekCards';
import BoardMonth from './BoardMonth';
import { shiftMonth } from './monthList';
import { useFitHeight } from './useFitHeight';

/** 본문이 이보다 좁으면 두 무리를 쌓는다 (왼쪽 최소 440 + 오른쪽 최소 320 + 경계선) */
const STACK_BELOW = 780;
/** 오른쪽 무리가 이보다 좁으면 수업/일정을 위아래로 */
const DAY_ROW_MIN = 480;

export default function BoardScreen() {
  const date = useNav((s) => s.date);
  const stacked = useMainWidth() < STACK_BELOW;
  const boxRef = useRef<HTMLDivElement>(null);
  const height = useFitHeight(boxRef, !stacked);
  const mainRatio = useBoardSplit('main');

  if (stacked) {
    return (
      <div ref={boxRef} data-screen="board" data-board-date={date} data-board-stacked className="animate-fade-in pb-12 flex flex-col gap-6">
        <BoardLeft fit={false} date={date} />
        <div data-board-day-group className="flex flex-col gap-3">
          <DayTitle date={date} />
          <DayBody date={date} />
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} data-screen="board" data-board-date={date} className="animate-fade-in flex flex-col" style={height ? { height } : undefined}>
      <SplitPane
        name="board-main"
        direction="row"
        ratio={mainRatio}
        onCommit={(r) => setBoardSplit('main', r)}
        minFirst={440}
        minSecond={320}
        label="왼쪽 · 오른쪽 칸 크기"
        className="flex-1"
        first={<BoardLeft fit date={date} />}
        second={<BoardDay date={date} />}
      />
    </div>
  );
}

/**
 * 왼쪽 무리 - [이번 달][월][화][수] / [다음 달][목][금][토·일] (11-09 사용자 요청). fit = 화면 높이에 맞춘 칸(두 줄이 반씩, 카드 안 스크롤).
 * 칸은 늘 넷 × 두 줄 - 주말을 감추면 토·일 칸만 빈다. 쌓은 모양은 좁으면(600 밑) 둘씩: [이번 달][월] / [화][수] / [다음 달][목] / [금][토·일].
 */
function BoardLeft({ fit, date }: { fit: boolean; date: string }) {
  const sid = useCurrentSpaceId();
  const showWeekend = useNav((s) => s.showWeekend);
  const week = useMemo(() => weekDates(date), [date]);
  const shown = showWeekend ? week : week.slice(0, 5);
  const cards = useWeekCards(sid, date, week);
  // 넘겨 보는 달 - 고른 날이 바뀌면 그 달로 (고른 날과 함께 기억한다). 아래 칸은 늘 그 다음 달
  const [peek, setPeek] = useState<{ base: string; ym: string } | null>(null);
  const ym = peek?.base === date ? peek.ym : date.slice(0, 7);
  const step = (n: 1 | -1) => setPeek({ base: date, ym: shiftMonth(ym, n) });
  const [mon, tue, wed, thu, fri, sat, sun] = week;
  const common = {
    arrange: (card: (day: string, o?: { noLessons?: boolean; half?: boolean }) => ReactNode) => [
      <BoardMonth key="month-this" date={date} week={week} fit={fit} ym={ym} slot="this" onStep={step} />,
      card(mon),
      card(tue),
      card(wed),
      <BoardMonth key="month-next" date={date} week={week} fit={fit} ym={shiftMonth(ym, 1)} slot="next" />,
      card(thu),
      card(fri),
      // 토·일 = 한 칸을 위·아래로 (수업 줄 없이 - 주말에는 수업이 없다)
      showWeekend && (
        <div key="weekend" data-board-weekend className={fit ? 'grid grid-rows-2 gap-2 min-h-0' : 'flex flex-col gap-2'}>
          {card(sat, { noLessons: true, half: true })}
          {card(sun, { noLessons: true, half: true })}
        </div>
      ),
    ],
    selected: date,
    onOpenDay: setDate,
    openDayTitle: '누르면 이 날을 고른다 - 오른쪽에 그날 수업·일정·메모',
  };
  return (
    <div
      data-board-left
      data-board-pane={fit ? 'left' : undefined}
      data-today-area={week.includes(cards.today) ? 'true' : undefined}
      className={fit ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain' : '@container'}
    >
      {fit
        ? cards.grid(shown, { ...common, fill: true, className: 'grid grid-cols-4 grid-rows-2 gap-2 h-full min-h-80 p-1' })
        : cards.grid(shown, { ...common, className: 'grid grid-cols-2 @min-[37.5rem]:grid-cols-4 gap-2 p-1' })}
      {cards.dialogs}
    </div>
  );
}

/** 고른 날 이름 (둘째 줄은 주 이름이라 여기에) */
function DayTitle({ date }: { date: string }) {
  const today = useToday();
  const [, m, d] = date.split('-').map(Number);
  return (
    <h2 data-board-day-title={date} className="flex items-center gap-2 px-1 text-sm font-extrabold text-slate-700">
      {m}월 {d}일 ({DAY_NAMES[weekdayOf(date)]})
      {date === today && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-2xs font-bold">오늘</span>}
    </h2>
  );
}

/** 칸 하나 - 칸 안에서 스크롤, 휠·위아래 밀기는 날짜를 넘기지 않는다(app/useGlobalGestures) */
function Pane({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div data-board-pane={name} className="@container flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-2xl">
      {children}
    </div>
  );
}

/** 메모 칸 - 메모 열 수는 이 칸 폭으로(하루 화면은 본문 폭). 열 수가 바뀔 때만 다시 그린다 */
function MemoPane({ date }: { date: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // PC 한눈에 글자 바탕(90%)은 걷고 견준다 - 하루 화면(바탕 100%) 본문 폭과 같게 (ui/useMainWidth unscaledWidth)
  const width = unscaledWidth(useElementWidth(ref, (w) => journalColumnsFor(unscaledWidth(w)), 360));
  return (
    <div ref={ref} data-board-pane="memo" className="@container flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-2xl">
      <MainWidthContext.Provider value={width}>
        <DayJournal date={date} />
      </MainWidthContext.Provider>
    </div>
  );
}

/** 오른쪽 무리 - 고른 날 이름 + 위(수업 | 일정) / 메모. 토글을 끄면 남은 쪽이 다 쓴다(하루 화면과 같다) */
function BoardDay({ date }: { date: string }) {
  const showEvents = useNav((s) => s.showEvents);
  const showClass = useNav((s) => s.showClass);
  const dayRatio = useBoardSplit('day');
  const memoRatio = useBoardSplit('memo');
  const groupRef = useRef<HTMLDivElement>(null);
  const dayRow = unscaledWidth(useElementWidth(groupRef, (w) => unscaledWidth(w) >= DAY_ROW_MIN, DAY_ROW_MIN)) >= DAY_ROW_MIN;

  const lessons = (
    <Pane name="lessons">
      <DayLessons date={date} />
    </Pane>
  );
  const events = (
    <Pane name="events">
      <DayEvents date={date} />
    </Pane>
  );
  const top =
    showClass && showEvents ? (
      <SplitPane
        name="board-day"
        direction={dayRow ? 'row' : 'column'}
        ratio={dayRatio}
        onCommit={(r) => setBoardSplit('day', r)}
        minFirst={dayRow ? 200 : 100}
        minSecond={dayRow ? 160 : 100}
        label="수업 · 일정 칸 크기"
        className="flex-1"
        first={lessons}
        second={events}
      />
    ) : showClass ? (
      lessons
    ) : showEvents ? (
      events
    ) : null;

  return (
    <div ref={groupRef} data-board-day-group className="flex-1 min-h-0 flex flex-col gap-2">
      <DayTitle date={date} />
      {top ? (
        <SplitPane
          name="board-memo"
          direction="column"
          ratio={memoRatio}
          onCommit={(r) => setBoardSplit('memo', r)}
          minFirst={120}
          minSecond={120}
          label="위 칸 · 메모 칸 크기"
          className="flex-1"
          first={top}
          second={<MemoPane date={date} />}
        />
      ) : (
        <MemoPane date={date} />
      )}
    </div>
  );
}

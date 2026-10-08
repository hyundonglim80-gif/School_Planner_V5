// 지금 보는 화면·날짜와 둘째 줄 토글 (V4 useAppStore의 scope·currentDate·show*·semesterFilter·navigate*에서 옮김).
//
// 주소(route.ts·history.ts)와 맞물린다: 여기 값이 바뀌면 주소가 따라가고, 주소가 바뀌면(뒤로가기·주소 입력) 여기로 들어온다.
// 화면 컴포넌트는 이 store를 골라 읽고(useNav), 바꿀 때는 아래 함수를 부른다.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, addMonthsStr, academicYearOf, DAY_NAMES, parseDateStr, todayStr, weekdayOf, weekMonday } from '../domain/dateUtils';
import { isDatelessScope, SCOPES, type Scope } from './route';
import { scrollToToday } from './todayScroll';

export type SemesterFilter = 'all' | 1 | 2;

export interface NavState {
  scope: Scope;
  /** 보는 날 'YYYY-MM-DD' (이 기기 시각). 새로 열면 오늘(주소에 날짜가 있으면 그날) */
  date: string;
  /** 학급 화면의 학급 (P7-1) */
  classId: string | null;
  showWeekend: boolean;
  showEvents: boolean;
  showClass: boolean;
  /** 년간 학기 칩 */
  semesterFilter: SemesterFilter;
  /** 위아래 끝에서 더 굴리거나 옆으로 밀어 화면·날짜 옮기기 (환경설정 - P1-4) */
  enableScrollNav: boolean;
}

/**
 * 이 기기에 남기는 것: 마지막 화면(시작 화면 '마지막에 보던 화면'), 토글. 날짜는 남기지 않는다(늘 오늘부터).
 * 계정에 올려 기기끼리 맞추는 것은 P1-4(설정 동기화)에서 고른다.
 */
export const useNav = create<NavState>()(
  persist(
    (): NavState => ({
      scope: 'day',
      date: todayStr(),
      classId: null,
      showWeekend: true,
      showEvents: true,
      showClass: true,
      semesterFilter: 'all',
      enableScrollNav: false,
    }),
    {
      name: 'sp5-view',
      partialize: (s) => ({
        scope: s.scope,
        showWeekend: s.showWeekend,
        showEvents: s.showEvents,
        showClass: s.showClass,
        semesterFilter: s.semesterFilter,
        enableScrollNav: s.enableScrollNav,
      }),
    },
  ),
);

export function setScope(scope: Scope) {
  useNav.setState({ scope });
}

export function setDate(date: string) {
  useNav.setState({ date });
}

/** 이전·다음 화면 (단축키 Shift+←/→, 옆으로 밀기) - 끝에서 돌아 처음으로 */
export function stepScope(step: 1 | -1) {
  const i = SCOPES.indexOf(useNav.getState().scope);
  setScope(SCOPES[(i + step + SCOPES.length) % SCOPES.length]);
}

/** 그 화면에서 ◀(-1) ▶(1) 했을 때의 날 */
export function steppedDate(s: Pick<NavState, 'scope' | 'date' | 'showWeekend'>, dir: 1 | -1): string {
  switch (s.scope) {
    case 'day': {
      let d = addDays(s.date, dir);
      // 주말을 감추면 토·일을 건너뛴다
      if (!s.showWeekend) {
        const wd = weekdayOf(d);
        if (dir > 0 && wd === 6) d = addDays(d, 2);
        else if (dir > 0 && wd === 0) d = addDays(d, 1);
        else if (dir < 0 && wd === 0) d = addDays(d, -2);
        else if (dir < 0 && wd === 6) d = addDays(d, -1);
      }
      return d;
    }
    case 'week':
      return addDays(s.date, 7 * dir);
    // 31일에 ▶를 눌러도 다음 달을 건너뛰지 않게 그 달의 마지막 날로 (addMonthsClamped)
    case 'month':
      return addMonthsStr(s.date, dir);
    case 'year':
      return addMonthsStr(s.date, 12 * dir);
    default:
      return s.date;
  }
}

export function stepDate(dir: 1 | -1) {
  const s = useNav.getState();
  if (isDatelessScope(s.scope)) return;
  setDate(steppedDate(s, dir));
}

let stopTodayScroll: () => void = () => {};

/**
 * 오늘로. 날짜만 오늘로 바꾸면 이미 이번 달·주를 보고 있을 때는 아무 일도 없는 것처럼 보여서(V4),
 * 오늘 칸을 화면 안으로 끌어온다. 새 화면이 그려진 뒤에 찾아야 해서 한 프레임 뒤에 시작한다.
 */
export function goToday() {
  setDate(todayStr());
  stopTodayScroll();
  requestAnimationFrame(() => {
    stopTodayScroll = scrollToToday(useNav.getState().scope);
  });
}

export function setToggle(key: 'showWeekend' | 'showEvents' | 'showClass', on: boolean) {
  useNav.setState({ [key]: on });
}

export function setSemesterFilter(semesterFilter: SemesterFilter) {
  useNav.setState({ semesterFilter });
}

/** 둘째 줄 가운데 날짜 글자 (V4 getFormattedDateRange) */
export function dateLabel(scope: Scope, date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  switch (scope) {
    case 'day':
      return `${y}년 ${m}월 ${d}일 (${DAY_NAMES[weekdayOf(date)]})`;
    case 'week': {
      // 그 주(월~일)의 목요일이 든 달의 몇째 주 - 달을 걸친 주는 날이 더 많은 달로 센다
      const thu = parseDateStr(addDays(weekMonday(date), 3));
      const firstWeekday = new Date(thu.getFullYear(), thu.getMonth(), 1).getDay();
      const n = Math.ceil((thu.getDate() + firstWeekday) / 7);
      return `${thu.getFullYear()}년 ${thu.getMonth() + 1}월 ${n}주`;
    }
    case 'month':
      return `${y}년 ${m}월`;
    case 'year':
      return `${academicYearOf(date)}학년도`;
    default:
      return '';
  }
}

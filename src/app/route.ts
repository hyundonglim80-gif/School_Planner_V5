// 주소 ↔ 화면·날짜 (DESIGN 7-3). 순수 함수만 - 브라우저 기록을 다루는 것은 history.ts.
//
//   #/day/2026-10-08 · #/week/2026-10-05(월요일) · #/month/2026-10 · #/year/2026(학년도) · #/memo · #/class(/학급 id)
//
// 창은 주소에 넣지 않는다. 주간·월간·년간 주소는 날짜 하나가 아니라 기간이라, 보던 날이 그 안에 있으면 그대로 둔다
// (하루 → 월간 → 하루로 돌아와도 보던 날).
import {
  academicYearOf,
  academicYearRange,
  addDays,
  isValidDateStr,
  monthEnd,
  weekMonday,
} from '../domain/dateUtils';

export type Scope = 'day' | 'week' | 'month' | 'year' | 'memo' | 'class';

/** 화면 차례 (화면 탭·탭바·단축키 '이전/다음 화면'·옆으로 밀기가 같은 차례) */
export const SCOPES: readonly Scope[] = ['day', 'week', 'month', 'year', 'memo', 'class'];

/** 날짜가 없는 화면 (둘째 줄이 없고, 날짜 이동·밀기를 하지 않는다) */
export const isDatelessScope = (scope: Scope) => scope === 'memo' || scope === 'class';

export interface Route {
  scope: Scope;
  /** 날짜가 있는 화면이면 그 기간 [첫날, 끝날] */
  range?: [string, string];
  /** 학급 화면의 학급 id (P7-1) */
  classId?: string;
}

/** 주소 글자 → 화면. 모르는 모양이면 null */
export function parseRoute(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [scope, arg, ...rest] = parts;
  if (rest.length > 0) return null;
  switch (scope) {
    case 'day':
      return arg && isValidDateStr(arg) ? { scope, range: [arg, arg] } : null;
    case 'week': {
      if (!arg || !isValidDateStr(arg)) return null;
      const monday = weekMonday(arg);
      return { scope, range: [monday, addDays(monday, 6)] };
    }
    case 'month': {
      const m = /^(\d{4})-(\d{2})$/.exec(arg ?? '');
      if (!m || !isValidDateStr(`${arg}-01`)) return null;
      return { scope, range: [`${arg}-01`, monthEnd(Number(m[1]), Number(m[2]))] };
    }
    case 'year': {
      if (!/^\d{4}$/.test(arg ?? '')) return null;
      return { scope, range: academicYearRange(Number(arg)) };
    }
    case 'memo':
      return arg ? null : { scope };
    case 'class':
      return arg ? { scope, classId: decodeURIComponent(arg) } : { scope };
    default:
      return null;
  }
}

/** 화면 → 주소 글자 */
export function routeHash(scope: Scope, date: string, classId?: string | null): string {
  switch (scope) {
    case 'day':
      return `#/day/${date}`;
    case 'week':
      return `#/week/${weekMonday(date)}`;
    case 'month':
      return `#/month/${date.slice(0, 7)}`;
    case 'year':
      return `#/year/${academicYearOf(date)}`;
    case 'memo':
      return '#/memo';
    case 'class':
      return classId ? `#/class/${encodeURIComponent(classId)}` : '#/class';
  }
}

/**
 * 주소로 왔을 때 볼 날. 보던 날이 그 기간 안이면 그대로, 아니면 오늘이 그 안이면 오늘, 아니면 첫날.
 * 날짜가 없는 화면(메모·학급)은 보던 날 그대로.
 */
export function dateForRoute(route: Route, current: string, today: string): string {
  if (!route.range) return current;
  const [from, to] = route.range;
  const inside = (d: string) => d >= from && d <= to;
  if (inside(current)) return current;
  if (inside(today)) return today;
  return from;
}

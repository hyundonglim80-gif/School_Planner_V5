// 반복 (DESIGN 4-4, V4 components/RecurringModal.tsx computeRecurringDates). 일정 칸의 '🔁 반복' 줄이 고른 규칙으로 날짜를 센다.
//
// 항목은 날마다 만들어 둔다(완료·이월·알림이 날마다 따로 돌게) - 규칙은 series 문서에 남겨 '어떤 반복인가'를 보이고 묶음을 고른다.
//   매일 · 매주 요일 · 격주 요일(달력의 주 - 일요일 시작, 시작 날이 든 주부터 - V4·V3와 같다) · 매월 n째 주 요일(V4는 첫째 주만) · 매월 n일(여럿)
// 시작 날은 범위의 첫날이다 - 규칙에 맞지 않으면 처음 맞는 날부터(V4 그대로). 끝나는 날은 꼭 정한다(V4 종료일).
import { addDays, daysBetween, DAY_NAMES, parseDateStr } from './dateUtils';

export type RecurKind = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthWeek' | 'monthDay';

/** 반복 규칙 (series.rule - DESIGN 4-4) */
export interface SeriesRuleShape {
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weekdays?: number[];
  monthWeek?: number;
  monthDays?: number[];
}

/** 일정 칸의 반복 줄 */
export interface RecurForm {
  kind: RecurKind;
  /** 0(일) ~ 6(토) */
  weekdays: number[];
  /** 매월 n째 주 (1~5) */
  monthWeek: number;
  /** 매월 n일 (1~31) */
  monthDays: number[];
  /** 끝나는 날 ('' = 아직) */
  until: string;
}

/** 한 번에 만드는 반복 일정 수 (반복 문서와 한 묶음 - Firestore 한 묶음 500) */
export const MAX_SERIES_ITEMS = 499;

/** 시작 날에 맞춘 처음 칸 (요일·몇째 주·며칠 = 시작 날의 것) */
export function recurFormFor(start: string, kind: RecurKind = 'none'): RecurForm {
  const d = parseDateStr(start);
  return { kind, weekdays: [d.getDay()], monthWeek: weekOfMonth(start), monthDays: [d.getDate()], until: '' };
}

/** 그 달의 몇째 주 (1일~7일 = 첫째 - V4와 같다) */
export const weekOfMonth = (date: string) => Math.ceil(parseDateStr(date).getDate() / 7);

/** 칸 → 규칙 ('안 함'이거나 고른 것이 없으면 null) */
export function ruleOf(form: RecurForm): SeriesRuleShape | null {
  const days = [...new Set(form.weekdays)].sort();
  switch (form.kind) {
    case 'daily':
      return { freq: 'daily', interval: 1 };
    case 'weekly':
    case 'biweekly':
      return days.length ? { freq: 'weekly', interval: form.kind === 'biweekly' ? 2 : 1, weekdays: days } : null;
    case 'monthWeek':
      return days.length ? { freq: 'monthly', interval: 1, monthWeek: form.monthWeek, weekdays: days } : null;
    case 'monthDay': {
      const md = [...new Set(form.monthDays)].sort((a, b) => a - b);
      return md.length ? { freq: 'monthly', interval: 1, monthDays: md } : null;
    }
    default:
      return null;
  }
}

/** 그 주의 일요일 */
const sundayOf = (date: string) => addDays(date, -parseDateStr(date).getDay());

/** 그날이 규칙에 맞나 */
function matches(rule: SeriesRuleShape, start: string, date: string): boolean {
  const d = parseDateStr(date);
  const wd = d.getDay();
  if (rule.freq === 'daily') return daysBetween(start, date) % Math.max(1, rule.interval) === 0;
  if (rule.freq === 'weekly') {
    if (!rule.weekdays?.includes(wd)) return false;
    const weeks = Math.round(daysBetween(sundayOf(start), sundayOf(date)) / 7);
    return weeks % Math.max(1, rule.interval) === 0;
  }
  if (rule.monthDays?.length) return rule.monthDays.includes(d.getDate());
  return !!rule.weekdays?.includes(wd) && weekOfMonth(date) === rule.monthWeek;
}

/** 시작 날 ~ 끝나는 날 사이의 반복 날짜 (차례대로, limit개까지) */
export function recurDates(rule: SeriesRuleShape, start: string, until: string, limit = MAX_SERIES_ITEMS + 1): string[] {
  if (!start || !until || until < start) return [];
  const out: string[] = [];
  const n = daysBetween(start, until);
  for (let i = 0; i <= n && out.length < limit; i++) {
    const date = addDays(start, i);
    if (matches(rule, start, date)) out.push(date);
  }
  return out;
}

const ORDINAL = ['', '첫째', '둘째', '셋째', '넷째', '다섯째'];
const dayList = (days: readonly number[]) => days.map((w) => DAY_NAMES[w]).join('·');

/** '매주 화·목' · '격주 금' · '매월 첫째 주 화' · '매월 15일' · '매일' */
export function ruleLabel(rule: SeriesRuleShape | null | undefined): string {
  if (!rule) return '반복';
  if (rule.freq === 'daily') return rule.interval > 1 ? `${rule.interval}일마다` : '매일';
  if (rule.freq === 'weekly') return `${rule.interval === 2 ? '격주' : '매주'} ${dayList(rule.weekdays ?? [])}`;
  if (rule.monthDays?.length) return `매월 ${rule.monthDays.join('·')}일`;
  return `매월 ${ORDINAL[rule.monthWeek ?? 1] ?? `${rule.monthWeek}째`} 주 ${dayList(rule.weekdays ?? [])}`;
}

/** 반복 줄로 만들 날짜들 (끝나는 날까지, 한도 + 1까지 - 넘으면 막는다) */
export function recurFormDates(start: string, form: RecurForm): string[] {
  const rule = ruleOf(form);
  return rule && form.until ? recurDates(rule, start, form.until) : [];
}

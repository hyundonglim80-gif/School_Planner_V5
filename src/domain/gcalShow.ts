// 구글 캘린더 겹쳐 그리기 - 셈 (P36-4 - PLAN 5장 'P36-4 구글 캘린더 겹쳐 그리기 ■0 정한 것'). 서버·store 없이 시험한다.
//
//   받은 일정(domain/gcalOverlay OverlayEvent)에 고른 캘린더(이름·색)와 보이는 날(eventSpan)을 붙여 화면에 넘긴다.
//   **앱 일정 목록에는 섞지 않는다** - 고르기·끌기·완료·지우기 코드가 앱 일정만 보게. 화면은 앱 것 뒤에 따로 그린다(읽기 전용).
//   여러 날 = 보이는 첫날 < 끝날 (종일 끝 날은 하루 빼고, 자정에 끝나는 시각 일정은 그 앞날까지 - eventSpan).
import { addDays, DAY_NAMES, daysBetween, parseDateStr } from './dateUtils';
import { eventSpan, type OverlayCalendar, type OverlayEvent } from './gcalOverlay';

/** 화면에 그릴 구글 일정 하나 */
export interface GcalShown {
  ev: OverlayEvent;
  /** 고른 캘린더 (이름·색) */
  cal: OverlayCalendar;
  /** 보이는 첫날·끝날 (둘 다 그날 포함) */
  first: string;
  last: string;
}

/** 월간 막대 자리 (domain/periodBars layoutWeekBars가 앱 기간 일정과 함께 줄을 나눈다 - id는 앱 일정과 겹치지 않게 'gcal:') */
export interface GcalBarItem {
  id: string;
  date: string;
  endDate: string;
  gcal: GcalShown;
}

/** 캘린더 + 일정 id (반복은 펼친 것마다 다르다) - React key·같은 것 찾기 */
export const gcalKey = (s: Pick<GcalShown, 'ev'>) => `${s.ev.cal}\n${s.ev.id}`;

/** 여러 날에 걸쳐 보이나 (월간 막대·년간 기간 줄) */
export const isGcalMulti = (s: Pick<GcalShown, 'first' | 'last'>) => s.last > s.first;

/** 그날 보이나 */
export const gcalOnDay = (s: Pick<GcalShown, 'first' | 'last'>, date: string) => s.first <= date && date <= s.last;

/** 받은 일정에 고른 캘린더를 붙인다 - 고르기에서 빠진 캘린더 것은 버린다 (차례는 받은 그대로) */
export function gcalShownList(events: readonly OverlayEvent[], cals: readonly OverlayCalendar[]): GcalShown[] {
  const byId = new Map(cals.map((c) => [c.id, c]));
  const out: GcalShown[] = [];
  for (const ev of events) {
    const cal = byId.get(ev.cal);
    if (!cal) continue;
    out.push({ ev, cal, ...eventSpan(ev) });
  }
  return out;
}

const timeOf = (dt: string) => dt.slice(11, 16);

/**
 * 그날 칸에 적을 시각 - 종일·여러 날의 가운데 날은 '' (시각이 없다).
 * 하루짜리 '09:00~10:30'(끝이 시작과 같으면 '09:00') · 여러 날 첫날 '22:00~' · 끝날 '~02:00'(자정에 끝나면 '').
 * short = 시작 시각만 (좁은 칸 - 월간·년간·한눈에 목록).
 */
export function gcalTimeOn(s: GcalShown, date: string, short = false): string {
  const { ev } = s;
  if (ev.allDay) return '';
  const startDay = ev.start.slice(0, 10);
  const endDay = ev.end.slice(0, 10);
  const start = timeOf(ev.start);
  const end = timeOf(ev.end);
  if (startDay === endDay) {
    if (date !== startDay) return '';
    return short || end === start ? start : `${start}~${end}`;
  }
  if (date === startDay) return short ? start : `${start}~`;
  // 끝 날(자정에 끝나면 그 앞날이 마지막 - 그날은 시각 없이 하루 끝까지)
  if (date === endDay && end !== '00:00') return short ? '' : `~${end}`;
  return '';
}

/** 그날 차례의 시각 - '' = 그날 시각 없이 하루를 덮는다(종일·가운데 날·자정에 끝나는 끝날), 이어 온 끝날('~02:00')은 0시부터 */
function orderTimeOn(s: GcalShown, date: string): string {
  const { ev } = s;
  if (ev.allDay) return '';
  if (date === ev.start.slice(0, 10)) return timeOf(ev.start);
  if (date === ev.end.slice(0, 10) && timeOf(ev.end) !== '00:00') return '00:00';
  return '';
}

/**
 * 그날 보이는 것 (하루·주간·한눈에 요일 칸) - 여러 날 것도 그날 칸에.
 * 차례 = 그날 시각이 없는 것(종일·가운데 날) 먼저, 그다음 그날 시각 차례, 같으면 제목.
 */
export function gcalListOn(list: readonly GcalShown[], date: string): GcalShown[] {
  return list
    .filter((s) => gcalOnDay(s, date))
    .map((s) => [s, orderTimeOn(s, date)] as const)
    .sort(([a, ta], [b, tb]) => Number(ta !== '') - Number(tb !== '') || ta.localeCompare(tb) || a.ev.title.localeCompare(b.ev.title, 'ko'))
    .map(([s]) => s);
}

/** 달력 칸 셈 (월간·년간·한눈에 달 목록) - 하루짜리는 날마다(그날 차례), 여러 날은 막대 자리로 */
export function gcalCalendar(list: readonly GcalShown[], from: string, to: string): { byDate: Map<string, GcalShown[]>; periods: GcalBarItem[] } {
  const byDate = new Map<string, GcalShown[]>();
  const periods: GcalBarItem[] = [];
  for (const s of list) {
    if (s.last < from || s.first > to) continue;
    if (isGcalMulti(s)) {
      periods.push({ id: `gcal:${gcalKey(s)}`, date: s.first, endDate: s.last, gcal: s });
      continue;
    }
    const day = byDate.get(s.first);
    if (day) day.push(s);
    else byDate.set(s.first, [s]);
  }
  for (const [d, day] of byDate) byDate.set(d, gcalListOn(day, d));
  return { byDate, periods };
}

const dayLabel = (d: string) => {
  const dt = parseDateStr(d);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DAY_NAMES[dt.getDay()]})`;
};

/**
 * 창에 적을 때: '11월 16일 (월) · 종일' · '11월 16일 (월) ~ 11월 18일 (수) · 3일' ·
 * '11월 16일 (월) 09:00 ~ 10:30' · '11월 16일 (월) 22:00 ~ 11월 17일 (화) 02:00'
 */
export function gcalWhenLabel(s: GcalShown): string {
  const { ev } = s;
  if (ev.allDay) {
    if (!isGcalMulti(s)) return `${dayLabel(s.first)} · 종일`;
    return `${dayLabel(s.first)} ~ ${dayLabel(s.last)} · ${daysBetween(s.first, s.last) + 1}일`;
  }
  const startDay = ev.start.slice(0, 10);
  const endDay = ev.end.slice(0, 10);
  const start = timeOf(ev.start);
  const end = timeOf(ev.end);
  if (startDay === endDay) return end === start ? `${dayLabel(startDay)} ${start}` : `${dayLabel(startDay)} ${start} ~ ${end}`;
  // 이튿날 자정에 끝나면 '~ 24:00'으로 (다음 날 0시보다 읽기 쉽다)
  if (end === '00:00' && addDays(startDay, 1) === endDay) return `${dayLabel(startDay)} ${start} ~ 24:00`;
  return `${dayLabel(startDay)} ${start} ~ ${dayLabel(endDay)} ${end}`;
}

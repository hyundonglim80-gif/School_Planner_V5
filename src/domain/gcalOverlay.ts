// 구글 캘린더 겹쳐 보기 - 셈 (P36-3 - PLAN 5장 'P36-3 구글 캘린더 받기 ■0 정한 것'). 서버·store 없이 시험한다.
//
//   고른 캘린더 = 계정 칸 common `gcalOverlay` [{ id, name, color }] (10개까지 - 초기화 설정·처음 설정에는 넣지 않는다).
//   받은 일정 = 이 기기에만(data/gcalOverlay - IndexedDB) 달 칸 '<캘린더 id>|YYYY-MM' = { events, at }. 앱 자료·백업·서버에 넣지 않는다.
//   받는 범위 = 달 단위 - 보는 날의 달 ±1달(하루·주간·월간·한눈에), 년간 = 그 학년도 12달 + 앞뒤 한 달. 15분이 지난 달만 다시.
//   여러 달에 걸친 일정은 걸친 달마다 담고, 읽을 때(overlayBetween) 캘린더 + id로 하나.
import { academicYearOf, addDays } from './dateUtils';
import { CALENDAR_NAME } from './gcal';

/** 고를 수 있는 캘린더 수 - 화면마다 캘린더 수만큼 구글에 묻는다 */
export const MAX_OVERLAY_CALENDARS = 10;
/** 받은 달을 이만큼 지나면 다시 받는다 (조용한 토큰이 있을 때만) */
export const OVERLAY_STALE_MS = 15 * 60 * 1000;
/** 설명은 이만큼만 담는다 (이 기기 사본 - 긴 회의록이 붙은 일정) */
export const OVERLAY_DESC_MAX = 1000;
/** 구글이 색을 주지 않았을 때 */
export const OVERLAY_DEFAULT_COLOR = '#4285f4';

/** 겹쳐 볼 캘린더 (고를 때 적은 이름·색 - 목록을 다시 받지 않아도 보인다) */
export interface OverlayCalendar {
  id: string;
  name: string;
  color: string;
}

/** 이 기기에 담는 구글 일정 (필요한 칸만) */
export interface OverlayEvent {
  /** 구글 일정 id (반복은 펼친 것마다 다르다) */
  id: string;
  /** 캘린더 id */
  cal: string;
  title: string;
  allDay: boolean;
  /** 종일 'YYYY-MM-DD' · 시각 'YYYY-MM-DDTHH:mm'(이 기기 시각) */
  start: string;
  /** 종일 = 구글 그대로 끝 날의 다음 날 · 시각 'YYYY-MM-DDTHH:mm' - 날 수는 eventSpan */
  end: string;
  location?: string;
  description?: string;
  /** 구글 캘린더에서 열기 */
  link?: string;
}

/** 구글 calendarList 한 줄 (필요한 칸만) */
export interface GoogleCalendarEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  deleted?: boolean;
}

/** 구글 events 한 줄 (필요한 칸만) */
export interface GoogleEventRaw {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

/** 고르기 줄에 보일 캘린더 */
export interface PickableCalendar extends OverlayCalendar {
  primary: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

const colorOf = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : OVERLAY_DEFAULT_COLOR);

// ── 고른 캘린더 ──

/** 계정 칸 읽기 (prefs customField) - 배열이 아니면 undefined(기본 []), 모르는 칸은 버리고 같은 id는 하나, 10개까지 */
export function sanitizeOverlayCalendars(v: unknown): OverlayCalendar[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: OverlayCalendar[] = [];
  const seen = new Set<string>();
  for (const c of v) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || o.id.length > 300 || seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({ id: o.id, name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 100) : o.id, color: colorOf(o.color) });
    if (out.length >= MAX_OVERLAY_CALENDARS) break;
  }
  return out;
}

/** 앱이 보내는 캘린더 이름 (SP(work)·SP(class)·SP(commentary)) - 겹치면 같은 일정이 두 번 보인다 */
const APP_CALENDAR_NAMES = new Set(Object.values(CALENDAR_NAME));

/** 고르기 줄에 보일 캘린더 - 앱이 보내는 캘린더·지운 캘린더는 빼고, 기본 캘린더 먼저 그다음 이름 차례 */
export function pickableCalendars(list: readonly GoogleCalendarEntry[]): PickableCalendar[] {
  return list
    .filter((c) => c && typeof c.id === 'string' && c.id && !c.deleted && !APP_CALENDAR_NAMES.has(c.summary ?? '') && !APP_CALENDAR_NAMES.has(c.summaryOverride ?? ''))
    .map((c) => ({ id: c.id, name: (c.summaryOverride || c.summary || c.id).trim(), color: colorOf(c.backgroundColor), primary: !!c.primary }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name, 'ko'));
}

// ── 일정 ──

/** 구글 시각('2026-11-16T09:00:00+09:00')을 이 기기 시각 'YYYY-MM-DDTHH:mm'으로 */
function localDateTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 구글 일정 한 줄 → 담을 모양. 취소된 것·날이 없는 것은 null */
export function readGoogleEvent(raw: GoogleEventRaw, cal: string): OverlayEvent | null {
  if (!raw || typeof raw.id !== 'string' || !raw.id || raw.status === 'cancelled') return null;
  const s = raw.start ?? {};
  const e = raw.end ?? {};
  let allDay: boolean;
  let start: string | null;
  let end: string | null;
  if (typeof s.date === 'string' && DATE.test(s.date)) {
    allDay = true;
    start = s.date;
    // 끝이 없거나 시작보다 이르면 하루짜리로 (구글은 늘 주지만 고장 난 자료를 그리지 않게)
    end = typeof e.date === 'string' && DATE.test(e.date) && e.date > s.date ? e.date : addDays(s.date, 1);
  } else if (typeof s.dateTime === 'string') {
    allDay = false;
    start = localDateTime(s.dateTime);
    end = typeof e.dateTime === 'string' ? localDateTime(e.dateTime) : null;
    if (start && (!end || end < start)) end = start;
  } else return null;
  if (!start || !end) return null;
  const out: OverlayEvent = { id: raw.id, cal, title: raw.summary?.trim() || '(제목 없음)', allDay, start, end };
  const location = raw.location?.trim();
  if (location) out.location = location.slice(0, 300);
  const description = raw.description?.trim();
  if (description) out.description = description.slice(0, OVERLAY_DESC_MAX);
  if (typeof raw.htmlLink === 'string' && raw.htmlLink.startsWith('https://')) out.link = raw.htmlLink;
  return out;
}

/** 일정이 보이는 첫날·끝날 (둘 다 그날 포함). 종일은 끝 하루 앞까지, 시각은 자정에 끝나면 그 앞날까지 */
export function eventSpan(ev: Pick<OverlayEvent, 'allDay' | 'start' | 'end'>): { first: string; last: string } {
  const first = ev.start.slice(0, 10);
  let last = ev.end.slice(0, 10);
  if (ev.allDay) last = addDays(last, -1);
  else if (last > first && ev.end.slice(11) === '00:00') last = addDays(last, -1);
  return { first, last: last < first ? first : last };
}

// ── 달 ──

/** 'YYYY-MM'에 n달 */
export function addMonthKey(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** a ~ b 달 (둘 다 포함, 차례대로) */
export function monthsBetween(a: string, b: string): string[] {
  const out: string[] = [];
  for (let cur = a, guard = 0; cur <= b && guard < 240; cur = addMonthKey(cur, 1), guard++) out.push(cur);
  return out;
}

/** 화면이 쓰는 달 - 날짜 없는 화면(메모·학급)은 없다 */
export function neededMonths(scope: string, date: string): string[] {
  if (!DATE.test(date) || scope === 'memo' || scope === 'class') return [];
  if (scope === 'year') {
    const ay = academicYearOf(date);
    return monthsBetween(`${ay}-02`, `${ay + 1}-03`);
  }
  const m = date.slice(0, 7);
  return [addMonthKey(m, -1), m, addMonthKey(m, 1)];
}

export const monthRowKey = (cal: string, month: string) => `${cal}|${month}`;

/** 캘린더마다 받아야 할 달 - 없거나 maxAge가 지난 달 (0 = 모두) */
export function staleMonths(
  rows: Readonly<Record<string, { at: number }>>,
  cals: readonly string[],
  months: readonly string[],
  now: number,
  maxAge = OVERLAY_STALE_MS,
): Array<{ cal: string; months: string[] }> {
  const out: Array<{ cal: string; months: string[] }> = [];
  for (const cal of cals) {
    const need = months.filter((m) => {
      const row = rows[monthRowKey(cal, m)];
      return !row || maxAge <= 0 || now - row.at >= maxAge;
    });
    if (need.length) out.push({ cal, months: need });
  }
  return out;
}

/** 이어진 달끼리 묶기 - 한 번에 묻는다 */
export function runsOf(months: readonly string[]): Array<{ from: string; to: string }> {
  const sorted = [...new Set(months.filter((m) => MONTH.test(m)))].sort();
  const out: Array<{ from: string; to: string }> = [];
  for (const m of sorted) {
    const last = out[out.length - 1];
    if (last && addMonthKey(last.to, 1) === m) last.to = m;
    else out.push({ from: m, to: m });
  }
  return out;
}

/** 묶음의 구글 기간 (이 기기 시각 자정 - timeMax는 다음 달 1일 0시, 구글은 그 앞까지) */
export function runRange(run: { from: string; to: string }): { timeMin: string; timeMax: string } {
  const [y1, m1] = run.from.split('-').map(Number);
  const [y2, m2] = run.to.split('-').map(Number);
  return { timeMin: new Date(y1, m1 - 1, 1).toISOString(), timeMax: new Date(y2, m2, 1).toISOString() };
}

const monthFirst = (m: string) => `${m}-01`;
const monthLast = (m: string) => addDays(`${addMonthKey(m, 1)}-01`, -1);
const overlaps = (span: { first: string; last: string }, first: string, last: string) => span.first <= last && span.last >= first;

/** 받은 일정을 달마다 나눈다 - 물은 달은 일정이 없어도 빈 칸으로(받은 것이다) */
export function splitByMonth(events: readonly OverlayEvent[], months: readonly string[]): Record<string, OverlayEvent[]> {
  const out: Record<string, OverlayEvent[]> = {};
  for (const m of months) out[m] = [];
  for (const ev of events) {
    const span = eventSpan(ev);
    for (const m of months) if (overlaps(span, monthFirst(m), monthLast(m))) out[m].push(ev);
  }
  return out;
}

/** 고른 캘린더의 받은 일정 중 first~last에 보이는 것 (캘린더 + id로 하나, 시작 차례 - 종일 먼저) */
export function overlayBetween(
  rows: Readonly<Record<string, { events: readonly OverlayEvent[] }>>,
  cals: readonly string[],
  first: string,
  last: string,
): OverlayEvent[] {
  if (!DATE.test(first) || !DATE.test(last) || first > last) return [];
  const months = monthsBetween(first.slice(0, 7), last.slice(0, 7));
  const seen = new Set<string>();
  const out: OverlayEvent[] = [];
  for (const cal of cals)
    for (const m of months)
      for (const ev of rows[monthRowKey(cal, m)]?.events ?? []) {
        const key = `${cal}\n${ev.id}`;
        if (seen.has(key) || !overlaps(eventSpan(ev), first, last)) continue;
        seen.add(key);
        out.push(ev);
      }
  return out.sort((a, b) => a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) || Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'ko'));
}

// 구글 캘린더 겹쳐 보기 - 늘 쓰는 작은 셈 (P55-1 첫 화면 JS - domain/gcalOverlay에서 뗐다, 그쪽이 그대로 다시 내보낸다).
//   계정 칸 읽기(app/prefs)·받을 달(features/gcal/overlayAuto)은 고른 캘린더가 없어도 늘 돈다 - 받기·그리기 셈(domain/gcalOverlay)은 고른 캘린더가 있을 때만 받는다.
import { academicYearOf } from './dateUtils';

/** 고를 수 있는 캘린더 수 - 화면마다 캘린더 수만큼 구글에 묻는다 */
export const MAX_OVERLAY_CALENDARS = 10;
/** 구글이 색을 주지 않았을 때 */
export const OVERLAY_DEFAULT_COLOR = '#4285f4';

/** 겹쳐 볼 캘린더 (고를 때 적은 이름·색 - 목록을 다시 받지 않아도 보인다) */
export interface OverlayCalendar {
  id: string;
  name: string;
  color: string;
}

const HEX = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** 색 칸 - '#rrggbb'가 아니면 기본 색 */
export const overlayColorOf = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : OVERLAY_DEFAULT_COLOR);

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
    out.push({ id: o.id, name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 100) : o.id, color: overlayColorOf(o.color) });
    if (out.length >= MAX_OVERLAY_CALENDARS) break;
  }
  return out;
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

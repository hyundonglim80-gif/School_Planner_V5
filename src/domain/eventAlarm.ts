// 일정 알림 (V4 EventAlarmModal·useEventAlarms) - 순수 셈.
//
// V5 알림 = 그 일정 날(date)의 시각 'HH:mm'(DESIGN 4-2). 날짜를 옮기면 알림도 따라간다. V4는 알림 날짜를 따로 골랐다 -
// V5는 일정 날만(PLAN 5장 'P3-1 알림').

/** 24시간제 글 → 'HH:mm' (V3 '⏰ 알림 시간 설정' 그대로: 1430 · 930 · 14:30). 틀리면 null */
export function normalizeTimeInput(raw: string): string | null {
  let cleaned = (raw || '').trim().replace(/[^0-9:]/g, '');
  if (!cleaned) return null;
  if (/^\d{3,4}$/.test(cleaned)) {
    if (cleaned.length === 3) cleaned = '0' + cleaned[0] + ':' + cleaned.substring(1);
    else cleaned = cleaned.substring(0, 2) + ':' + cleaned.substring(2);
  }
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 지난 지 이만큼 넘은 알림은 울리지 않는다 (V3·V4와 같다 - 앱을 늦게 열었을 때 한꺼번에 울리지 않게) */
export const ALARM_WINDOW_MS = 60 * 60 * 1000;

export interface AlarmCandidate {
  id: string;
  date?: string | null;
  time?: string;
  done?: boolean;
  alarmDone?: boolean;
  deletedAt?: unknown;
  kind?: string;
}

/** 'YYYY-MM-DD' + 'HH:mm' → 이 기기 시각의 ms (틀리면 NaN) */
export function alarmAt(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => !Number.isFinite(n))) return NaN;
  return new Date(y, m - 1, d, hh, mm).getTime();
}

/**
 * 지금 울릴 일정 (V4 useEventAlarms의 판단): 알림 시각이 지났고 1시간 안, 끝내지 않음, 지우지 않음, 아직 울리지 않음(alarmDone - 다른 기기가 먼저 울렸으면 건너뛴다),
 * 이 탭에서 이미 울린 것(rung)도 뺀다. 알림 시각 차례로.
 */
export function dueAlarms<T extends AlarmCandidate>(items: Iterable<T>, now: number, rung: ReadonlySet<string> = new Set()): T[] {
  const out: { at: number; item: T }[] = [];
  for (const it of items) {
    if (it.kind !== 'event' || !it.time || !it.date || it.done || it.alarmDone || it.deletedAt || rung.has(it.id)) continue;
    const at = alarmAt(it.date, it.time);
    if (Number.isNaN(at) || at > now || now - at >= ALARM_WINDOW_MS) continue;
    out.push({ at, item: it });
  }
  return out.sort((a, b) => a.at - b.at || (a.item.id < b.item.id ? -1 : 1)).map((x) => x.item);
}

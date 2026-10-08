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

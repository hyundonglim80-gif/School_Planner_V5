// 한눈에 첫 칸 달력 아래 목록 (P24-2 ■3) - 그 달 '달력' 일정을 날짜 차례로(하루짜리 + 그 달에 걸친 기간).
//   재료는 월간과 같은 calendarEvents(달력 속성·겹쳐 보기). 기간은 그 달 안 첫날 자리에(앞 달에서 걸친 것은 1일), 같은 날이면 기간 먼저(월간 막대가 위인 것처럼).
//   줄 바탕 (P35 11-13 사용자 요청): 오늘 일정 = 노랑, 보는 주(이 화면의 요일 칸 일곱)의 일정 = 옅은 파랑 - rowMark.
import { isPeriod, onPeriodDay } from '../../domain/period';
import type { ItemDoc } from '../events/eventOps';
import type { CalendarEvents } from '../month/calendarEvents';

export interface MonthListRow {
  ev: ItemDoc;
  /** 목록 자리 = 누르면 고를 날 (기간은 그 달 안 첫날) */
  day: string;
  /** 기간이면 끝 날 */
  endDate?: string;
}

/** [monthStart, monthEnd] 달의 목록 (cal은 그 달을 덮는 범위로 셈한 것) */
export function monthCalendarList(cal: CalendarEvents, monthStart: string, monthEnd: string): MonthListRow[] {
  const rows: MonthListRow[] = [];
  for (const p of cal.periods) {
    if (!isPeriod(p) || p.date! > monthEnd || p.endDate! < monthStart) continue;
    rows.push({ ev: p, day: p.date! < monthStart ? monthStart : p.date!, endDate: p.endDate! });
  }
  for (const [day, list] of cal.byDate) if (monthStart <= day && day <= monthEnd) for (const ev of list) rows.push({ ev, day });
  // 날짜 차례 - 같은 날은 기간 먼저, 그다음 넣은 차례(그날 차례·주 공간 것 먼저) 그대로 (sort는 안정)
  return rows.sort((a, b) => a.day.localeCompare(b.day) || Number(!a.endDate) - Number(!b.endDate));
}

/** 줄 바탕 표시: 'today' = 오늘 일정(먼저), 'week' = 보는 주에 드는 일정, null = 그 밖. 기간은 그날이 기간에 드는 날인가(주말 빼기·뺀 날까지 - 월간 막대와 같다) */
export type RowMark = 'today' | 'week' | null;

export function rowMark(row: MonthListRow, week: readonly string[], today: string): RowMark {
  const on = (d: string) => (row.endDate ? onPeriodDay(row.ev, d) : row.day === d);
  if (on(today)) return 'today';
  return week.some(on) ? 'week' : null;
}

/** 'YYYY-MM'에서 n달 옮긴 'YYYY-MM' (한눈에 달 칸 ◀▶) */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'm/d' 또는 기간 'm/d~m/d' */
export function rowDateLabel(row: MonthListRow): string {
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return row.endDate ? `${md(row.ev.date!)}~${md(row.endDate)}` : md(row.day);
}

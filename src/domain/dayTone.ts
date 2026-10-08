// 날짜 칸의 색 (V4 lib/holiday의 dayToneOf·색 표 - 주간·월간·년간이 같은 규칙). 토요일 파랑, 일요일·공휴일 빨강.
// 공휴일 이름은 P5-3(공휴일)에서 넘긴다.
import { weekdayOf } from './dateUtils';

export type DayTone = 'holiday' | 'saturday' | 'normal';

export function dayToneOf(date: string, holidayName?: string | null): DayTone {
  const wd = weekdayOf(date);
  if (holidayName || wd === 0) return 'holiday';
  if (wd === 6) return 'saturday';
  return 'normal';
}

/** 날짜 숫자 글자색 */
export const DAY_NUMBER_COLOR: Record<DayTone, string> = {
  holiday: 'text-red-500',
  saturday: 'text-blue-500',
  normal: 'text-slate-700',
};

/** 날짜 칸 배경색 (연하게) */
export const DAY_CELL_BG: Record<DayTone, string> = {
  holiday: 'bg-red-50/70',
  saturday: 'bg-blue-50/70',
  normal: 'bg-white',
};

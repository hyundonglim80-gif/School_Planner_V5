// 날짜 셈 (V4 lib/dateUtils에서 옮김 - 화면 껍데기가 쓰는 것만. 달력 칸 만들기 등은 그 화면 세션에서 더한다).
//
// V5는 날짜를 'YYYY-MM-DD' 글자(이 기기 시각 기준)로 다룬다. V4는 store에 toISOString(UTC)을 두어
// 한국 새벽·자정이면 하루 앞날이 되는 일이 여러 번 있었다.

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Date → 'YYYY-MM-DD' (이 기기 시각) */
export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → 그날 0시 Date (이 기기 시각) */
export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 있는 날짜인가 ('2026-02-30'은 아니다) */
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatDate(parseDateStr(s)) === s;
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * 날짜를 months달 옮긴다. 옮긴 달에 그 날이 없으면 그 달의 마지막 날로.
 * Date.setMonth만 쓰면 1월 31일 + 1달이 3월 3일이 되어, 월간 화면에서 31일에 ▶를 누르면 2월을 건너뛰었다.
 * (년간의 2월 29일 + 1년도 3월 1일 = 다음 학년도가 되었다.)
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** 'YYYY-MM-DD'를 months달 옮긴다 (addMonthsClamped) */
export function addMonthsStr(dateStr: string, months: number): string {
  return formatDate(addMonthsClamped(parseDateStr(dateStr), months));
}

/** 두 날짜 사이의 날 수(toStr - fromStr). 같은 날이면 0, 앞날이면 음수. */
export function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  // 서머타임이 있는 곳에서도 하루가 23·25시간이 되지 않게 UTC로 센다
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** 0(일) ~ 6(토) */
export function weekdayOf(dateStr: string): number {
  return parseDateStr(dateStr).getDay();
}

/** 그 주의 월요일 (주간 화면은 월요일부터 - V4 getWeekDays) */
export function weekMonday(dateStr: string): string {
  const day = weekdayOf(dateStr);
  return addDays(dateStr, day === 0 ? -6 : 1 - day);
}

/** 그 달의 마지막 날 */
export function monthEnd(year: number, month: number): string {
  return formatDate(new Date(year, month, 0));
}

/** 학년도: 3월 ~ 이듬해 2월 */
export function academicYearOf(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number);
  return m < 3 ? y - 1 : y;
}

/** 학년도의 첫날·끝날 (끝날은 이듬해 2월 말 - 윤년이면 29일) */
export function academicYearRange(year: number): [string, string] {
  return [`${year}-03-01`, monthEnd(year + 1, 2)];
}

/** '10/8(목)' (V4 lib/notices shortDateLabel - 쓰는 칸 제목·안내·빠른 입력 칩) */
export function shortDateLabel(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}

/** '10/8' (요일 없이 - 카드의 작은 칩 '↪ 10/5부터') */
export function monthDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

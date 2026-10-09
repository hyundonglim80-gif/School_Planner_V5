// 공휴일 (V4 lib/holiday.ts·holidays.ts·dateUtils.getHolidayName). 표는 서버 `holidays/{연도}`(모두가 같이 읽는다 - 개발자가 V4 환경설정에서 1년에 한 번 받아 둔다)와
// 개인 공휴일(`settings/common.myHolidays` - V3가 사람마다 받아 둔 표를 가져온 것)을 합친다. 셈만 - 읽는 것은 data/holidays.
//   - 이름 고르기: 개인 → 공유 → 고정 공휴일(양력 - 표가 아직 없을 때도 보이게, V4 getHolidayName).
//   - 색: 토요일 파랑, 일요일·공휴일 빨강(domain/dayTone).
//   - 주말 빼기 기간(domain/period)·시간표 적용이 공휴일을 건너뛴다.

/** 한국 고정 공휴일 (월-일) */
const FIXED: Readonly<Record<string, string>> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};

export type HolidayTable = Readonly<Record<string, string>>;

/** 그날 공휴일 이름 (없으면 undefined) */
export function holidayNameIn(date: string, shared: HolidayTable, mine: HolidayTable = {}): string | undefined {
  return mine[date] || shared[date] || FIXED[date.slice(5)] || undefined;
}

/** 서버 문서 `holidays/{연도}`의 days → 표 (그 해 날짜·글자만) */
export function readHolidayDoc(year: number, data: unknown): Record<string, string> {
  const days = data && typeof data === 'object' ? (data as { days?: unknown }).days : undefined;
  const out: Record<string, string> = {};
  if (!days || typeof days !== 'object') return out;
  for (const [d, name] of Object.entries(days as Record<string, unknown>)) {
    if (d.startsWith(`${year}-`) && /^\d{4}-\d{2}-\d{2}$/.test(d) && typeof name === 'string' && name.trim()) out[d] = name.trim();
  }
  return out;
}

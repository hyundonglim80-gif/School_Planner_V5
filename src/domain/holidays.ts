// 공휴일 (V4 lib/holiday.ts·holidays.ts·dateUtils.getHolidayName). 표는 서버 `holidays/{연도}`(모두가 같이 읽는다 - 개발자가 V5 환경설정 > 개발자(또는 V4)에서 1년에 한 번 받아 둔다)와
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

/** 서버에 공휴일 표가 있어야 하는 해 (P14-3) - 올해, 9월부터는 내년도(2학기에 다음 학년도 학사력·시간표를 짠다) */
export function holidayYearsToWarn(today: string): number[] {
  const y = Number(today.slice(0, 4));
  return today.slice(5) >= '09-01' ? [y, y + 1] : [y];
}

/**
 * 공공데이터포털 특일정보 `getRestDeInfo` 한 달 응답(JSON) → 날짜표 (V4 lib/govApi). 쉬는 날(isHoliday 'Y')만.
 * item이 하나면 배열이 아니고, 그 달에 없으면 items가 빈 글자다. 같은 날 둘이면(어린이날·부처님오신날) 이름을 잇는다.
 * 키가 틀리면 `response` 없이 오류 머리만 온다 - 던져서 그 달을 실패로 센다(V4는 0건으로 넘겼다).
 */
export function parseRestDeInfo(json: unknown): Record<string, string> {
  const res = (json as { response?: { header?: { resultCode?: unknown; resultMsg?: unknown }; body?: { items?: unknown } } } | null)?.response;
  if (!res) {
    const head = (json as { OpenAPI_ServiceResponse?: { cmmMsgHeader?: { errMsg?: unknown } } } | null)?.OpenAPI_ServiceResponse?.cmmMsgHeader;
    throw new Error(String(head?.errMsg ?? '특일정보 응답이 아닙니다'));
  }
  const code = res.header?.resultCode;
  if (code !== undefined && String(code) !== '00') throw new Error(String(res.header?.resultMsg ?? code));
  const raw = (res.body?.items as { item?: unknown } | undefined)?.item;
  const items = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const out: Record<string, string> = {};
  for (const it of items as { isHoliday?: unknown; locdate?: unknown; dateName?: unknown }[]) {
    if (it?.isHoliday !== 'Y') continue;
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(it.locdate ?? ''));
    const name = typeof it.dateName === 'string' ? it.dateName.trim() : '';
    if (!m || !name) continue;
    const d = `${m[1]}-${m[2]}-${m[3]}`;
    out[d] = out[d] && out[d] !== name ? `${out[d]}·${name}` : name;
  }
  return out;
}

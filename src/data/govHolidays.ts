// 공휴일 받기 (P14-3 - V4 lib/govApi·adminConfig·holidays.saveSharedHolidays를 V5로). 환경설정 '개발자' 탭(DevHolidaysSection)만 부른다.
//   - 공공데이터포털 특일정보를 브라우저에서 바로 부른다(응답이 부른 주소를 Access-Control-Allow-Origin으로 돌려준다 - V5 주소 10-29 확인).
//   - 키는 소스에 두지 않는다(빌드에 실려 남이 하루 한도를 쓴다) - `admin/config.govApiKey`(V4와 같은 칸), 규칙이 개발자만 읽고 쓰게 한다.
//   - 받은 표는 `holidays/{연도}`에 V4와 같은 모양 `{ year, days, updatedAt, updatedBy }` - **모양을 바꾸면 V4가 깨진다**. 읽기는 data/holidays.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { parseRestDeInfo, readHolidayDoc } from '../domain/holidays';
import { db } from './firebase';
import { useSession } from './session';

const BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

export interface GovHolidayResult {
  /** 날짜 → 이름 (날짜 차례) */
  days: Record<string, string>;
  /** 받지 못한 달 ('03') */
  failedMonths: string[];
  /** 처음 실패한 까닭 (키 오류·한도 등) */
  reason?: string;
}

/** 그 해 열두 달을 한꺼번에. 다 실패하면 던진다 - 몇 달만 실패하면 failedMonths로 알린다(저장할지는 화면이 묻는다) */
export async function fetchGovHolidays(year: number, apiKey: string): Promise<GovHolidayResult> {
  const clean = apiKey.trim();
  if (!clean) throw new Error('공공데이터포털 키가 없습니다.');
  // 이미 인코딩된 키를 붙여 넣는 일이 많다 - 한 번 풀었다가 다시 (V4)
  let key: string;
  try {
    key = encodeURIComponent(decodeURIComponent(clean));
  } catch {
    key = encodeURIComponent(clean);
  }
  const got: Record<string, string> = {};
  const failedMonths: string[] = [];
  let reason: string | undefined;
  await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const mm = String(i + 1).padStart(2, '0');
      try {
        const res = await fetch(`${BASE}?solYear=${year}&solMonth=${mm}&ServiceKey=${key}&_type=json&numOfRows=100`);
        Object.assign(got, parseRestDeInfo(JSON.parse(await res.text())));
      } catch (e) {
        // 키가 틀리면 오류 JSON·XML이 온다 - 그 달은 실패
        failedMonths.push(mm);
        reason ??= (e as Error)?.message || String(e);
      }
    }),
  );
  failedMonths.sort();
  if (failedMonths.length === 12) throw new Error(`특일정보를 받지 못했습니다 (${reason}). 키와 사용 승인을 확인해 주세요.`);
  const days: Record<string, string> = {};
  for (const d of Object.keys(got).sort()) days[d] = got[d];
  return { days, failedMonths, reason };
}

const configRef = () => doc(db, 'admin', 'config');
const yearRef = (year: number) => doc(db, 'holidays', String(year));
const me = () => useSession.getState().user?.email ?? '';

/** 개발자 키 (없으면 빈 글자 - 개발자가 아니면 규칙이 막아 던진다) */
export async function loadGovApiKey(): Promise<string> {
  const snap = await getDoc(configRef());
  const v = snap.exists() ? (snap.data() as { govApiKey?: unknown }).govApiKey : '';
  return typeof v === 'string' ? v : '';
}

export async function saveGovApiKey(govApiKey: string): Promise<void> {
  await setDoc(configRef(), { govApiKey: govApiKey.trim(), updatedAt: Date.now(), updatedBy: me() }, { merge: true });
}

export interface HolidayYearStatus {
  year: number;
  /** 0 = 문서 없음 */
  count: number;
  updatedAt: number;
  updatedBy: string;
}

/** 서버에 받아 둔 그 해 표 (개수·받은 때) */
export async function loadHolidayYearStatus(year: number): Promise<HolidayYearStatus> {
  const snap = await getDoc(yearRef(year));
  if (!snap.exists()) return { year, count: 0, updatedAt: 0, updatedBy: '' };
  const data = snap.data() as { updatedAt?: unknown; updatedBy?: unknown };
  return {
    year,
    count: Object.keys(readHolidayDoc(year, data)).length,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
}

/** 모두가 읽는 표에 쓴다 (덮어쓰기 - 개발자만, 규칙이 지킨다) */
export async function saveSharedHolidays(year: number, days: Record<string, string>): Promise<void> {
  await setDoc(yearRef(year), { year, days, updatedAt: Date.now(), updatedBy: me() });
}

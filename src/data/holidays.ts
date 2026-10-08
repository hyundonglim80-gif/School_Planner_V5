// 공휴일 표 읽기 (V4 hooks/useGovHolidays.ts·lib/holidays.ts). 서버 `holidays/{연도}`는 모두가 같이 읽기만 한다(개발자가 V4 환경설정에서 받아 둔다).
//   - 해마다 한 번만 읽고 이 기기에 남긴다(`sp5-holidays` - 연결이 없어도 지난번 표로 그린다). 세션마다 한 번 다시 읽는다.
//   - 화면이 그 해를 물으면(holidayName) 그때 읽기 시작한다 - 받으면 version이 올라 구독한 화면이 다시 그린다.
//   - 개인 공휴일(settings/common.myHolidays - V3 표를 가져온 것)은 앱이 setMyHolidays로 넣는다.
//   - domain/period의 기본 공휴일을 이 표로 바꿔 둔다(주말 빼기 기간이 공휴일을 건너뛴다).
import { doc, getDoc } from 'firebase/firestore';
import { create } from 'zustand';
import { holidayNameIn, readHolidayDoc, type HolidayTable } from '../domain/holidays';
import { setDefaultHolidayCheck } from '../domain/period';
import { db } from './firebase';
import { useSession } from './session';

const CACHE_KEY = 'sp5-holidays';
/** 못 읽었으면 이만큼 지나 다시 (연결이 없을 때 그릴 때마다 묻지 않게) */
const RETRY_MS = 60_000;

interface HolidayState {
  shared: Readonly<Record<number, HolidayTable>>;
  mine: HolidayTable;
  /** 표가 바뀔 때마다 오른다 (기억해 둔 셈을 다시 하라는 표지) */
  version: number;
}

function readCache(): Record<number, HolidayTable> {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, unknown>;
    const out: Record<number, HolidayTable> = {};
    for (const [y, days] of Object.entries(v)) out[Number(y)] = readHolidayDoc(Number(y), { days });
    return out;
  } catch {
    return {};
  }
}

function writeCache(shared: Readonly<Record<number, HolidayTable>>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(shared));
  } catch {
    /* 남기지 못해도 이번에는 그린다 */
  }
}

export const useHolidayStore = create<HolidayState>(() => ({ shared: readCache(), mine: {}, version: 0 }));

const asked = new Map<number, number>();

/** 그 해 표를 서버에서 (세션마다 한 번, 실패하면 1분 뒤 다시) */
export function requestHolidayYear(year: number): void {
  // 규칙이 로그인한 사람에게만 읽게 한다 - 로그인 전(과 단위 시험)에는 묻지 않는다
  if (!Number.isFinite(year) || !useSession.getState().user) return;
  const at = asked.get(year);
  if (at !== undefined && (at === 0 || Date.now() - at < RETRY_MS)) return;
  asked.set(year, Date.now());
  let read: Promise<{ exists: () => boolean; data: () => unknown }>;
  try {
    read = getDoc(doc(db, 'holidays', String(year)));
  } catch (e) {
    console.warn('공휴일을 읽을 수 없습니다.', e);
    return;
  }
  read
    .then((snap) => {
      asked.set(year, 0);
      const days = snap.exists() ? readHolidayDoc(year, snap.data()) : {};
      const s = useHolidayStore.getState();
      if (JSON.stringify(s.shared[year] ?? null) === JSON.stringify(days)) return;
      const shared = { ...s.shared, [year]: days };
      writeCache(shared);
      useHolidayStore.setState({ shared, version: s.version + 1 });
    })
    .catch((e) => {
      // 규칙이 막았거나 연결이 없다 - 공휴일 없이도(지난번 표로) 앱은 돈다
      console.warn(`holidays/${year}를 읽지 못했습니다.`, e);
    });
}

/** 그날 공휴일 이름 (그 해 표가 아직 없으면 읽기 시작하고 지금은 고정 공휴일만) */
export function holidayName(date: string): string | undefined {
  const year = Number(date.slice(0, 4));
  const s = useHolidayStore.getState();
  if (asked.get(year) !== 0) requestHolidayYear(year);
  return holidayNameIn(date, s.shared[year] ?? {}, s.mine);
}

export const isHoliday = (date: string) => !!holidayName(date);

/** 앱을 열 때 한 번 (main.tsx): domain/period의 기본 공휴일을 이 표로 - 단위 시험은 넣지 않아 공휴일 없이 센다 */
export function startHolidays() {
  setDefaultHolidayCheck(isHoliday);
}

/** 개인 공휴일 (앱이 설정에서 넣는다) */
export function setMyHolidays(mine: HolidayTable) {
  const s = useHolidayStore.getState();
  if (JSON.stringify(s.mine) === JSON.stringify(mine)) return;
  useHolidayStore.setState({ mine, version: s.version + 1 });
}

/** 공휴일 이름 고르기 - 표가 바뀌면 다시 그린다 */
export function useHolidayName(): (date: string) => string | undefined {
  useHolidayStore((s) => s.version);
  return holidayName;
}

/** 시험: 받은 것을 잊는다 */
export function resetHolidays() {
  asked.clear();
  useHolidayStore.setState({ shared: {}, mine: {}, version: 0 });
}

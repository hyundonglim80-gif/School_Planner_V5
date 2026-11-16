// 구글 캘린더 겹쳐 보기 - 받아 담기 (P36-3 - PLAN 5장 'P36-3 구글 캘린더 받기 ■0 정한 것'). 셈은 domain/gcalOverlay.
//
//   이 기기 IndexedDB `sp5-gcal-{uid}`(계정마다) · 저장소 months(열쇠 = '<캘린더 id>|YYYY-MM') = { events, at }.
//   **앱 자료·백업·서버에 넣지 않는다** - 구글에서 언제든 다시 받을 수 있고, 남의 캘린더를 학급 자료와 섞지 않는다. 로그아웃하면 지운다(공용 PC).
//   - 화면이 달을 쓰면(ensureGcalMonths) 비었거나 15분이 지난 달만 묻는다. 시키지 않은 때는 **조용한 토큰이 있을 때만** - 로그인 창을 띄우지 않는다(4장).
//     토큰이 없으면 받은 것 그대로 + needsLogin('🔄 다시 받기' - 누른 때라 로그인 창을 열어도 된다).
//   - **끝까지 받은 응답만 그 달을 바꾼다**: 끊김·401·5xx·쪽 넘김 도중 실패는 받은 것을 지우지 않는다(3장 '끊긴 때 온 빈 결과를 없음으로 믿지 않는다').
//     401은 토큰을 잊고 needsLogin · 404·403(구글에서 그 캘린더를 지웠거나 구독을 풀었다)은 missing - 고른 것은 지우지 않는다.
//   - 같은 달을 두 곳이 함께 물으면 한 번만(묻는 중인 약속을 함께 쓴다).
// ⚠️ IndexedDB가 고장 나도(없음·막힘) 그 탭 메모리로는 받는다 - 다음에 열면 다시 받는다(콘솔에 한 번).
import { create } from 'zustand';
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { monthRowKey, monthsBetween, OVERLAY_STALE_MS, readGoogleEvent, runRange, runsOf, splitByMonth, staleMonths, type OverlayEvent } from '../domain/gcalOverlay';
import { listEventsBetween } from './google/calendar';
import { forgetGoogleToken, getGoogleTokenQuietly, getValidGoogleToken, GoogleApiError, GoogleAuthError } from './google/token';

export const gcalDbName = (uid: string) => `sp5-gcal-${uid}`;
const STORE = 'months';
const OPEN_TIMEOUT_MS = 3000;

export const GCAL_OVERLAY_LOGIN_REASON = '겹쳐 볼 구글 캘린더 일정을 받으려면 구글 로그인이 필요합니다.';

interface MonthRow {
  key: string;
  cal: string;
  month: string;
  events: OverlayEvent[];
  at: number;
}

export interface MonthCache {
  events: OverlayEvent[];
  /** 끝까지 받은 때(ms) */
  at: number;
}

export interface GcalOverlayState {
  /** 지금 담고 있는 계정 (다른 계정이 들어오면 비운다) */
  uid: string;
  /** 이 기기 사본을 읽었나 */
  loaded: boolean;
  /** '<캘린더 id>|YYYY-MM' → 받은 것 */
  rows: Record<string, MonthCache>;
  /** 묻는 중인 수 */
  fetching: number;
  /** 로그인이 끊겨 받지 못했다 - '🔄 다시 받기' */
  needsLogin: boolean;
  /** 구글이 찾지 못한(지웠거나 구독을 푼) 캘린더 */
  missing: Record<string, true>;
  /** 마지막 실패 (끊김 등 - 받은 것은 그대로) */
  error: string;
  /** 마지막으로 끝까지 받은 때 (0 = 없음) */
  lastAt: number;
}

const blank = (uid = ''): GcalOverlayState => ({ uid, loaded: false, rows: {}, fetching: 0, needsLogin: false, missing: {}, error: '', lastAt: 0 });

export const useGcalOverlay = create<GcalOverlayState>(() => blank());

// ── 이 기기 사본 (IndexedDB) ──

const dbs = new Map<string, Promise<IDBPDatabase | null>>();
let warned = false;

function warnOnce(e: unknown) {
  if (warned) return;
  warned = true;
  console.warn('[gcalOverlay] 받은 구글 일정을 이 기기에 담지 못합니다 (IndexedDB) - 이 탭 동안만 둡니다.', e);
}

function open(uid: string): Promise<IDBPDatabase | null> {
  let p = dbs.get(uid);
  if (!p) {
    const opening = openDB(gcalDbName(uid), 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      },
      // 다른 탭이 로그아웃하며 지우려 한다 - 비켜 준다 (쓰던 글 보관과 같다 - P22-4)
      blocking(_current, _blocked, event) {
        (event.target as IDBDatabase).close();
        dbs.delete(uid);
      },
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), OPEN_TIMEOUT_MS));
    p = Promise.race([opening, timeout]).catch((e: unknown) => {
      warnOnce(e);
      return null;
    });
    dbs.set(uid, p);
  }
  return p;
}

/** 트랜잭션의 끝(tx.done)까지 함께 기다린다 (2장 - 따로 두면 끊길 때 '처리하지 않은 오류'). 실패는 조용히 */
async function withStore<R>(uid: string, mode: IDBTransactionMode, work: (store: IDBPObjectStoreLike) => Promise<R>): Promise<R | undefined> {
  try {
    const db = await open(uid);
    if (!db) return undefined;
    const tx = db.transaction(STORE, mode);
    const [out] = await Promise.all([work(tx.store as unknown as IDBPObjectStoreLike), tx.done]);
    return out;
  } catch (e) {
    warnOnce(e);
    return undefined;
  }
}
interface IDBPObjectStoreLike {
  getAll(): Promise<MonthRow[]>;
  put(row: MonthRow): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

const loading = new Map<string, Promise<void>>();

/** 이 계정의 받은 것을 이 기기 사본에서 읽는다 (계정마다 한 번). 다른 계정이 담겨 있으면 먼저 비운다 */
export function loadGcalCache(uid: string): Promise<void> {
  const st = useGcalOverlay.getState();
  if (st.uid === uid && st.loaded) return Promise.resolve();
  if (st.uid !== uid) useGcalOverlay.setState(blank(uid));
  let p = loading.get(uid);
  if (!p) {
    p = withStore(uid, 'readonly', (s) => s.getAll()).then((list) => {
      loading.delete(uid);
      if (useGcalOverlay.getState().uid !== uid) return;
      const fromDisk: Record<string, MonthCache> = {};
      for (const r of list ?? []) if (r && typeof r.key === 'string' && Array.isArray(r.events)) fromDisk[r.key] = { events: r.events, at: Number(r.at) || 0 };
      // 읽는 동안 받은 것(메모리)이 이긴다
      useGcalOverlay.setState((s) => ({ loaded: true, rows: { ...fromDisk, ...s.rows } }));
    });
    loading.set(uid, p);
  }
  return p;
}

// ── 받기 ──

const inflight = new Map<string, Promise<void>>();

/** 받지 못한 까닭 (needsLogin이면 위로 던져 나머지를 멈춘다) */
class StopFetch extends Error {}

/** 한 캘린더의 이어진 달을 받아 담는다 */
function fetchRun(uid: string, token: string, cal: string, run: { from: string; to: string }): Promise<void> {
  const key = `${uid}\n${cal}\n${run.from}\n${run.to}`;
  const going = inflight.get(key);
  if (going) return going;
  const p = (async () => {
    useGcalOverlay.setState((s) => ({ fetching: s.fetching + 1 }));
    try {
      const { timeMin, timeMax } = runRange(run);
      const raw = await listEventsBetween(token, cal, timeMin, timeMax);
      const events = raw.map((r) => readGoogleEvent(r, cal)).filter((e): e is OverlayEvent => !!e);
      const months = monthsBetween(run.from, run.to);
      const split = splitByMonth(events, months);
      const at = Date.now();
      if (useGcalOverlay.getState().uid !== uid) return; // 그새 계정이 바뀌었다
      const rows: Record<string, MonthCache> = {};
      for (const m of months) rows[monthRowKey(cal, m)] = { events: split[m], at };
      useGcalOverlay.setState((s) => {
        const missing = { ...s.missing };
        delete missing[cal];
        return { rows: { ...s.rows, ...rows }, missing, error: '', lastAt: at };
      });
      await withStore(uid, 'readwrite', async (s) => {
        for (const m of months) await s.put({ key: monthRowKey(cal, m), cal, month: m, events: split[m], at });
      });
    } catch (e) {
      if (e instanceof GoogleApiError && e.needsLogin) {
        forgetGoogleToken();
        useGcalOverlay.setState({ needsLogin: true });
        throw new StopFetch();
      }
      if (e instanceof GoogleApiError && (e.status === 404 || e.status === 403)) {
        useGcalOverlay.setState((s) => ({ missing: { ...s.missing, [cal]: true } }));
        return;
      }
      // 끊김·5xx - 받은 것은 그대로 두고 알린다(다음에 화면이 그 달을 쓰면 다시). 코드 고장도 여기 오므로 콘솔에 남긴다
      console.warn('[gcalOverlay] 구글 캘린더 일정을 받지 못했습니다.', e);
      const msg = e instanceof GoogleApiError ? e.message : '구글 캘린더에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.';
      useGcalOverlay.setState({ error: msg });
      throw new StopFetch();
    } finally {
      inflight.delete(key);
      useGcalOverlay.setState((s) => ({ fetching: Math.max(0, s.fetching - 1) }));
    }
  })();
  inflight.set(key, p);
  return p;
}

/** 조용한 토큰이 없던 때 - 이만큼은 다시 묻지 않는다 */
const QUIET_RETRY_MS = 60_000;
let lastQuietMiss = 0;

export interface EnsureOptions {
  /** 사용자가 눌러 시켰다 - 토큰이 없으면 로그인을 묻는다 */
  interactive?: boolean;
  /** 15분을 기다리지 않고 모두 다시 */
  force?: boolean;
  now?: number;
}

/**
 * 고른 캘린더의 그 달들을 받아 둔다 (비었거나 15분이 지난 달만). 받을 것이 없으면 구글에 묻지 않는다.
 * 시키지 않은 때는 조용한 토큰만 - 없으면 needsLogin. 던지지 않는다(상태에 적는다).
 */
export async function ensureGcalMonths(uid: string, cals: readonly string[], months: readonly string[], opts: EnsureOptions = {}): Promise<void> {
  if (!uid || !cals.length || !months.length) return;
  await loadGcalCache(uid);
  if (useGcalOverlay.getState().uid !== uid) return;
  const plan = staleMonths(useGcalOverlay.getState().rows, cals, months, opts.now ?? Date.now(), opts.force ? 0 : OVERLAY_STALE_MS);
  if (!plan.length) return;
  let token: string | null;
  if (opts.interactive) {
    try {
      token = await getValidGoogleToken(GCAL_OVERLAY_LOGIN_REASON);
    } catch (e) {
      useGcalOverlay.setState({ needsLogin: true, error: e instanceof GoogleAuthError ? e.message : '구글 로그인을 하지 못했습니다.' });
      return;
    }
  } else {
    // 방금 조용한 토큰이 없었으면 날을 옮길 때마다 구글에 토큰을 묻지 않는다 (1분 - 그새 다른 일로 로그인하면 그 뒤에 받는다)
    const now = opts.now ?? Date.now();
    if (useGcalOverlay.getState().needsLogin && now - lastQuietMiss < QUIET_RETRY_MS) return;
    token = await getGoogleTokenQuietly();
    if (!token) lastQuietMiss = now;
  }
  if (!token) {
    useGcalOverlay.setState({ needsLogin: true });
    return;
  }
  lastQuietMiss = 0;
  useGcalOverlay.setState({ needsLogin: false });
  try {
    for (const { cal, months: need } of plan) for (const r of runsOf(need)) await fetchRun(uid, token, cal, r);
  } catch (e) {
    if (!(e instanceof StopFetch)) throw e;
  }
}

/** 고르기에서 뺀 캘린더들의 받은 것을 지운다 (keep = 남길 캘린더) */
export async function pruneGcalCalendars(uid: string, keep: readonly string[]): Promise<void> {
  if (!uid) return;
  await loadGcalCache(uid);
  const st = useGcalOverlay.getState();
  if (st.uid !== uid) return;
  const keepSet = new Set(keep);
  const drop = Object.keys(st.rows).filter((k) => !keepSet.has(k.slice(0, k.lastIndexOf('|'))));
  const dropMissing = Object.keys(st.missing).filter((c) => !keepSet.has(c));
  if (!drop.length && !dropMissing.length) return;
  useGcalOverlay.setState((s) => {
    const rows = { ...s.rows };
    for (const k of drop) delete rows[k];
    const missing = { ...s.missing };
    for (const c of dropMissing) delete missing[c];
    return { rows, missing };
  });
  if (drop.length)
    await withStore(uid, 'readwrite', async (s) => {
      for (const k of drop) await s.delete(k);
    });
}

/** 로그아웃 - 그 계정의 받은 것을 통째로 */
export async function wipeGcalOverlay(uid: string): Promise<void> {
  const db = await dbs.get(uid);
  db?.close();
  dbs.delete(uid);
  loading.delete(uid);
  if (useGcalOverlay.getState().uid === uid) useGcalOverlay.setState(blank());
  await deleteDB(gcalDbName(uid));
}

/** 시험에서 열어 둔 DB를 잊는다 */
export function resetGcalOverlayForTest() {
  for (const p of dbs.values()) void p.then((db) => db?.close());
  dbs.clear();
  loading.clear();
  inflight.clear();
  warned = false;
  lastQuietMiss = 0;
  useGcalOverlay.setState(blank());
}

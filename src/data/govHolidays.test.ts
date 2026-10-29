// 공휴일 받기 (P14-3) - 특일정보 열두 달 받기(가짜 fetch)·키·V4와 같은 문서 모양
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSession } from './session';
import { fetchGovHolidays, loadGovApiKey, loadHolidayYearStatus, saveGovApiKey, saveSharedHolidays } from './govHolidays';

vi.mock('./firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const store = vi.hoisted(() => ({ docs: {} as Record<string, Record<string, unknown>>, writes: [] as { path: string; data: Record<string, unknown>; opts?: unknown }[] }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  getDoc: vi.fn(async (ref: { path: string }) => ({ exists: () => ref.path in store.docs, data: () => store.docs[ref.path] })),
  setDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>, opts?: unknown) => {
    store.writes.push({ path: ref.path, data, opts });
  }),
}));

const ok = (items: unknown) => JSON.stringify({ response: { header: { resultCode: '00' }, body: { items } } });
const BAD_KEY = JSON.stringify({ OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } });

/** 특일정보 흉내: 달마다 줄 글 (없는 달은 빈 items) */
function fakeApi(months: Record<string, string>) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(input);
      urls.push(url);
      const mm = /solMonth=(\d\d)/.exec(url)![1];
      const body = months[mm] ?? ok('');
      if (body === 'NETWORK') throw new TypeError('Failed to fetch');
      return { text: async () => body };
    }),
  );
  return urls;
}

beforeEach(() => {
  store.docs = {};
  store.writes = [];
  useSession.setState({ loading: false, user: { uid: 'u1', email: 'dev@example.com', displayName: '', photoURL: '' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('특일정보 받기', () => {
  it('열두 달을 부르고 날짜 차례로 모은다 - 인코딩된 키는 한 번만', async () => {
    const urls = fakeApi({
      '09': ok({ item: [{ dateName: '추석', isHoliday: 'Y', locdate: 20270915 }] }),
      '02': ok({ item: { dateName: '설날', isHoliday: 'Y', locdate: 20270207 } }),
    });
    const r = await fetchGovHolidays(2027, ' ab%2Bc ');
    expect(urls).toHaveLength(12);
    expect(urls.every((u) => u.includes('solYear=2027') && u.includes('ServiceKey=ab%2Bc&'))).toBe(true);
    expect(Object.keys(r.days)).toEqual(['2027-02-07', '2027-09-15']);
    expect(r.failedMonths).toEqual([]);
  });

  it('몇 달만 실패하면 알리고, 다 실패하면 던진다', async () => {
    fakeApi({ '03': 'NETWORK', '11': '<xml>오류</xml>', '05': ok({ item: { dateName: '부처님오신날', isHoliday: 'Y', locdate: 20270513 } }) });
    const r = await fetchGovHolidays(2027, 'k');
    expect(r.failedMonths).toEqual(['03', '11']);
    expect(r.days).toEqual({ '2027-05-13': '부처님오신날' });

    fakeApi(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, '0'), BAD_KEY])));
    await expect(fetchGovHolidays(2027, 'k')).rejects.toThrow('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    await expect(fetchGovHolidays(2027, '  ')).rejects.toThrow('키가 없습니다');
  });
});

describe('키·서버 표', () => {
  it('키는 admin/config에 합쳐 쓴다 (V4와 같은 칸)', async () => {
    expect(await loadGovApiKey()).toBe('');
    store.docs['admin/config'] = { govApiKey: 'KEY1' };
    expect(await loadGovApiKey()).toBe('KEY1');
    await saveGovApiKey(' KEY2 ');
    expect(store.writes[0]).toMatchObject({ path: 'admin/config', data: { govApiKey: 'KEY2', updatedBy: 'dev@example.com' }, opts: { merge: true } });
  });

  it('holidays/{연도}는 V4와 같은 모양으로 덮어쓴다', async () => {
    await saveSharedHolidays(2027, { '2027-02-07': '설날' });
    const w = store.writes[0];
    expect(w.path).toBe('holidays/2027');
    expect(w.opts).toBeUndefined();
    expect(Object.keys(w.data).sort()).toEqual(['days', 'updatedAt', 'updatedBy', 'year']);
    expect(w.data).toMatchObject({ year: 2027, days: { '2027-02-07': '설날' }, updatedBy: 'dev@example.com' });
  });

  it('받아 둔 표의 개수·받은 때 (없으면 0)', async () => {
    expect(await loadHolidayYearStatus(2028)).toEqual({ year: 2028, count: 0, updatedAt: 0, updatedBy: '' });
    store.docs['holidays/2027'] = { year: 2027, days: { '2027-02-07': '설날', '2027-09-15': '추석' }, updatedAt: 5, updatedBy: 'a@b' };
    expect(await loadHolidayYearStatus(2027)).toEqual({ year: 2027, count: 2, updatedAt: 5, updatedBy: 'a@b' });
  });
});

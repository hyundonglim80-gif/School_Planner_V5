// 구글 캘린더 겹쳐 보기 받아 담기 (P36-3) - 조용한 토큰일 때만 · 이 기기에 담기 · 15분 · 끝까지 받은 것만 바꿈(끊김·401·404) · 함께 물으면 한 번 · 뺀 캘린더·로그아웃 지우기
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monthRowKey, type GoogleEventRaw } from '../domain/gcalOverlay';
import { ensureGcalMonths, loadGcalCache, pruneGcalCalendars, resetGcalOverlayForTest, useGcalOverlay, wipeGcalOverlay } from './gcalOverlay';
import { GoogleApiError } from './google/token';

vi.mock('./firebase', () => ({ auth: { currentUser: null }, GOOGLE_SCOPES: [] }));

const g = vi.hoisted(() => ({
  quiet: 'tok' as string | null,
  quietCalls: 0,
  valid: 'fresh',
  forgot: 0,
  calls: [] as Array<{ token: string; cal: string; timeMin: string; timeMax: string }>,
  answer: (() => Promise.resolve([])) as (cal: string, timeMin: string) => Promise<GoogleEventRaw[]>,
}));

vi.mock('./google/token', async (orig) => {
  const real = await orig<typeof import('./google/token')>();
  return {
    ...real,
    getGoogleTokenQuietly: vi.fn(async () => {
      g.quietCalls += 1;
      return g.quiet;
    }),
    getValidGoogleToken: vi.fn(async () => g.valid),
    forgetGoogleToken: vi.fn(() => {
      g.forgot += 1;
    }),
  };
});
vi.mock('./google/calendar', () => ({
  listEventsBetween: vi.fn(async (token: string, cal: string, timeMin: string, timeMax: string) => {
    g.calls.push({ token, cal, timeMin, timeMax });
    return g.answer(cal, timeMin);
  }),
}));

const UID = 'me';
const NOV = ['2026-10', '2026-11', '2026-12'];
const allDay = (id: string, date: string, end: string): GoogleEventRaw => ({ id, summary: id, start: { date }, end: { date: end } });

beforeEach(async () => {
  resetGcalOverlayForTest();
  await wipeGcalOverlay(UID);
  resetGcalOverlayForTest();
  g.quiet = 'tok';
  g.valid = 'fresh';
  g.forgot = 0;
  g.quietCalls = 0;
  g.calls = [];
  g.answer = () => Promise.resolve([allDay('sports', '2026-11-20', '2026-11-21')]);
});

const ids = (cal: string, month: string) => useGcalOverlay.getState().rows[monthRowKey(cal, month)]?.events.map((e) => e.id);

describe('받기', () => {
  it('고른 캘린더가 없거나 달이 없으면 구글에 묻지 않는다', async () => {
    await ensureGcalMonths(UID, [], NOV);
    await ensureGcalMonths(UID, ['c1'], []);
    expect(g.calls).toEqual([]);
  });

  it('이어진 석 달을 한 번에 묻고 달마다 담는다 - 빈 달도 받은 것', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    expect(g.calls).toHaveLength(1);
    expect(new Date(g.calls[0].timeMin).getTime()).toBe(new Date(2026, 9, 1).getTime());
    expect(new Date(g.calls[0].timeMax).getTime()).toBe(new Date(2027, 0, 1).getTime());
    expect(ids('c1', '2026-11')).toEqual(['sports']);
    expect(ids('c1', '2026-10')).toEqual([]);
    expect(useGcalOverlay.getState().lastAt).toBeGreaterThan(0);
  });

  it('이 기기에 담겨 다시 열어도(새 탭) 있다', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    resetGcalOverlayForTest();
    expect(ids('c1', '2026-11')).toBeUndefined();
    await loadGcalCache(UID);
    expect(ids('c1', '2026-11')).toEqual(['sports']);
  });

  it('15분 안에는 다시 묻지 않고, 지나면·force면 다시', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    await ensureGcalMonths(UID, ['c1'], NOV);
    expect(g.calls).toHaveLength(1);
    await ensureGcalMonths(UID, ['c1'], NOV, { now: Date.now() + 15 * 60 * 1000 + 1 });
    expect(g.calls).toHaveLength(2);
    await ensureGcalMonths(UID, ['c1'], NOV, { force: true });
    expect(g.calls).toHaveLength(3);
  });

  it('옮긴 화면의 없는 달만 묻는다 (11월 ±1을 받은 뒤 12월 ±1 = 1월만)', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    await ensureGcalMonths(UID, ['c1'], ['2026-11', '2026-12', '2027-01']);
    expect(g.calls).toHaveLength(2);
    expect(new Date(g.calls[1].timeMin).getTime()).toBe(new Date(2027, 0, 1).getTime());
  });

  it('같은 달을 두 곳이 함께 물으면 한 번만', async () => {
    let release: () => void = () => {};
    g.answer = () => new Promise((r) => (release = () => r([])));
    const a = ensureGcalMonths(UID, ['c1'], NOV);
    const b = ensureGcalMonths(UID, ['c1'], NOV);
    await vi.waitFor(() => expect(g.calls).toHaveLength(1));
    expect(useGcalOverlay.getState().fetching).toBe(1);
    release();
    await Promise.all([a, b]);
    expect(g.calls).toHaveLength(1);
    expect(useGcalOverlay.getState().fetching).toBe(0);
  });
});

describe('로그인이 끊겼을 때', () => {
  it('조용한 토큰이 없으면 로그인 창 없이 받은 것 그대로 + needsLogin', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    g.quiet = null;
    await ensureGcalMonths(UID, ['c1'], NOV, { force: true });
    expect(g.calls).toHaveLength(1);
    expect(useGcalOverlay.getState().needsLogin).toBe(true);
    expect(ids('c1', '2026-11')).toEqual(['sports']);
  });

  it('조용한 토큰이 없었으면 1분 동안은 날을 옮겨도 토큰을 다시 묻지 않는다', async () => {
    g.quiet = null;
    const now = Date.now();
    await ensureGcalMonths(UID, ['c1'], NOV, { now });
    await ensureGcalMonths(UID, ['c1'], ['2026-11', '2026-12', '2027-01'], { now: now + 30_000 });
    expect(g.quietCalls).toBe(1);
    await ensureGcalMonths(UID, ['c1'], NOV, { now: now + 61_000 });
    expect(g.quietCalls).toBe(2);
    g.quiet = 'tok';
    await ensureGcalMonths(UID, ['c1'], NOV, { now: now + 130_000 });
    expect(g.calls).toHaveLength(1);
    expect(useGcalOverlay.getState().needsLogin).toBe(false);
  });

  it('누른 때(interactive)는 로그인을 물어 받은 토큰으로', async () => {
    g.quiet = null;
    await ensureGcalMonths(UID, ['c1'], NOV, { interactive: true });
    expect(g.calls[0].token).toBe('fresh');
    expect(useGcalOverlay.getState().needsLogin).toBe(false);
  });

  it('구글이 401이면 토큰을 잊고 needsLogin, 받은 것은 지우지 않고 나머지 캘린더도 묻지 않는다', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    g.answer = () => Promise.reject(new GoogleApiError(401, '만료'));
    await ensureGcalMonths(UID, ['c1', 'c2'], NOV, { force: true });
    expect(g.forgot).toBe(1);
    expect(g.calls).toHaveLength(2);
    expect(useGcalOverlay.getState().needsLogin).toBe(true);
    expect(ids('c1', '2026-11')).toEqual(['sports']);
  });
});

describe('실패해도 받은 것은 그대로', () => {
  it('끊김(fetch 실패) - 받은 달을 비우지 않고 안내 글', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    g.answer = () => Promise.reject(new TypeError('Failed to fetch'));
    await ensureGcalMonths(UID, ['c1'], NOV, { force: true });
    expect(ids('c1', '2026-11')).toEqual(['sports']);
    expect(useGcalOverlay.getState().error).toContain('닿지 못했습니다');
    // 다시 받으면 안내가 걷힌다
    g.answer = () => Promise.resolve([]);
    await ensureGcalMonths(UID, ['c1'], NOV, { force: true });
    expect(useGcalOverlay.getState().error).toBe('');
    expect(ids('c1', '2026-11')).toEqual([]);
  });

  it('404(구글에서 지운 캘린더)는 그 캘린더만 missing - 다른 캘린더는 받는다', async () => {
    g.answer = (cal) => (cal === 'gone' ? Promise.reject(new GoogleApiError(404, '없음')) : Promise.resolve([allDay('x', '2026-11-02', '2026-11-03')]));
    await ensureGcalMonths(UID, ['gone', 'c1'], NOV);
    expect(useGcalOverlay.getState().missing).toEqual({ gone: true });
    expect(ids('c1', '2026-11')).toEqual(['x']);
    expect(ids('gone', '2026-11')).toBeUndefined();
  });
});

describe('지우기', () => {
  it('고르기에서 뺀 캘린더의 받은 것은 메모리·이 기기 사본 모두에서', async () => {
    await ensureGcalMonths(UID, ['c1', 'c2'], NOV);
    await pruneGcalCalendars(UID, ['c2']);
    expect(ids('c1', '2026-11')).toBeUndefined();
    expect(ids('c2', '2026-11')).toEqual(['sports']);
    resetGcalOverlayForTest();
    await loadGcalCache(UID);
    expect(ids('c1', '2026-11')).toBeUndefined();
    expect(ids('c2', '2026-11')).toEqual(['sports']);
  });

  it('로그아웃(wipe)하면 모두 없다, 계정마다 따로', async () => {
    await ensureGcalMonths(UID, ['c1'], NOV);
    await ensureGcalMonths('other', ['c1'], NOV);
    await wipeGcalOverlay('other');
    resetGcalOverlayForTest();
    await loadGcalCache(UID);
    expect(ids('c1', '2026-11')).toEqual(['sports']);
    await wipeGcalOverlay(UID);
    resetGcalOverlayForTest();
    await loadGcalCache(UID);
    expect(useGcalOverlay.getState().rows).toEqual({});
  });
});

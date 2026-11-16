// 구글 캘린더 읽기 (P36-3) - 캘린더 목록·기간 일정: 쪽 넘김 끝까지 · 묻는 값 · 도중 실패는 던진다(반쪽 목록을 믿지 않게)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listCalendars, listEventsBetween } from './calendar';
import { GoogleApiError } from './token';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, GOOGLE_SCOPES: [] }));

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('캘린더 목록', () => {
  it('다음 쪽까지 모두, 토큰을 싣고', async () => {
    fetchMock.mockImplementationOnce(() => json(200, { items: [{ id: 'a' }], nextPageToken: 'p2' })).mockImplementationOnce(() => json(200, { items: [{ id: 'b' }] }));
    expect((await listCalendars('tok')).map((c) => c.id)).toEqual(['a', 'b']);
    const [url1, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url1).toContain('/calendar/v3/users/me/calendarList?');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('pageToken')).toBe('p2');
  });
});

describe('기간 일정', () => {
  it('반복 펼치기·기간·서울 시각으로 묻고 다음 쪽까지 모두', async () => {
    fetchMock.mockImplementationOnce(() => json(200, { items: [{ id: 'e1' }, { id: 'e2' }], nextPageToken: 'n' })).mockImplementationOnce(() => json(200, { items: [{ id: 'e3' }] }));
    const out = await listEventsBetween('tok', 'me@x.com', '2026-10-31T15:00:00.000Z', '2027-01-31T15:00:00.000Z');
    expect(out.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/calendar/v3/calendars/me%40x.com/events');
    expect(u.searchParams.get('singleEvents')).toBe('true');
    expect(u.searchParams.get('timeMin')).toBe('2026-10-31T15:00:00.000Z');
    expect(u.searchParams.get('timeMax')).toBe('2027-01-31T15:00:00.000Z');
    expect(u.searchParams.get('timeZone')).toBe('Asia/Seoul');
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('pageToken')).toBe('n');
  });

  it('둘째 쪽에서 실패하면 받은 첫 쪽도 돌려주지 않고 던진다 (401은 다시 로그인)', async () => {
    fetchMock.mockImplementationOnce(() => json(200, { items: [{ id: 'e1' }], nextPageToken: 'n' })).mockImplementationOnce(() => json(401, { error: { message: 'Invalid Credentials' } }));
    const err = await listEventsBetween('tok', 'c', 'a', 'b').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect((err as GoogleApiError).needsLogin).toBe(true);
  });

  it('끝없이 다음 쪽을 주면 멈추고 던진다', async () => {
    fetchMock.mockImplementation(() => json(200, { items: [], nextPageToken: 'again' }));
    await expect(listEventsBetween('tok', 'c', 'a', 'b')).rejects.toBeInstanceOf(GoogleApiError);
    expect(fetchMock.mock.calls.length).toBe(50);
  });
});

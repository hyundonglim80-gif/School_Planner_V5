// 구글 캘린더 API (V4 lib/googleApi.ts의 캘린더 부분). 토큰은 token.ts에서 받아 넘긴다.
// 실패는 GoogleApiError로 던진다 - 부르는 쪽이 401(토큰 만료)·404(캘린더를 지웠다)를 가른다.
import type { GoogleEvent, GoogleEventPayload } from '../../domain/gcal';
import type { GoogleCalendarEntry, GoogleEventRaw } from '../../domain/gcalOverlay';
import { GoogleApiError, googleFetch } from './token';

const API = 'https://www.googleapis.com/calendar/v3';
/** 쪽 넘김 끝 - 고장 난 응답이 끝없이 다음 쪽을 주지 않게 */
const MAX_PAGES = 50;

const eventsUrl = (calId: string) => `${API}/calendars/${encodeURIComponent(calId)}/events`;

/** 이름으로 캘린더를 찾고, 없으면 만든다 */
export async function getOrCreateCalendarByName(token: string, summary: string): Promise<string> {
  const list = await googleFetch<{ items?: Array<{ id: string; summary?: string }> }>(`${API}/users/me/calendarList`, 'GET', token);
  const existing = (list?.items ?? []).find((c) => c.summary === summary);
  if (existing) return existing.id;
  const created = await googleFetch<{ id: string }>(`${API}/calendars`, 'POST', token, {
    summary,
    description: 'School Planner에서 동기화된 캘린더입니다.',
    timeZone: 'Asia/Seoul',
  });
  return created!.id;
}

/** 쪽을 넘기며 모두 받는다 (도중에 하나라도 실패하면 던진다 - 반쪽 목록을 '이것뿐'으로 믿지 않게) */
async function allPages<T>(url: string, params: URLSearchParams, token: string): Promise<T[]> {
  const out: T[] = [];
  let pageToken = '';
  let pages = 0;
  do {
    if (++pages > MAX_PAGES) throw new GoogleApiError(500, '구글 캘린더 목록이 너무 깁니다.');
    if (pageToken) params.set('pageToken', pageToken);
    const res = await googleFetch<{ items?: T[]; nextPageToken?: string }>(`${url}?${params}`, 'GET', token);
    out.push(...(res?.items ?? []));
    pageToken = res?.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

/**
 * 일정 목록 (다음 쪽까지 모두). props = 우리 표시 privateExtendedProperty('app=…'·'sp_item=…' - 여럿이면 모두 맞는 것).
 * 실패하면 던진다 - 빈 목록으로 알면 두 벌을 넣는다.
 */
export async function listCalendarEvents(
  token: string,
  calId: string,
  props: readonly string[],
  range?: { timeMin: string; timeMax: string },
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
  if (range) {
    params.set('timeMin', range.timeMin);
    params.set('timeMax', range.timeMax);
  }
  for (const p of props) params.append('privateExtendedProperty', p);
  return allPages<GoogleEvent>(eventsUrl(calId), params, token);
}

/** 내 캘린더 목록 (겹쳐 보기 고르기 - P36-3). 숨긴 캘린더는 구글이 주지 않는다 */
export const listCalendars = (token: string): Promise<GoogleCalendarEntry[]> =>
  allPages<GoogleCalendarEntry>(
    `${API}/users/me/calendarList`,
    new URLSearchParams({ maxResults: '250', fields: 'items(id,summary,summaryOverride,backgroundColor,primary,deleted),nextPageToken' }),
    token,
  );

/**
 * 기간의 일정 모두 - 반복은 펼쳐서(singleEvents), 시각은 서울로 (겹쳐 보기 - P36-3). 실패하면 던진다(받은 것을 지우지 않게).
 * timeMin·timeMax = ISO 시각 (구글은 끝이 timeMin 뒤이고 시작이 timeMax 앞인 것을 준다)
 */
export const listEventsBetween = (token: string, calId: string, timeMin: string, timeMax: string): Promise<GoogleEventRaw[]> =>
  allPages<GoogleEventRaw>(
    eventsUrl(calId),
    new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin,
      timeMax,
      timeZone: 'Asia/Seoul',
      maxResults: '2500',
      fields: 'items(id,status,summary,description,location,htmlLink,start,end),nextPageToken',
    }),
    token,
  );

export const insertCalendarEvent = (token: string, calId: string, payload: GoogleEventPayload) => googleFetch(eventsUrl(calId), 'POST', token, payload);

export const updateCalendarEvent = (token: string, calId: string, id: string, payload: GoogleEventPayload) =>
  googleFetch(`${eventsUrl(calId)}/${encodeURIComponent(id)}`, 'PUT', token, payload);

export const deleteCalendarEvent = (token: string, calId: string, id: string) => googleFetch(`${eventsUrl(calId)}/${encodeURIComponent(id)}`, 'DELETE', token);

// 구글 캘린더 API (V4 lib/googleApi.ts의 캘린더 부분). 토큰은 token.ts에서 받아 넘긴다.
// 실패는 GoogleApiError로 던진다 - 부르는 쪽이 401(토큰 만료)·404(캘린더를 지웠다)를 가른다.
import type { GoogleEvent, GoogleEventPayload } from '../../domain/gcal';
import { googleFetch } from './token';

const API = 'https://www.googleapis.com/calendar/v3';

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
  const out: GoogleEvent[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
    if (range) {
      params.set('timeMin', range.timeMin);
      params.set('timeMax', range.timeMax);
    }
    for (const p of props) params.append('privateExtendedProperty', p);
    if (pageToken) params.set('pageToken', pageToken);
    const res = await googleFetch<{ items?: GoogleEvent[]; nextPageToken?: string }>(`${eventsUrl(calId)}?${params}`, 'GET', token);
    out.push(...(res?.items ?? []));
    pageToken = res?.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

export const insertCalendarEvent = (token: string, calId: string, payload: GoogleEventPayload) => googleFetch(eventsUrl(calId), 'POST', token, payload);

export const updateCalendarEvent = (token: string, calId: string, id: string, payload: GoogleEventPayload) =>
  googleFetch(`${eventsUrl(calId)}/${encodeURIComponent(id)}`, 'PUT', token, payload);

export const deleteCalendarEvent = (token: string, calId: string, id: string) => googleFetch(`${eventsUrl(calId)}/${encodeURIComponent(id)}`, 'DELETE', token);

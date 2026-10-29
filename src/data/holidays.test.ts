// 공휴일 표 읽기 - 서버에 없는 해를 기억한다 (P14-3 ■3 개발자 경고)
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from './session';
import { holidayName, refreshHolidayYear, resetHolidays, useHolidayStore, useMissingHolidayYears } from './holidays';

vi.mock('./firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const server = vi.hoisted(() => ({ docs: {} as Record<string, Record<string, unknown>>, reads: 0 }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  getDoc: vi.fn(async (ref: { path: string }) => {
    server.reads++;
    return { exists: () => ref.path in server.docs, data: () => server.docs[ref.path] };
  }),
}));

beforeEach(() => {
  resetHolidays();
  server.docs = { 'holidays/2026': { days: { '2026-09-25': '추석' } } };
  server.reads = 0;
  useSession.setState({ loading: false, user: { uid: 'u1', email: 'dev@example.com', displayName: '', photoURL: '' } });
});

afterAll(() => {
  useSession.setState({ loading: true, user: null });
});

describe('공휴일 표 - 없는 해', () => {
  it('없는 해만 돌려준다 (읽기 전에는 없다고 하지 않는다)', async () => {
    const { result } = renderHook(() => useMissingHolidayYears([2026, 2027]));
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual([2027]));
    expect(useHolidayStore.getState().shared[2026]).toEqual({ '2026-09-25': '추석' });
  });

  it('받아 저장한 뒤 다시 읽으면 없음이 풀리고 이름이 보인다', async () => {
    const { result } = renderHook(() => useMissingHolidayYears([2027]));
    await waitFor(() => expect(result.current).toEqual([2027]));
    server.docs['holidays/2027'] = { days: { '2027-09-15': '추석' } };
    refreshHolidayYear(2027);
    await waitFor(() => expect(result.current).toEqual([]));
    expect(holidayName('2027-09-15')).toBe('추석');
  });

  it('로그인 전에는 읽지 않는다', () => {
    useSession.setState({ loading: false, user: null });
    renderHook(() => useMissingHolidayYears([2027]));
    expect(server.reads).toBe(0);
  });
});

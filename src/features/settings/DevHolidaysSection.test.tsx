import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import DevHolidaysSection from './DevHolidaysSection';

// 개발자 탭 공휴일 (P14-3 ■2) - 서버·특일정보는 가짜, 날은 2026-10-29

const server = vi.hoisted(() => ({
  key: 'KEY',
  counts: {} as Record<number, number>,
  fetched: {} as Record<string, string>,
  failedMonths: [] as string[],
  fail: null as Error | null,
}));
const api = vi.hoisted(() => ({
  fetchGovHolidays: vi.fn(async () => {
    if (server.fail) throw server.fail;
    return { days: server.fetched, failedMonths: server.failedMonths, reason: server.failedMonths.length ? 'Failed to fetch' : undefined };
  }),
  loadGovApiKey: vi.fn(async () => server.key),
  saveGovApiKey: vi.fn(async (k: string) => {
    server.key = k.trim();
  }),
  loadHolidayYearStatus: vi.fn(async (year: number) => ({ year, count: server.counts[year] ?? 0, updatedAt: server.counts[year] ? Date.parse('2026-10-29T09:00:00') : 0, updatedBy: '' })),
  saveSharedHolidays: vi.fn(async (year: number, days: Record<string, string>) => {
    server.counts[year] = Object.keys(days).length;
  }),
}));
vi.mock('../../data/govHolidays', () => api);
const refreshHolidayYear = vi.hoisted(() => vi.fn());
vi.mock('../../data/holidays', () => ({ refreshHolidayYear }));

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const row = (y: number) => q(`[data-dev-holiday-year="${y}"]`);
const days = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2027-01-${String(i + 1).padStart(2, '0')}`, `휴일${i}`]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00'));
  server.key = 'KEY';
  server.counts = { 2026: 20 };
  server.fetched = days(18);
  server.failedMonths = [];
  server.fail = null;
  Object.values(api).forEach((f) => f.mockClear());
  refreshHolidayYear.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('개발자 탭 공휴일', () => {
  it('올해·내년·내후년 줄 - 있는 해는 건수·받은 날, 없는 해는 ⚠️ 없음', async () => {
    render(<DevHolidaysSection />);
    await waitFor(() => expect(row(2028)).toBeInTheDocument());
    expect(row(2026)).toHaveTextContent('20건 · 10/29 받음');
    expect(row(2026).querySelector('[data-dev-holiday-fetch]')).toHaveTextContent('다시 받기');
    expect(row(2027)).toHaveTextContent('⚠️ 없음');
    expect(row(2027).querySelector('[data-dev-holiday-fetch]')).toHaveTextContent('받기');
    await waitFor(() => expect(q('[data-dev-holidays-key]')).toHaveValue('KEY'));
  });

  it('받기 → 저장하고 이 기기 표를 다시 읽고 줄을 고친다', async () => {
    render(<DevHolidaysSection />);
    await waitFor(() => expect(q('[data-dev-holidays-key]')).toHaveValue('KEY'));
    fireEvent.click(q('[data-dev-holiday-fetch="2027"]'));
    await waitFor(() => expect(row(2027)).toHaveTextContent('18건'));
    expect(api.fetchGovHolidays).toHaveBeenCalledWith(2027, 'KEY');
    expect(api.saveSharedHolidays).toHaveBeenCalledWith(2027, server.fetched);
    expect(refreshHolidayYear).toHaveBeenCalledWith(2027);
  });

  it('지금보다 적거나 받지 못한 달이 있으면 묻고, 아니오면 쓰지 않는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    server.failedMonths = ['03'];
    render(<DevHolidaysSection />);
    await waitFor(() => expect(q('[data-dev-holidays-key]')).toHaveValue('KEY'));
    fireEvent.click(q('[data-dev-holiday-fetch="2026"]'));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0][0]).toContain('3월을 받지 못했습니다');
    expect(confirm.mock.calls[0][0]).toContain('지금 20건 → 받은 것 18건');
    await waitFor(() => expect(q('[data-dev-holiday-fetch="2026"]')).not.toBeDisabled());
    expect(api.saveSharedHolidays).not.toHaveBeenCalled();
  });

  it('키를 바꾸면 💾 저장이 켜지고, 키가 없으면 받지 않는다', async () => {
    server.key = '';
    render(<DevHolidaysSection />);
    await waitFor(() => expect(row(2027)).toBeInTheDocument());
    expect(q('[data-dev-holidays-key-save]')).toBeDisabled();
    fireEvent.click(q('[data-dev-holiday-fetch="2027"]'));
    expect(api.fetchGovHolidays).not.toHaveBeenCalled();
    fireEvent.change(q('[data-dev-holidays-key]'), { target: { value: ' NEW ' } });
    fireEvent.click(q('[data-dev-holidays-key-save]'));
    await waitFor(() => expect(api.saveGovApiKey).toHaveBeenCalledWith(' NEW '));
    await waitFor(() => expect(q('[data-dev-holidays-key-save]')).toBeDisabled());
  });
});

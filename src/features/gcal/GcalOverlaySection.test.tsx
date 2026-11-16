// 환경설정 '📅 구글 캘린더 겹쳐 보기' (P36-3) - 목록 받기(앱 캘린더 빼기) · 고르면 계정에 + 곧바로 받기 · 10개까지 · 빼면 받은 것 지우기 ·
// 고른 것은 목록 없이도 보임 · 받아 둔 수·로그인 끊김·찾을 수 없음 · 구글에서 바뀐 이름·색 따라가기
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useCommonSettings } from '../../app/prefs';
import { useNav } from '../../app/nav';
import { useSession } from '../../data/session';
import { monthRowKey, type OverlayEvent } from '../../domain/gcalOverlay';
import GcalOverlaySection from './GcalOverlaySection';

vi.mock('../../data/firebase', () => ({ auth: { currentUser: null }, db: {}, GOOGLE_SCOPES: [] }));
const g = vi.hoisted(() => ({
  list: [] as Array<Record<string, unknown>>,
  ensure: vi.fn(async () => {}),
  prune: vi.fn(async () => {}),
  toast: vi.fn(),
}));
vi.mock('../../data/google/calendar', () => ({ listCalendars: vi.fn(async () => g.list) }));
vi.mock('../../data/google/token', () => ({ withGoogleToken: vi.fn(async (_r: string, run: (t: string) => Promise<unknown>) => run('tok')) }));
vi.mock('../../app/toast', () => ({ showToast: g.toast, showErrorToast: g.toast }));
vi.mock('../../data/gcalOverlay', async () => {
  const { create } = await import('zustand');
  const useGcalOverlay = create(() => ({ uid: 'me', loaded: true, rows: {} as Record<string, unknown>, fetching: 0, needsLogin: false, missing: {} as Record<string, true>, error: '', lastAt: 0 }));
  return { useGcalOverlay, ensureGcalMonths: g.ensure, pruneGcalCalendars: g.prune };
});
const { useGcalOverlay } = await import('../../data/gcalOverlay');

const q = (s: string) => document.querySelector<HTMLElement>(s);
const e = (id: string, cal = 'h'): OverlayEvent => ({ id, cal, title: id, allDay: true, start: '2026-11-30', end: '2026-12-02' });
const pick = (id: string) => q(`[data-gcal-overlay-pick="${id}"]`) as HTMLInputElement | null;

beforeEach(() => {
  g.list = [
    { id: 'me@x', summary: 'me@x', summaryOverride: '내 캘린더', primary: true, backgroundColor: '#9fe1e7' },
    { id: 'work', summary: 'SP(work)' },
    { id: 'h', summary: '학년 협의', backgroundColor: '#16a765' },
  ];
  g.ensure.mockClear();
  g.prune.mockClear();
  g.toast.mockClear();
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  useNav.setState({ scope: 'day', date: '2026-11-16' });
  useCommonSettings.setState({ gcalOverlay: [] });
  useGcalOverlay.setState({ uid: 'me', rows: {}, fetching: 0, needsLogin: false, missing: {}, error: '', lastAt: 0 });
});

describe('고르기', () => {
  it('목록을 받으면 앱이 보내는 캘린더는 없고, 고르면 계정에 적고 그 캘린더만 곧바로(누른 때) 받는다', async () => {
    render(<GcalOverlaySection />);
    expect(q('[data-gcal-overlay-list]')).toBeNull();
    fireEvent.click(q('[data-gcal-overlay-load]')!);
    await waitFor(() => expect(pick('me@x')).not.toBeNull());
    expect(pick('work')).toBeNull();
    expect(q('[data-gcal-overlay-row="me@x"]')!.textContent).toContain('(기본)');

    fireEvent.click(pick('h')!);
    expect(useCommonSettings.getState().gcalOverlay).toEqual([{ id: 'h', name: '학년 협의', color: '#16a765' }]);
    expect(g.ensure).toHaveBeenCalledWith('me', ['h'], ['2026-10', '2026-11', '2026-12'], { interactive: true });
    expect(pick('h')!.checked).toBe(true);
  });

  it('빼면 계정에서 빼고 그 캘린더의 받은 것을 지운다', () => {
    useCommonSettings.setState({ gcalOverlay: [{ id: 'a', name: 'A', color: '#000000' }, { id: 'b', name: 'B', color: '#111111' }] });
    render(<GcalOverlaySection />);
    fireEvent.click(pick('a')!);
    expect(useCommonSettings.getState().gcalOverlay.map((c) => c.id)).toEqual(['b']);
    expect(g.prune).toHaveBeenCalledWith('me', ['b']);
  });

  it('10개까지 - 넘으면 안내만', async () => {
    useCommonSettings.setState({ gcalOverlay: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, color: '#000000' })) });
    render(<GcalOverlaySection />);
    fireEvent.click(q('[data-gcal-overlay-load]')!);
    await waitFor(() => expect(pick('h')).not.toBeNull());
    fireEvent.click(pick('h')!);
    expect(useCommonSettings.getState().gcalOverlay).toHaveLength(10);
    expect(g.toast).toHaveBeenCalledWith(expect.stringContaining('10개까지'));
    expect(g.ensure).not.toHaveBeenCalled();
  });

  it('목록을 받으면 고른 것의 이름·색이 구글에서 바뀐 대로 따라간다', async () => {
    useCommonSettings.setState({ gcalOverlay: [{ id: 'h', name: '옛 이름', color: '#000000' }] });
    render(<GcalOverlaySection />);
    expect(q('[data-gcal-overlay-row="h"]')!.textContent).toContain('옛 이름');
    fireEvent.click(q('[data-gcal-overlay-load]')!);
    await waitFor(() => expect(useCommonSettings.getState().gcalOverlay).toEqual([{ id: 'h', name: '학년 협의', color: '#16a765' }]));
  });
});

describe('받은 것', () => {
  it('고른 것은 목록 없이도 보이고, 받아 둔 수(여러 달은 하나)·다시 받기(누른 때 + 모두)', () => {
    useCommonSettings.setState({ gcalOverlay: [{ id: 'h', name: '학년 협의', color: '#16a765' }] });
    const ev = e('e1');
    useGcalOverlay.setState({
      rows: { [monthRowKey('h', '2026-11')]: { events: [ev, e('e2')], at: 1 }, [monthRowKey('h', '2026-12')]: { events: [ev], at: 1 }, [monthRowKey('gone', '2026-11')]: { events: [e('x', 'gone')], at: 1 } },
      lastAt: new Date(2026, 10, 16, 16, 5).getTime(),
    });
    render(<GcalOverlaySection />);
    expect(pick('h')!.checked).toBe(true);
    expect(q('[data-gcal-overlay-count]')!.getAttribute('data-gcal-overlay-count')).toBe('2');
    fireEvent.click(q('[data-gcal-overlay-refresh]')!);
    expect(g.ensure).toHaveBeenCalledWith('me', ['h'], ['2026-10', '2026-11', '2026-12'], { interactive: true, force: true });
  });

  it('메모 화면에서 열어도 그달 ±1을 다시 받는다', () => {
    useNav.setState({ scope: 'memo' });
    useCommonSettings.setState({ gcalOverlay: [{ id: 'h', name: 'H', color: '#000000' }] });
    render(<GcalOverlaySection />);
    fireEvent.click(q('[data-gcal-overlay-refresh]')!);
    expect(g.ensure).toHaveBeenCalledWith('me', ['h'], ['2026-10', '2026-11', '2026-12'], { interactive: true, force: true });
  });

  it('로그인이 끊기면 안내, 구글에서 찾지 못한 캘린더는 표시 - 고른 것은 그대로', () => {
    useCommonSettings.setState({ gcalOverlay: [{ id: 'h', name: 'H', color: '#000000' }] });
    render(<GcalOverlaySection />);
    expect(q('[data-gcal-overlay-login]')).toBeNull();
    act(() => useGcalOverlay.setState({ needsLogin: true, missing: { h: true } }));
    expect(q('[data-gcal-overlay-login]')).not.toBeNull();
    expect(q('[data-gcal-overlay-missing="h"]')).not.toBeNull();
    expect(pick('h')!.checked).toBe(true);
  });

  it('고른 것이 없으면 받은 것 줄이 없다', () => {
    render(<GcalOverlaySection />);
    expect(q('[data-gcal-overlay-status]')).toBeNull();
  });
});

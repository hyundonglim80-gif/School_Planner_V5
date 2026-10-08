// 여러 개 고르기 - 카드 Ctrl·Shift·길게 누르기로 시작, 고르는 동안 누르기 = 고르기·풀기, 아래 동작 줄(완료·라벨·옮기기·지우기 - 한 묶음·되돌리기), ESC·✕로 끝
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { handleAppKeyDown, runShortcut } from '../../app/keys';
import { useCommonSettings } from '../../app/prefs';
import { useWindows } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { WriteOp } from '../../data/repo';
import DayEvents from '../day/DayEvents';
import { endMulti, useMulti } from './multi';
import MultiSelectBar from './MultiSelectBar';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const { undoOfAll } = await import('../../data/repo/ops');
  return {
    ...real,
    batch: vi.fn(async (ops: WriteOp[]) => {
      written.batches.push(ops);
      return undoOfAll(ops);
    }),
  };
});

const SID = 'u_me';
const DAY = '2026-10-08';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const ev = (id: string, order: string, more: Record<string, unknown> = {}) => [id, { ...base, kind: 'event', date: DAY, text: `일정 ${id}`, labelIds: [], order, ...more }] as const;
const items = new Map<string, Record<string, unknown>>([ev('a', 'a0'), ev('b', 'a1'), ev('c', 'a2'), ev('d', 'a3')]);
const labels = new Map<string, Record<string, unknown>>([['L', { ...base, kind: 'event', name: '회의', color: 'blue', parentId: null, order: 'a0' }]]);

const q = (s: string) => document.querySelector<HTMLElement>(s);
const picked = () => [...document.querySelectorAll<HTMLElement>('[data-event-picked="1"]')].map((e) => e.dataset.eventCard);
const card = (id: string) => q(`[data-event-card="${id}"]`)!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
  useCommonSettings.setState({ forwardDays: 14 });
  resetMirrorStore();
  endMulti();
  written.batches = [];
  useWindows.setState({ windows: [] });
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  for (const [coll, d] of [
    ['labels', labels],
    ['items', items],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, d);
    setStatus(SID, coll, 'live');
  }
});
afterEach(() => vi.useRealTimers());

const view = () =>
  render(
    <>
      <DayEvents date={DAY} />
      <MultiSelectBar />
    </>,
  );

describe('여러 개 고르기', () => {
  it('그냥 누르기 = 수정 칸 (고르지 않는다), Ctrl+누르기 = 시작, 그 뒤 누르기 = 고르기·풀기, Shift = 범위', () => {
    view();
    expect(q('[data-multi-bar]')).toBeNull();
    fireEvent.click(card('a'), { ctrlKey: true });
    expect(q('[data-multi-bar]')?.dataset.multiBar).toBe('1');
    fireEvent.click(card('d'), { shiftKey: true });
    expect(picked()).toEqual(['a', 'b', 'c', 'd']);
    fireEvent.click(card('b'));
    expect(picked()).toEqual(['a', 'c', 'd']);
    expect(q('[data-multi-count]')?.textContent).toBe('3');
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('⋮ 여러 개 고르기로 켜고 ✕·ESC로 끝낸다', () => {
    view();
    act(() => void runShortcut('multiSelect'));
    expect(q('[data-multi-bar]')?.dataset.multiBar).toBe('0');
    expect(q('[data-multi-complete]')).toBeDisabled();
    fireEvent.click(card('a'));
    fireEvent.click(q('[data-multi-end]')!);
    expect(useMulti.getState().on).toBe(false);
    fireEvent.click(card('a'), { ctrlKey: true });
    act(() => handleAppKeyDown(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(useMulti.getState().on).toBe(false);
    expect(picked()).toEqual([]);
  });

  it('휴대폰 길게 누르기 = 시작 (손을 뗀 click은 넘긴다)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 12));
    view();
    fireEvent.pointerDown(card('b'), { pointerType: 'touch', clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(card('b'), { pointerType: 'touch' });
    fireEvent.click(card('b'));
    expect(picked()).toEqual(['b']);
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('완료 = 고른 것 한 묶음 + 안내의 되돌리기, 끝나면 고르기도 끝', async () => {
    view();
    fireEvent.click(card('a'), { ctrlKey: true });
    fireEvent.click(card('c'));
    await act(async () => fireEvent.click(q('[data-multi-complete]')!));
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0].map((o) => o.at.id)).toEqual(['a', 'c']);
    expect(q('[data-toast]')?.textContent).toContain('일정 2건을 완료로 표시했습니다');
    expect(useMulti.getState().on).toBe(false);
  });

  it('라벨 = 하나로 바꾸기', async () => {
    view();
    fireEvent.click(card('a'), { ctrlKey: true });
    fireEvent.click(q('[data-multi-label-open]')!);
    await act(async () => fireEvent.click(q('[data-multi-label="L"]')!));
    expect(written.batches[0][0]).toMatchObject({ at: { id: 'a' }, changes: { labelIds: ['L'] } });
  });

  it('옮기기 = 처음엔 내일, 모두 그 날로 (한 묶음)', async () => {
    view();
    fireEvent.click(card('a'), { ctrlKey: true });
    fireEvent.click(card('b'));
    fireEvent.click(q('[data-multi-move-open]')!);
    expect((q('[data-multi-move-date]') as HTMLInputElement).value).toBe('2026-10-09');
    await act(async () => fireEvent.click(q('[data-multi-move-go]')!));
    expect(written.batches[0].map((o) => (o as unknown as { changes: { date: string } }).changes.date)).toEqual(['2026-10-09', '2026-10-09']);
    expect(q('[data-toast]')?.textContent).toContain('일정 2건을 10/9(금)로 옮겼습니다');
  });

  it('지우기 = 묻지 않고 지운 표시 + 되돌리기', async () => {
    view();
    fireEvent.click(card('d'), { ctrlKey: true });
    await act(async () => fireEvent.click(q('[data-multi-delete]')!));
    expect(written.batches[0]).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'd' } }]);
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
  });
});

// 구글 캘린더 자동 보내기 - 문 (P55-1): 큐는 늘 듣고(머리줄 수), 보내는 몫(auto)은 보낼 것이 있는 공간에서만 받아 세운다 -
//   '구글 캘린더'를 켠 일정 라벨 · 일정 칸에서 따로 켠 일정 · 큐가 차 있음. 한 번 서면 그 공간에서는 멈추지 않는다(라벨을 끈 뒤 지울 것을 보내야 한다).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSession } from '../../data/session';
import { collKey, useMirror } from '../../data/mirror/store';
import type { GcalQueueEntry } from '../../data/gcalQueue';

const g = vi.hoisted(() => ({
  queueCb: null as ((entries: GcalQueueEntry[]) => void) | null,
  run: vi.fn(),
  stop: vi.fn(),
  ready: vi.fn(() => () => {}),
  send: vi.fn(async () => {}),
}));
vi.mock('../../data/firebase', () => ({ auth: { currentUser: null }, db: {}, GOOGLE_SCOPES: [] }));
vi.mock('../../data/gcalQueue', () => ({
  watchGcalQueue: (_sid: string, cb: (entries: GcalQueueEntry[]) => void) => {
    g.queueCb = cb;
    return () => {
      g.queueCb = null;
    };
  },
}));
vi.mock('./auto', () => ({ runGcalAuto: g.run, stopGcalAuto: g.stop, gcalReadyToday: g.ready, sendGcalNow: g.send }));

const { useGcalAuto, sendGcalNow } = await import('./useGcalAuto');
const { useGcal } = await import('./gcalStore');

/** 한 번 세운 공간은 이 탭에서 멈추지 않는다 - 시험마다 다른 계정 */
let SID = '';
let n = 0;
const put = (coll: 'labels' | 'items', docs: Record<string, object>) =>
  useMirror.setState((s) => ({ colls: { ...s.colls, [collKey(SID, coll)]: { docs: docs as never, status: 'live' } } }));
const label = (gcal: boolean) => ({ l1: { id: 'l1', kind: 'event', name: '업무', props: gcal ? { gcal: true } : {} } });
const event = (props?: object) => ({ e1: { id: 'e1', kind: 'event', date: '2026-11-22', text: '회의', labelIds: [], ...(props ? { props } : {}) } });

beforeEach(() => {
  vi.clearAllMocks();
  const uid = `me${++n}`;
  SID = `u_${uid}`;
  useSession.setState({ loading: false, user: { uid, email: '', displayName: '', photoURL: '' } });
});
afterEach(() => {
  useMirror.setState({ colls: {}, persisted: null });
});

describe('useGcalAuto', () => {
  it('보낼 것이 없는 공간은 큐만 듣고 보내는 몫을 받지 않는다', async () => {
    put('labels', label(false));
    put('items', event());
    const { unmount } = renderHook(() => useGcalAuto());
    expect(g.queueCb).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(g.run).not.toHaveBeenCalled();
    unmount();
  });

  it("'구글 캘린더'를 켠 라벨이 있으면 세우고, 사본·라벨을 받은 뒤 이월·쌓인 것을 맞춘다", async () => {
    put('labels', label(true));
    put('items', event());
    const { unmount } = renderHook(() => useGcalAuto());
    await waitFor(() => expect(g.run).toHaveBeenCalledWith(SID));
    await waitFor(() => expect(g.ready).toHaveBeenCalledWith(SID));
    unmount();
    expect(g.stop).toHaveBeenCalledWith(SID);
  });

  it('일정 칸에서 따로 켠 일정이 있어도 세운다 (라벨은 꺼져 있어도)', async () => {
    put('labels', label(false));
    put('items', event({ gcal: true }));
    const { unmount } = renderHook(() => useGcalAuto());
    await waitFor(() => expect(g.run).toHaveBeenCalledWith(SID));
    unmount();
  });

  it('큐가 차면 머리줄 수가 서고 보내는 몫을 세운다 - 그 뒤 라벨·큐가 비어도 멈추지 않는다', async () => {
    put('labels', label(false));
    put('items', event());
    const { unmount } = renderHook(() => useGcalAuto());
    await new Promise((r) => setTimeout(r, 20));
    expect(g.run).not.toHaveBeenCalled();
    act(() => g.queueCb?.([{ id: 'e1', at: 1, fails: 0 }]));
    expect(useGcal.getState().pending).toBe(1);
    await waitFor(() => expect(g.run).toHaveBeenCalledWith(SID));
    act(() => g.queueCb?.([]));
    expect(useGcal.getState().pending).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(g.stop).not.toHaveBeenCalled();
    // 머리줄 단추는 받은 몫의 보내기를 그 자리에서 부른다
    sendGcalNow();
    expect(g.send).toHaveBeenCalledTimes(1);
    unmount();
    expect(useGcal.getState().pending).toBe(0);
  });
});

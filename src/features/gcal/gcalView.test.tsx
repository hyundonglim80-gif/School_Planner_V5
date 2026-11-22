// 구글 캘린더 겹쳐 그리기 - 화면이 쓰는 목록 (P36-4): 고른 캘린더 것만 · 이 기기에서 끄면 없음 · 인쇄 창 안은 없음 · 다른 계정이 담은 것은 없음 · 재료가 같으면 같은 배열
//   · 고르는 셈(gcalShownCalc)은 받는 몫과 함께 온다 - 오기 전에는 없음 (P55-1)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { useSession } from '../../data/session';
import { monthRowKey, type OverlayEvent } from '../../domain/gcalOverlay';
import { useGcalOverlay } from '../../data/gcalOverlayStore';
import { GcalOffContext, setGcalShown, useGcalCalc, useGcalShown } from './gcalView';
import { gcalShownBetween } from './gcalShownCalc';

vi.mock('../../data/firebase', () => ({ auth: { currentUser: null }, db: {}, GOOGLE_SCOPES: [] }));

const e = (id: string, cal: string, start: string, end: string): OverlayEvent => ({ id, cal, title: id, allDay: start.length === 10, start, end });

beforeEach(() => {
  useGcalCalc.setState({ calc: gcalShownBetween });
  setGcalShown(true);
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  useCommonSettings.setState({ gcalOverlay: [{ id: 'c1', name: '학교', color: '#0b8043' }] });
  useGcalOverlay.setState({
    uid: 'me',
    rows: {
      [monthRowKey('c1', '2026-11')]: { events: [e('a', 'c1', '2026-11-16', '2026-11-17'), e('b', 'c1', '2026-11-20T09:00', '2026-11-20T10:00')], at: 1 },
      [monthRowKey('c2', '2026-11')]: { events: [e('x', 'c2', '2026-11-16', '2026-11-17')], at: 1 },
    },
  });
});

describe('useGcalShown', () => {
  it('고른 캘린더의 그 날들 것만 - 캘린더 이름·색이 붙는다, 재료가 같으면 같은 배열', () => {
    const { result, rerender } = renderHook(() => useGcalShown('2026-11-16', '2026-11-18'));
    expect(result.current.map((s) => [s.ev.id, s.cal.name])).toEqual([['a', '학교']]);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('이 기기에서 끄면 없고, 켜면 다시', () => {
    const { result } = renderHook(() => useGcalShown('2026-11-01', '2026-11-30'));
    expect(result.current).toHaveLength(2);
    act(() => setGcalShown(false));
    expect(result.current).toHaveLength(0);
    act(() => setGcalShown(true));
    expect(result.current).toHaveLength(2);
  });

  it('인쇄 창(GcalOffContext) 안에서는 없다', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <GcalOffContext.Provider value>{children}</GcalOffContext.Provider>;
    const { result } = renderHook(() => useGcalShown('2026-11-01', '2026-11-30'), { wrapper });
    expect(result.current).toHaveLength(0);
  });

  it('고른 캘린더가 없거나, 담긴 것이 다른 계정 것이면 없다', () => {
    const { result } = renderHook(() => useGcalShown('2026-11-01', '2026-11-30'));
    act(() => useGcalOverlay.setState({ uid: 'other' }));
    expect(result.current).toHaveLength(0);
    act(() => useGcalOverlay.setState({ uid: 'me' }));
    expect(result.current).toHaveLength(2);
    act(() => useCommonSettings.setState({ gcalOverlay: [] }));
    expect(result.current).toHaveLength(0);
  });

  it('고르는 셈이 오기 전에는 없고, 오면 그린다 (P55-1 - 받는 몫과 함께 온다)', () => {
    useGcalCalc.setState({ calc: null });
    const { result } = renderHook(() => useGcalShown('2026-11-01', '2026-11-30'));
    expect(result.current).toHaveLength(0);
    act(() => useGcalCalc.setState({ calc: gcalShownBetween }));
    expect(result.current).toHaveLength(2);
  });
});

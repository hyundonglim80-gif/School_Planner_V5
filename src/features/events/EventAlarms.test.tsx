// 앱 안 일정 알림 - 3초 뒤·20초마다 사본을 보고 울린다, 울린 일정에 alarmDone(문서 하나), 이 탭에서 한 번만, 소리 3번·🔇·확인
// + ＋ 새로(newEvent) = 지금 보는 날의 새 일정 칸
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { runShortcut } from '../../app/keys';
import { setCommonSetting } from '../../app/prefs';
import { setDate, setScope } from '../../app/nav';
import '../../app/windowList';
import { useWindows } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { WriteOp } from '../../data/repo';
import EventAlarms, { ALARM_CHECK_MS, ALARM_FIRST_CHECK_MS } from './EventAlarms';
import { openNewEvent, useEventShortcuts } from './shortcuts';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  return {
    ...real,
    writeOps: vi.fn(async (ops: WriteOp[]) => {
      written.batches.push(ops);
    }),
  };
});

const SID = 'u_me';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', labelIds: [], order: 'a0' };
const NOW = new Date(2026, 9, 8, 14, 30, 0);
const q = (s: string) => document.querySelector<HTMLElement>(s);
const sounds = () => (window as unknown as { __spAlarmSoundCount?: number }).__spAlarmSoundCount ?? 0;

function seed(items: Record<string, Record<string, unknown>>) {
  trackColl(SID, 'items');
  applyBase(SID, 'items', new Map(Object.entries(items)));
  setStatus(SID, 'items', 'live');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetMirrorStore();
  written.batches = [];
  (window as unknown as { __spAlarmSoundCount?: number }).__spAlarmSoundCount = 0;
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});
afterEach(() => {
  vi.useRealTimers();
  useWindows.setState({ windows: [] });
  setCommonSetting('alarmSound', 10);
});

describe('앱 안 일정 알림', () => {
  it('3초 뒤에 보고 울린다 - 지난 1시간 안·끝내지 않음·아직 안 울림만, 울린 일정에 alarmDone', async () => {
    seed({
      a: { ...base, kind: 'event', date: '2026-10-08', text: '학부모 상담', time: '14:25' },
      b: { ...base, kind: 'event', date: '2026-10-08', text: '끝낸 것', time: '14:20', done: true },
      c: { ...base, kind: 'event', date: '2026-10-08', text: '다른 기기가 울림', time: '14:20', alarmDone: true },
      d: { ...base, kind: 'event', date: '2026-10-08', text: '나중', time: '15:00' },
    });
    render(<EventAlarms />);
    expect(q('[data-alarm-popup]')).toBeNull();
    await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
    expect([...document.querySelectorAll<HTMLElement>('[data-alarm-item]')].map((e) => e.dataset.alarmItem)).toEqual(['a']);
    expect(q('[data-alarm-popup]')?.textContent).toContain('학부모 상담');
    expect(written.batches).toEqual([[{ type: 'patch', at: { sid: SID, coll: 'items', id: 'a' }, changes: { alarmDone: true }, before: expect.anything() }]]);
    expect(sounds()).toBe(1);
  });

  it('같은 일정은 이 탭에서 한 번만, 때가 되면 다음 일정이 더해진다', async () => {
    seed({ a: { ...base, kind: 'event', date: '2026-10-08', text: '하나', time: '14:30' }, b: { ...base, kind: 'event', date: '2026-10-08', text: '둘', time: '14:31' } });
    render(<EventAlarms />);
    await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
    expect(written.batches).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(ALARM_CHECK_MS * 3));
    expect([...document.querySelectorAll<HTMLElement>('[data-alarm-item]')].map((e) => e.dataset.alarmItem)).toEqual(['a', 'b']);
    expect(written.batches).toHaveLength(2);
  });

  it('소리는 3초마다 3번, 🔇는 소리만 끄고 창은 둔다, 확인은 창을 닫는다', async () => {
    seed({ a: { ...base, kind: 'event', date: '2026-10-08', text: '하나', time: '14:30' } });
    render(<EventAlarms />);
    await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
    await act(async () => vi.advanceTimersByTime(3000));
    expect(sounds()).toBe(2);
    fireEvent.click(q('[data-alarm-mute]')!);
    await act(async () => vi.advanceTimersByTime(9000));
    expect(sounds()).toBe(2);
    expect(q('[data-alarm-popup]')).not.toBeNull();
    fireEvent.click(q('[data-alarm-dismiss]')!);
    expect(q('[data-alarm-popup]')).toBeNull();
  });

  it("환경설정 '알림 소리' 길이만큼 (P10-1): 기본 10초 = 3번 · 한 번 · 확인할 때까지", async () => {
    const ring = async (sec: number, waitMs: number) => {
      setCommonSetting('alarmSound', sec);
      resetMirrorStore();
      (window as unknown as { __spAlarmSoundCount?: number }).__spAlarmSoundCount = 0;
      seed({ [`s${sec}`]: { ...base, kind: 'event', date: '2026-10-08', text: '소리', time: '14:30' } });
      const r = render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      await act(async () => vi.advanceTimersByTime(waitMs));
      const n = sounds();
      r.unmount();
      return n;
    };
    expect(await ring(10, 30_000)).toBe(3);
    expect(await ring(0, 30_000)).toBe(1);
    expect(await ring(30, 60_000)).toBe(10);
    // 확인할 때까지 = 3초마다 끝없이 (5분 뒤에도)
    expect(await ring(-1, 300_000)).toBe(101);
  });

  // 10-14 사용자 보고 '알림은 화면으로 나오지만 소리가 없다' - 이 탭을 아직 누르지 않아 소리가 막히면 OS 알림(기기 소리)도
  describe('OS 알림 (알림 허용)', () => {
    const shown = vi.fn();
    beforeEach(() => {
      shown.mockClear();
      vi.stubGlobal('Notification', { permission: 'granted' });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistration: async () => ({ scope: '/', showNotification: shown }), addEventListener: () => {}, removeEventListener: () => {} },
      });
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, 'serviceWorker');
    });
    const ring = async () => {
      seed({ a: { ...base, kind: 'event', date: '2026-10-08', text: '하나', time: '14:30' } });
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      await act(async () => vi.advanceTimersByTime(400)); // soundAllowed가 깨워 보는 0.3초
    };

    it('소리가 막혔으면(소리 장치 없음·깨우지 못함) 화면을 보고 있어도 서비스 워커로 OS 알림 - 같은 tag', async () => {
      await ring();
      expect(q('[data-alarm-popup]')).not.toBeNull();
      expect(shown).toHaveBeenCalledWith('⏰ 일정 알림', expect.objectContaining({ body: '하나', tag: 'sp5-alarm-a' }));
    });

    it('소리를 낼 수 있고 화면을 보고 있으면 OS 알림은 띄우지 않는다', async () => {
      // 소리 장치가 돈다 - 음을 만드는 부름은 무엇이든 받는 빈 것
      const any: object = new Proxy(() => any, { get: (_, k) => (k === 'state' ? 'running' : k === 'currentTime' ? 0 : any) });
      vi.stubGlobal('AudioContext', function AudioContext() {
        return any;
      });
      await ring();
      expect(q('[data-alarm-popup]')).not.toBeNull();
      expect(shown).not.toHaveBeenCalled();
    });
  });
});

describe('＋ 새로 → 새 일정', () => {
  it('지금 보는 날의 새 일정 칸 (메모 화면이면 오늘)', () => {
    vi.useRealTimers();
    setScope('week');
    setDate('2026-10-14');
    openNewEvent();
    expect(useWindows.getState().windows.map((w) => [w.id, w.params])).toEqual([['event', { sid: SID, date: '2026-10-14' }]]);
    useWindows.setState({ windows: [] });
    // 메모 화면이면 오늘 - 오늘을 고정한다(고정하지 않으면 오늘이 10-14인 날 깨졌다 - CLAUDE.md 2장)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0));
    setScope('memo');
    openNewEvent();
    expect((useWindows.getState().windows[0].params as { date: string }).date).toBe('2026-10-20');
    vi.useRealTimers();
  });

  it('useEventShortcuts가 단축키 newEvent(＋ 새로)에 건다', () => {
    vi.useRealTimers();
    setScope('day');
    setDate('2026-10-08');
    function Hook() {
      useEventShortcuts();
      return null;
    }
    const { unmount } = render(<Hook />);
    expect(runShortcut('newEvent')).toBe(true);
    expect(useWindows.getState().windows.map((w) => w.params)).toEqual([{ sid: SID, date: '2026-10-08' }]);
    unmount();
  });
});

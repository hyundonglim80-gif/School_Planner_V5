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
import { setSpaceChoice, useMySpaces, useSpaceChoice } from '../../data/spaceChoice';
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

function seed(items: Record<string, Record<string, unknown>>, sid = SID) {
  trackColl(sid, 'items');
  applyBase(sid, 'items', new Map(Object.entries(items).map(([id, d]) => [id, { id, ...d }])));
  setStatus(sid, 'items', 'live');
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
  useMySpaces.setState({ groups: [], loaded: false });
  useSpaceChoice.setState({ uid: null, sid: null, known: [], names: {} });
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

  // P22-3: 푸시를 켜지 않은 기기는 앱 안 알림뿐인데 지금 보는 공간 것만 울렸다
  describe('다른 공간 일정', () => {
    const GROUP = 'g_x';
    const items = (extra: Record<string, unknown>) => ({ ...base, kind: 'event', date: '2026-10-08', text: '그룹 회의', time: '14:25', ...extra });
    const shownIds = () => [...document.querySelectorAll<HTMLElement>('[data-alarm-item]')].map((e) => e.dataset.alarmItem);
    beforeEach(() => useMySpaces.setState({ groups: [{ id: GROUP, name: '학년', ownerId: 'me', members: { me: 'owner' } }], loaded: true }));

    it('개인 공간을 보고 있어도 내가 쓴 그룹 일정이 울리고, alarmDone은 그 공간 문서에', async () => {
      seed({ g1: items({}) }, GROUP);
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      expect(shownIds()).toEqual(['g1']);
      expect(written.batches).toEqual([[{ type: 'patch', at: { sid: GROUP, coll: 'items', id: 'g1' }, changes: { alarmDone: true }, before: expect.anything() }]]);
    });

    it('그룹을 보고 있어도 개인 일정이 울린다', async () => {
      setSpaceChoice('me', GROUP);
      seed({ p1: items({ text: '개인 약속' }) });
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      expect(shownIds()).toEqual(['p1']);
    });

    it('남이 쓴 그룹 일정은 그 공간을 보고 있어도 울리지 않고 alarmDone도 적지 않는다 (서버 푸시와 같다)', async () => {
      setSpaceChoice('me', GROUP);
      seed({ g1: items({ authorId: 'other' }) }, GROUP);
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      expect(q('[data-alarm-popup]')).toBeNull();
      expect(written.batches).toEqual([]);
    });

    it('쓴 사람이 없는 옛 그룹 일정은 구성원 모두 울린다', async () => {
      seed({ g1: items({ authorId: undefined }) }, GROUP);
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      expect(shownIds()).toEqual(['g1']);
    });

    it('목록을 받기 전이면 기억한 그룹의 일정도 본다 (끊긴 채 연 앱)', async () => {
      useMySpaces.setState({ groups: [{ id: GROUP, name: '학년', ownerId: '', members: {} }], loaded: false });
      seed({ g1: items({}) }, GROUP);
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      expect(shownIds()).toEqual(['g1']);
    });

    it('두 공간의 알림은 시각 차례로', async () => {
      seed({ p1: items({ time: '14:28' }) });
      seed({ g1: items({ time: '14:20' }) }, GROUP);
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      expect(shownIds()).toEqual(['g1', 'p1']);
    });

    it('공간을 바꿔도 이 탭에서 울린 일정이 다시 울리지 않는다', async () => {
      seed({ g1: items({}) }, GROUP);
      render(<EventAlarms />);
      await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
      fireEvent.click(q('[data-alarm-dismiss]')!);
      await act(async () => setSpaceChoice('me', GROUP));
      await act(async () => vi.advanceTimersByTime(ALARM_CHECK_MS));
      expect(q('[data-alarm-popup]')).toBeNull();
      expect(written.batches).toHaveLength(1);
    });

    describe('서버 푸시 (서비스 워커가 넘겨 준다)', () => {
      let listener: ((e: MessageEvent) => void) | null = null;
      const push = (id: string, sid: string) =>
        act(async () => listener?.({ data: { type: 'sp5-event-alarm', alarm: { id, sid, content: '그룹 회의', time: '2026-10-08 14:25' } } } as MessageEvent));
      beforeEach(() => {
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            getRegistration: async () => undefined,
            addEventListener: (_: string, fn: (e: MessageEvent) => void) => (listener = fn),
            removeEventListener: () => (listener = null),
          },
        });
      });
      afterEach(() => Reflect.deleteProperty(navigator, 'serviceWorker'));

      it('다른 공간 일정의 푸시를 먼저 받으면 그 문서에 alarmDone, 앱이 보고 두 번 울리지 않는다', async () => {
        seed({ g1: items({}) }, GROUP);
        render(<EventAlarms />);
        await push('g1', GROUP);
        expect(shownIds()).toEqual(['g1']);
        expect(written.batches).toEqual([[{ type: 'patch', at: { sid: GROUP, coll: 'items', id: 'g1' }, changes: { alarmDone: true }, before: expect.anything() }]]);
        await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
        expect(shownIds()).toEqual(['g1']);
        expect(written.batches).toHaveLength(1);
      });

      it('앱이 먼저 울렸으면 뒤늦은 푸시는 다시 울리지 않는다', async () => {
        seed({ g1: items({}) }, GROUP);
        render(<EventAlarms />);
        await act(async () => vi.advanceTimersByTime(ALARM_FIRST_CHECK_MS));
        fireEvent.click(q('[data-alarm-dismiss]')!);
        await push('g1', GROUP);
        expect(q('[data-alarm-popup]')).toBeNull();
        expect(written.batches).toHaveLength(1);
      });
    });
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
      expect(shown).toHaveBeenCalledWith('⏰ 일정 알림', expect.objectContaining({ body: '하나', tag: 'sp5-alarm-a', renotify: true }));
      // 10-16 '알림은 뜨는데 알람이 안 울림' - 막혔으면 알림 창에 '🔔 소리 켜기' (누르면 바로 한 번 울리고 사라진다)
      const unmute = q('[data-alarm-unmute]') as HTMLButtonElement | null;
      expect(unmute).not.toBeNull();
      const w = window as unknown as { __spAlarmSoundCount?: number };
      const before = w.__spAlarmSoundCount ?? 0;
      await act(async () => unmute!.click());
      expect(w.__spAlarmSoundCount).toBe(before + 1);
      expect(q('[data-alarm-unmute]')).toBeNull();
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
      expect(q('[data-alarm-unmute]')).toBeNull();
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

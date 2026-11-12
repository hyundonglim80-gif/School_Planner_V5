import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { startSettingsSync, type SettingsData, type SettingsPort } from './settingsSync';

vi.mock('./firebase', () => ({ db: {} }));

// 서버 흉내: 문서를 내보내고(push), 적은 것을 모은다(saved)
function fakePort() {
  let listener: ((d: SettingsData | null, fromCache: boolean) => void) | null = null;
  const saved: SettingsData[] = [];
  const port: SettingsPort = {
    watch: (fn) => {
      listener = fn;
      return () => (listener = null);
    },
    save: async (d) => {
      saved.push(d);
    },
  };
  return { port, saved, push: (d: SettingsData | null, fromCache = false) => listener?.(d, fromCache) };
}

// 이 기기 값: 기본값 size 'md' - 문서에는 다른 것만
const useStore = create<{ size: string }>(() => ({ size: 'md' }));
const binding = {
  local: () => (useStore.getState().size === 'md' ? {} : { size: useStore.getState().size }),
  apply: (d: SettingsData) => useStore.setState({ size: typeof d.size === 'string' ? d.size : 'md' }),
  subscribe: (fn: () => void) => useStore.subscribe(fn),
};

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState({ size: 'md' });
});
afterEach(() => vi.useRealTimers());

describe('설정 맞추기', () => {
  it('서버 값을 받기 전에는 바꿔도 올리지 않는다', () => {
    const { port, saved } = fakePort();
    const stop = startSettingsSync(port, binding);
    useStore.setState({ size: 'lg' });
    vi.advanceTimersByTime(2000);
    expect(saved).toEqual([]);
    stop();
  });

  it('서버 값이 오면 입히고, 그 값을 다시 올리지 않는다', () => {
    const { port, saved, push } = fakePort();
    const stop = startSettingsSync(port, binding);
    push({ size: 'sm', updatedAt: 1 });
    expect(useStore.getState().size).toBe('sm');
    vi.advanceTimersByTime(2000);
    expect(saved).toEqual([]);
    stop();
  });

  it('없는 칸은 기본값으로 돌아간다 (다른 기기에서 기본값으로 되돌림)', () => {
    const { port, push } = fakePort();
    useStore.setState({ size: 'lg' });
    const stop = startSettingsSync(port, binding);
    push({ updatedAt: 1 });
    expect(useStore.getState().size).toBe('md');
    stop();
  });

  it('바꾸면 1초 뒤 한 번만 적는다 (그사이 여러 번 바꿔도)', () => {
    const { port, saved, push } = fakePort();
    const stop = startSettingsSync(port, binding);
    push({});
    useStore.setState({ size: 'lg' });
    vi.advanceTimersByTime(500);
    useStore.setState({ size: 'xl' });
    vi.advanceTimersByTime(999);
    expect(saved).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(saved).toEqual([{ size: 'xl' }]);
    stop();
  });

  it('기본값으로 되돌리면 빈 문서를 적는다 (merge가 아니라 통째로)', () => {
    const { port, saved, push } = fakePort();
    const stop = startSettingsSync(port, binding);
    push({ size: 'lg' });
    useStore.setState({ size: 'md' });
    vi.advanceTimersByTime(1000);
    expect(saved).toEqual([{}]);
    stop();
  });

  it('적기를 기다리는 동안 온 서버 값은 입히지 않는다 (이 기기에서 방금 바꾼 것이 더 새것)', () => {
    const { port, saved, push } = fakePort();
    const stop = startSettingsSync(port, binding);
    push({});
    useStore.setState({ size: 'lg' });
    push({ size: 'sm' });
    expect(useStore.getState().size).toBe('lg');
    vi.advanceTimersByTime(1000);
    expect(saved).toEqual([{ size: 'lg' }]);
    stop();
  });

  it('문서가 없으면: 이 기기 값이 기본값이면 만들지 않고, 다르면 올린다', () => {
    const a = fakePort();
    let stop = startSettingsSync(a.port, binding);
    a.push(null);
    expect(a.saved).toEqual([]);
    stop();

    useStore.setState({ size: 'lg' });
    const b = fakePort();
    stop = startSettingsSync(b.port, binding);
    b.push(null);
    expect(b.saved).toEqual([{ size: 'lg' }]);
    stop();
  });

  it('연결 없이 캐시에서 온 "문서 없음"은 믿지 않는다', () => {
    const { port, saved, push } = fakePort();
    useStore.setState({ size: 'lg' });
    const stop = startSettingsSync(port, binding);
    push(null, true);
    useStore.setState({ size: 'xl' });
    vi.advanceTimersByTime(2000);
    expect(saved).toEqual([]);
    // 서버 값이 오면 그것을 따른다
    push({ size: 'sm' });
    expect(useStore.getState().size).toBe('sm');
    stop();
  });

  it('끊을 때 기다리던 값은 바로 적는다', () => {
    const { port, saved, push } = fakePort();
    const stop = startSettingsSync(port, binding);
    push({});
    useStore.setState({ size: 'lg' });
    stop();
    expect(saved).toEqual([{ size: 'lg' }]);
  });
});

describe('새 사용자 처음 설정 (P33-3 seed)', () => {
  // 두 칸짜리 이음: size(기본 md)·mode(기본 a) - 문서에는 다른 것만
  const useTwo = create<{ size: string; mode: string }>(() => ({ size: 'md', mode: 'a' }));
  function seedBinding(seed: () => Promise<SettingsData | null>) {
    const calls = { seed: 0, seeded: 0, ready: 0 };
    return {
      calls,
      b: {
        local: () => {
          const s = useTwo.getState();
          return { ...(s.size === 'md' ? {} : { size: s.size }), ...(s.mode === 'a' ? {} : { mode: s.mode }) };
        },
        apply: (d: SettingsData) => useTwo.setState({ size: typeof d.size === 'string' ? d.size : 'md', mode: typeof d.mode === 'string' ? d.mode : 'a' }),
        subscribe: (fn: () => void) => useTwo.subscribe(fn),
        ready: () => void calls.ready++,
        seed: () => {
          calls.seed++;
          return seed();
        },
        seeded: () => void calls.seeded++,
      },
    };
  }
  beforeEach(() => useTwo.setState({ size: 'md', mode: 'a' }));

  it('문서가 없으면 처음 설정을 깔고 이 기기 값(기본과 다른 것)을 얹어 올린다', async () => {
    const { port, saved, push } = fakePort();
    useTwo.setState({ mode: 'b' });
    const { b, calls } = seedBinding(async () => ({ size: 'xl', mode: 'c' }));
    const stop = startSettingsSync(port, b);
    push(null);
    expect(calls).toMatchObject({ seed: 1, ready: 0 });
    await vi.runAllTimersAsync();
    expect(useTwo.getState()).toEqual({ size: 'xl', mode: 'b' });
    expect(calls).toMatchObject({ seeded: 1, ready: 1 });
    expect(saved).toEqual([{ size: 'xl', mode: 'b' }]);
    // 다시 '문서 없음'이 와도 한 번만
    push(null);
    await vi.runAllTimersAsync();
    expect(calls.seed).toBe(1);
    stop();
  });

  it('문서가 있으면 처음 설정을 받지 않는다', async () => {
    const { port, saved, push } = fakePort();
    const { b, calls } = seedBinding(async () => ({ size: 'xl' }));
    const stop = startSettingsSync(port, b);
    push({ mode: 'b' });
    await vi.runAllTimersAsync();
    expect(calls.seed).toBe(0);
    expect(useTwo.getState()).toEqual({ size: 'md', mode: 'b' });
    expect(saved).toEqual([]);
    stop();
  });

  it('캐시의 "문서 없음"이면 받지 않고 서버를 기다린다', async () => {
    const { port, push } = fakePort();
    const { b, calls } = seedBinding(async () => ({ size: 'xl' }));
    const stop = startSettingsSync(port, b);
    push(null, true);
    await vi.runAllTimersAsync();
    expect(calls).toMatchObject({ seed: 0, ready: 0 });
    stop();
  });

  it('받지 못하면(실패·없음) 지금처럼 이 기기 값만', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const seed of [() => Promise.reject(new Error('막힘')), async () => null]) {
      useTwo.setState({ size: 'md', mode: 'b' });
      const { port, saved, push } = fakePort();
      const { b, calls } = seedBinding(seed);
      const stop = startSettingsSync(port, b);
      push(null);
      await vi.runAllTimersAsync();
      expect(useTwo.getState()).toEqual({ size: 'md', mode: 'b' });
      expect(calls).toMatchObject({ seeded: 0, ready: 1 });
      expect(saved).toEqual([{ mode: 'b' }]);
      stop();
    }
    warn.mockRestore();
  });

  it('받는 동안 다른 기기가 만든 문서가 오면 그것이 이긴다 · 끊으면 입히지 않는다', async () => {
    let release: (v: SettingsData) => void = () => {};
    const a = fakePort();
    const one = seedBinding(() => new Promise((r) => (release = r)));
    let stop = startSettingsSync(a.port, one.b);
    a.push(null);
    a.push({ mode: 'z' });
    release({ size: 'xl' });
    await vi.runAllTimersAsync();
    expect(useTwo.getState()).toEqual({ size: 'md', mode: 'z' });
    expect(one.calls.seeded).toBe(0);
    expect(a.saved).toEqual([]);
    stop();

    useTwo.setState({ size: 'md', mode: 'a' });
    const c = fakePort();
    const two = seedBinding(() => new Promise((r) => (release = r)));
    stop = startSettingsSync(c.port, two.b);
    c.push(null);
    void stop();
    release({ size: 'xl' });
    await vi.runAllTimersAsync();
    expect(useTwo.getState().size).toBe('md');
    expect(c.saved).toEqual([]);
  });
});

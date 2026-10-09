// '지금'을 보여 줄 때 쓰는 시계 (V4 hooks/useClock.ts) - 켠 동안만 30초마다 다시 그린다(지금 몇 교시: 오늘을 볼 때만).
// 값은 분 단위로 자른 시각(ms) - 같은 분 안에서는 몇 번 읽어도 같다(같은 순간에 그리는 칸끼리 같은 '지금'). 탭이 잠들었다 깨면 곧바로 다시 본다.
import { useSyncExternalStore } from 'react';

const TICK_MS = 30_000;
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
let current = minuteNow();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  const now = minuteNow();
  if (now === current) return;
  current = now;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = minuteNow();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', tick);
    }
  };
}

const noop = () => () => {};
const snapshot = () => {
  // 처음 그릴 때도 지금으로 (구독 전에 시간이 흘렀을 수 있다)
  if (listeners.size === 0) current = minuteNow();
  return current;
};
const frozen = () => 0;

/** 켜 두면 지금 시각(ms, 분 단위), 끄면 0 */
export function useClock(enabled: boolean): number {
  return useSyncExternalStore(enabled ? subscribe : noop, enabled ? snapshot : frozen);
}

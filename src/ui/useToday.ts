// 오늘 날짜 'YYYY-MM-DD' - 자정을 넘기면 저절로 바뀐다(켜 둔 탭이 어제를 '오늘'로 들고 있지 않게).
// 이월(오늘로 따라오는 일정)처럼 오늘에 따라 고르는 것이 쓴다. 탭이 잠들었다 깨면 곧바로 다시 본다.
import { useSyncExternalStore } from 'react';
import { todayStr } from '../domain/dateUtils';

let current = todayStr();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function refresh() {
  const now = todayStr();
  if (now !== current) {
    current = now;
    listeners.forEach((l) => l());
  }
}

function msToMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

function arm() {
  timer = setTimeout(() => {
    refresh();
    arm();
  }, msToMidnight());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    arm();
    document.addEventListener('visibilitychange', refresh);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      document.removeEventListener('visibilitychange', refresh);
    }
  };
}

const snapshot = () => {
  // 처음 그릴 때도 지금 날짜로 (구독 전에 날이 바뀌었을 수 있다)
  if (listeners.size === 0) current = todayStr();
  return current;
};

export function useToday(): string {
  return useSyncExternalStore(subscribe, snapshot);
}

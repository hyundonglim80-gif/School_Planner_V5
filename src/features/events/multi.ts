// 여러 개 고르기 (V4 store/useAppStore isMultiSelectMode·selectedEventIds - MENU 2-1). 하루·주간·월간·년간이 함께 쓴다.
//
// - 시작: ⋮ '여러 개 고르기' · 일정 카드 Ctrl+누르기 · Shift+누르기(범위) · 휴대폰 길게 누르기.
// - 고른 동안 카드를 누르면 고르기·풀기(V4 그대로), Shift = 앞서 누른 것부터 범위(같은 날 목록 안에서). ESC·✕·동작 뒤에 끝난다.
// - 고른 것 = 일정 id + 그 날(기간 일정은 그날 하나만 고른다 - V4 '기간·반복 묶음이어도 고른 것만').
import { create } from 'zustand';

export interface EventPick {
  id: string;
  /** 고른 날 (기간 일정의 그날) */
  day: string;
}

interface MultiState {
  on: boolean;
  picks: EventPick[];
  /** Shift 범위의 시작 (마지막으로 누른 것) */
  anchor: EventPick | null;
}

export const useMulti = create<MultiState>(() => ({ on: false, picks: [], anchor: null }));

export const pickKey = (p: EventPick) => `${p.id}|${p.day}`;
const same = (a: EventPick, b: EventPick) => a.id === b.id && a.day === b.day;

export function startMulti() {
  if (!useMulti.getState().on) useMulti.setState({ on: true, picks: [], anchor: null });
}

export function endMulti() {
  if (useMulti.getState().on) useMulti.setState({ on: false, picks: [], anchor: null });
}

/** ⋮ '여러 개 고르기' - 켜고 끄기 */
export function toggleMulti() {
  if (useMulti.getState().on) endMulti();
  else startMulti();
}

/** 하나 고르기·풀기 (꺼져 있으면 켜고 고른다) */
export function togglePick(p: EventPick) {
  const s = useMulti.getState();
  const has = s.on && s.picks.some((x) => same(x, p));
  useMulti.setState({ on: true, picks: has ? s.picks.filter((x) => !same(x, p)) : [...(s.on ? s.picks : []), p], anchor: p });
}

/**
 * Shift 범위: 앞서 누른 것부터 이것까지(보이는 목록 차례) 더한다. 앞서 누른 것이 이 목록에 없으면 이것 하나만 더한다.
 * (탐색기처럼 - 라벨로 보기 칩과 같은 누르기)
 */
export function pickRange(list: readonly EventPick[], p: EventPick) {
  const s = useMulti.getState();
  const from = s.anchor ? list.findIndex((x) => same(x, s.anchor!)) : -1;
  const to = list.findIndex((x) => same(x, p));
  const range = from < 0 || to < 0 ? [p] : list.slice(Math.min(from, to), Math.max(from, to) + 1);
  const picks = s.on ? [...s.picks] : [];
  for (const x of range) if (!picks.some((y) => same(x, y))) picks.push(x);
  useMulti.setState({ on: true, picks, anchor: s.anchor && from >= 0 ? s.anchor : p });
}

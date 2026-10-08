// D-Day (V4 hooks/useDDay.ts). 목록은 `settings/common.ddays`(계정에 하나 - DESIGN 4-8), 머리줄에 세울 것 하나는 `ddayPick`.
//   - 남은 날은 오늘 기준('D-37' · 'D-Day' · 지난 날은 'D+3'). 하루 화면에서 다른 날을 보면 둘째 줄에 그날 기준을 따로.
//   - 머리줄에는 고른 것 하나뿐 - 고른 것이 없으면(또는 지웠으면) 세우지 않는다(V4 - 가장 가까운 것을 대신 세우면 해제가 안 되는 것처럼 보였다).
//   - 처음 더한 것은 곧바로 고른다(V3·V4 그대로).
//   - 지우기 = 지운 표시(deletedAt - 원칙 5, 휴지통에서 되살린다 P5-4).
import { daysBetween } from './dateUtils';

export interface DDay {
  id: string;
  title: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 지운 때 (휴지통) */
  deletedAt?: number;
}

export interface DDayState {
  list: DDay[];
  pick: string | null;
}

/** 'D-37' · 'D-Day' · 'D+3' (base 기준 - 보통 오늘) */
export function ddayText(target: string, base: string): { text: string; diff: number } {
  const diff = daysBetween(base, target);
  return { text: diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${-diff}`, diff };
}

export const liveDDays = (list: readonly DDay[]) => list.filter((d) => !d.deletedAt);

/** 머리줄에 세울 것 (고른 것이 살아 있을 때만) */
export function primaryDDay(s: DDayState): DDay | null {
  return (s.pick && s.list.find((d) => d.id === s.pick && !d.deletedAt)) || null;
}

export function addDDay(s: DDayState, item: DDay): DDayState {
  return { list: [...s.list, item], pick: s.pick && primaryDDay(s) ? s.pick : item.id };
}

/** 지운 표시 (머리줄에 세운 것이면 내린다) */
export function removeDDay(s: DDayState, id: string, now: number): DDayState {
  return { list: s.list.map((d) => (d.id === id ? { ...d, deletedAt: now } : d)), pick: s.pick === id ? null : s.pick };
}

/** 되살리기 (지울 때 세워 두었던 것이면 다시 세운다) */
export function restoreDDay(s: DDayState, id: string, pick: string | null): DDayState {
  return { list: s.list.map((d) => (d.id === id ? { id: d.id, title: d.title, date: d.date } : d)), pick: pick ?? s.pick };
}

/** 휴지통 비우기 - 목록에서 뺀다 */
export function purgeDDay(s: DDayState, id: string): DDayState {
  return { ...s, list: s.list.filter((d) => d.id !== id) };
}

/** 설정 문서의 ddays 칸 → 믿을 만한 것만 (V4 dDayList 모양도 같다) */
export function readDDayList(v: unknown): DDay[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: DDay[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const { id, title, date, deletedAt } = x as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof title !== 'string' || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ id, title, date, ...(typeof deletedAt === 'number' ? { deletedAt } : {}) });
  }
  return out;
}

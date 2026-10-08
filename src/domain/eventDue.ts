// 일정 기한 (V4 lib/eventDue.ts, ROADMAP 11-2) - 순수 셈.
//
//   일정의 due('YYYY-MM-DD')가 기한이다. 끝내지 않은 일정에 D-3 · D-day · 기한 지남을 붙인다.
//   V4는 V3 이월이 due를 빼먹어 이월 사슬 id로 따로 적었다(eventDueStore) - V5는 항목 하나라 칸 하나로 끝난다
//   (사슬 기한은 가져오기 P3-4가 due로 옮긴다).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDueDate = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v);

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export interface DueBadgeInfo {
  text: string;
  /** soon: 3일 안, today: 오늘, over: 지남, later: 그 뒤 */
  tone: 'later' | 'soon' | 'today' | 'over';
  /** 기한까지 남은 날 (지났으면 음수) */
  days: number;
}

/** 기한 표시. 기한이 없거나 끝낸 일정이면 null */
export function dueBadge(due: string | undefined, today: string, completed = false): DueBadgeInfo | null {
  if (!isDueDate(due) || completed) return null;
  const days = dayNumber(due) - dayNumber(today);
  if (days > 0) return { text: `D-${days}`, tone: days <= 3 ? 'soon' : 'later', days };
  if (days === 0) return { text: 'D-day', tone: 'today', days };
  return { text: `기한 ${-days}일 지남`, tone: 'over', days };
}

export const DUE_TONE_CLASS: Record<DueBadgeInfo['tone'], string> = {
  later: 'text-slate-600 bg-slate-50 border-slate-200',
  soon: 'text-amber-700 bg-amber-50 border-amber-200',
  today: 'text-rose-700 bg-rose-50 border-rose-300',
  over: 'text-white bg-rose-500 border-rose-500',
};

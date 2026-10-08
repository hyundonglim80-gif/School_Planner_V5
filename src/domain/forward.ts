// 이월 (DESIGN 5-1, V4 lib/forwarding.ts·hooks/useDayData.ts runAutoForwarding의 판단 규칙). 계산만 한다 - 원칙 4.
//
// V4는 앱을 열 때마다 끝내지 않은 이월 일정을 지난 날 문서에서 빼 오늘 문서에 새 id로 옮겨 썼다(이월 러너).
// V5는 일정을 제 날짜에 그대로 두고, 오늘 칸에 '↪ 10/5부터'로 함께 보일 뿐이다(지난 날 칸에서는 흐리게 '→ 오늘로').
//
// - 대상: 일정 · 끝내지 않음 · 지우지 않음 · 하루짜리(기간 일정은 빼다) · 글이 있음 · 이월 판단이 참 · date < 오늘,
//   그리고 (date >= 오늘 - 이월 기간 또는 carrying).
// - 이월 판단(V4 isForwardTarget과 같은 차례): 이 일정만 정한 값(props.forward) → 붙은 라벨(아는 라벨 하나라도 켰으면) →
//   아는 라벨이 하나도 없으면 일정이 든 흔적(carrying - V4 '한 번 이월되던 것은 계속 이월한다').
// - 쓰기는 두 번뿐: 처음 따라올 때 carrying 한 번(features/events/ForwardMarks - 이월 기간이 지나도 계속 따라오게),
//   오늘 칸에서 끝낼 때 date = 오늘·carriedFrom = 처음 날(features/events/eventOps carriedDoneChanges).
import { addDays } from './dateUtils';

/** 이월을 판단하는 데 쓰는 칸 (일정 문서의 일부) */
export interface ForwardItem {
  kind: string;
  date: string | null;
  endDate?: string;
  text?: string;
  done?: boolean;
  deletedAt?: unknown;
  labelIds?: readonly string[];
  props?: { forward?: boolean };
  carrying?: boolean;
  carriedFrom?: string;
}

/** 일정 라벨 id → 이월을 켰나 (살아 있는 라벨만 - 모르는 라벨은 없는 셈) */
export type LabelForward = ReadonlyMap<string, boolean>;

/** 이월 판단: 이 일정만 정한 값 → 아는 라벨 → 흔적(carrying) */
export function forwardOn(item: ForwardItem, labels: LabelForward): boolean {
  if (typeof item.props?.forward === 'boolean') return item.props.forward;
  const known = (item.labelIds ?? []).filter((id) => labels.has(id));
  // 라벨이 풀리면 라벨이 정답이다 - 라벨 속성을 껐다 켰다 한 것이 그대로 따라간다
  if (known.length > 0) return known.some((id) => labels.get(id));
  // 라벨로 판단할 수 없으면(라벨을 지웠거나 아직 모름) 일정이 든 흔적을 믿는다
  return !!item.carrying;
}

/** 이월 기간의 첫날 (이날부터 어제까지 - V4 pastDateStrings와 같다) */
export const forwardWindowStart = (today: string, forwardDays: number) => addDays(today, -forwardDays);

/** 지금 오늘로 따라오는 중인가 */
export function isCarried(item: ForwardItem, labels: LabelForward, today: string, forwardDays: number): boolean {
  if (item.kind !== 'event' || item.done || item.deletedAt || !item.date) return false;
  // 기간 일정은 여러 날에 걸쳐 있어 '오늘로'가 없다 - 날마다 완료(doneDates)로 끝낸다
  if (item.endDate && item.endDate > item.date) return false;
  if (item.date >= today || !item.text?.trim()) return false;
  if (!forwardOn(item, labels)) return false;
  // 이월 기간 밖의 오래된 것은 이미 따라오던 것만 (만들어 두고 잊은 일정까지 쓸어 오지 않는다 - V4)
  return item.date >= forwardWindowStart(today, forwardDays) || !!item.carrying;
}

/** 오늘로 따라오는 일정 (주어진 차례 그대로) */
export function carriedOf<T extends ForwardItem>(items: readonly T[], labels: LabelForward, today: string, forwardDays: number): T[] {
  return items.filter((d) => isCarried(d, labels, today, forwardDays));
}

/** '↪ 10/5부터'의 날 (끝냈다 푼 일정은 처음 날을 carriedFrom에 들고 있다) */
export const carriedSince = (item: Pick<ForwardItem, 'date' | 'carriedFrom'>) => item.carriedFrom ?? item.date ?? '';

/**
 * 지난 일정 (하루 화면 오늘 칸 아래 '📥 지난 일정 N개' - V4 '지난 일정 오늘로 가져오기' 창을 줄로): 이월 기간 안의 지난 날에 끝내지 않은 하루짜리 일정 가운데
 * **오늘로 따라오지 않는 것**(따라오는 것은 이미 오늘 칸에 있다). 날짜 다음 주어진 차례.
 */
export function staleOf<T extends ForwardItem>(items: readonly T[], labels: LabelForward, today: string, forwardDays: number): T[] {
  const from = forwardWindowStart(today, forwardDays);
  return items
    .filter(
      (d) =>
        d.kind === 'event' &&
        !d.done &&
        !d.deletedAt &&
        !!d.date &&
        !(d.endDate && d.endDate > d.date) &&
        d.date >= from &&
        d.date < today &&
        !!d.text?.trim() &&
        !isCarried(d, labels, today, forwardDays),
    )
    .map((d, i) => [d, i] as const)
    .sort(([a, i], [b, j]) => a.date!.localeCompare(b.date!) || i - j)
    .map(([d]) => d);
}

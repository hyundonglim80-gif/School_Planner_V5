// 달력(월간·년간)에 올릴 일정 - '달력' 속성을 켠 것만(V4 isCalendarVisible: 이 일정만 정한 값 → 붙은 라벨, 라벨이 없으면 켜짐).
// 하루짜리는 그날 칸에, 기간 일정은 막대(domain/periodBars)로.
import { isPeriod } from '../../domain/period';
import { itemsBetween, type Docs, type LabelTree } from '../../data/select';
import { effectiveAttrs } from '../events/eventForm';
import type { ItemDoc } from '../events/eventOps';

export const onCalendar = (ev: ItemDoc, tree: LabelTree) => effectiveAttrs({ labelIds: ev.labelIds ?? [], props: ev.props ?? {} }, tree).calendar;

export interface CalendarEvents {
  /** 날짜 → 그날 하루짜리 일정 (차례대로) */
  byDate: Map<string, ItemDoc[]>;
  /** 범위에 걸친 기간 일정 */
  periods: ItemDoc[];
}

/** [from, to] 범위의 달력 일정 */
export function calendarEvents(items: Docs<'items'>, from: string, to: string, tree: LabelTree): CalendarEvents {
  const byDate = new Map<string, ItemDoc[]>();
  const periods: ItemDoc[] = [];
  for (const ev of itemsBetween(items, from, to, 'event')) {
    if (!onCalendar(ev, tree)) continue;
    if (isPeriod(ev)) periods.push(ev);
    else {
      const list = byDate.get(ev.date!);
      if (list) list.push(ev);
      else byDate.set(ev.date!, [ev]);
    }
  }
  return { byDate, periods };
}

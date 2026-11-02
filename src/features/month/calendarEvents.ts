// 달력(월간·년간)에 올릴 일정 - '달력' 속성을 켠 것만(V4 isCalendarVisible: 이 일정만 정한 값 → 붙은 라벨, 라벨이 없으면 켜짐).
// 하루짜리는 그날 칸에, 기간 일정은 막대(domain/periodBars)로.
// 겹쳐 보기(P17-2): 겹친 공간 것을 그 공간 트리로 골라 주 공간 것 뒤에 붙인다 - 어느 공간 것인지는 spaceOf(항목 객체 → 공간, 주 공간 것은 없다).
import { isPeriod } from '../../domain/period';
import { itemsBetween, type Docs, type LabelTree, type OverlaySpace } from '../../data/select';
import { effectiveAttrs } from '../events/eventForm';
import type { ItemDoc } from '../events/eventOps';

export const onCalendar = (ev: ItemDoc, tree: LabelTree) => effectiveAttrs({ labelIds: ev.labelIds ?? [], props: ev.props ?? {} }, tree).calendar;

export interface CalendarEvents {
  /** 날짜 → 그날 하루짜리 일정 (차례대로) */
  byDate: Map<string, ItemDoc[]>;
  /** 범위에 걸친 기간 일정 */
  periods: ItemDoc[];
  /** 겹친 공간 일정 → 그 공간 (주 공간 것은 없다) */
  spaceOf: ReadonlyMap<ItemDoc, OverlaySpace>;
}

const NO_SPACES: ReadonlyMap<ItemDoc, OverlaySpace> = new Map();

/** [from, to] 범위의 달력 일정 (겹친 공간 것은 주 공간 것 뒤에) */
export function calendarEvents(items: Docs<'items'>, from: string, to: string, tree: LabelTree, overlays: readonly OverlaySpace[] = []): CalendarEvents {
  const byDate = new Map<string, ItemDoc[]>();
  const periods: ItemDoc[] = [];
  const spaceOf = overlays.length ? new Map<ItemDoc, OverlaySpace>() : NO_SPACES;
  const add = (list: Docs<'items'>, t: LabelTree, space?: OverlaySpace) => {
    for (const ev of itemsBetween(list, from, to, 'event')) {
      if (!onCalendar(ev, t)) continue;
      if (space) (spaceOf as Map<ItemDoc, OverlaySpace>).set(ev, space);
      if (isPeriod(ev)) periods.push(ev);
      else {
        const day = byDate.get(ev.date!);
        if (day) day.push(ev);
        else byDate.set(ev.date!, [ev]);
      }
    }
  };
  add(items, tree);
  for (const o of overlays) add(o.items, o.tree, o);
  return { byDate, periods, spaceOf };
}

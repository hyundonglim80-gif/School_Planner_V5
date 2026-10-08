// 반복 일정 쓰기에서 '무엇을 적나' (순수 - 서버 없이 시험한다). 적는 것은 actions.ts. DESIGN 4-4.
//
// - 만들기 = series 문서 하나 + 날마다 항목(seriesId·seriesIndex) - 한 묶음(되돌리면 모두 지운 표시).
// - 묶음 고치기(이 날부터·전부) = 바꾼 칸만 그 항목들에(한 묶음) + series의 template. 날짜를 옮겼으면 고른 것을 같은 날 수만큼(V4 GroupMoveModal).
// - 묶음 지우기: 이 날만 = 그 항목 · 이 날부터 = 그날부터의 항목 + series.until을 앞 항목 날로 · 전부 = 항목 모두 + series.
import { addDays, daysBetween } from '../../domain/dateUtils';
import { recurDates, type SeriesRuleShape } from '../../domain/recur';
import { writeOp, type Changes, type WriteOp } from '../../data/repo/ops';
import type { DocPath, Editable, Stored } from '../../data/types';
import { itemPath, type ItemDoc } from './eventOps';

export type SeriesDoc = Stored<'series'>;
export const seriesPath = (sid: string, id: string): DocPath<'series'> => ({ sid, coll: 'series', id });

/** 같은 반복 묶음의 살아 있는 항목 (날짜 → 차례) */
export function seriesItemsOf(items: Readonly<Record<string, ItemDoc>>, seriesId: string): ItemDoc[] {
  return Object.values(items)
    .filter((d) => d.seriesId === seriesId && !d.deletedAt)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || ((a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)));
}

/** 묶음에서 고른 범위 (이 날만·이 날부터·전부) */
export function scopeItems(list: readonly ItemDoc[], item: ItemDoc, scope: 'only' | 'after' | 'all'): ItemDoc[] {
  if (scope === 'only') return [item];
  if (scope === 'all') return [...list];
  return list.filter((d) => (d.date ?? '') >= (item.date ?? ''));
}

export interface SeriesPlan {
  rule: SeriesRuleShape;
  start: string;
  until: string;
  /** 항목 하나의 칸 (날짜·차례·묶음 칸은 여기서 붙인다) */
  data: Editable<'items'>;
  /** 그날 목록의 맨 뒤 다음 차례 */
  orderOn: (date: string) => string;
  seriesId: string;
  itemIds: string[];
}

/** 만들 날짜들 (규칙·시작·끝) */
export const planDates = (p: Pick<SeriesPlan, 'rule' | 'start' | 'until'>) => recurDates(p.rule, p.start, p.until);

/** 반복 만들기: series 하나 + 날마다 항목. 쓰기들 (itemIds는 날짜 수만큼 주어야 한다) */
export function createSeriesOps(sid: string, p: SeriesPlan): WriteOp[] {
  const dates = planDates(p);
  const d = p.data;
  const ops: WriteOp[] = [
    writeOp.create(seriesPath(sid, p.seriesId), {
      rule: p.rule,
      start: p.start,
      until: p.until,
      count: dates.length,
      template: { text: d.text, labelIds: d.labelIds, ...(d.time ? { time: d.time } : {}), ...(d.props ? { props: d.props } : {}) },
    }),
  ];
  dates.forEach((date, i) => {
    ops.push(writeOp.create(itemPath(sid, p.itemIds[i]), { ...d, date, order: p.orderOn(date), seriesId: p.seriesId, seriesIndex: i }));
  });
  return ops;
}

/** 칸 이름 - 묶음 고치기에서 날짜 말고 함께 옮겨 적는 것 */
const FIELD_KEYS = ['text', 'labelIds', 'props', 'time', 'due'] as const;

/**
 * 묶음 고치기: 이 항목에서 바꾼 칸(editChanges)을 고른 항목들에 그대로. 날짜를 옮겼으면 같은 날 수만큼.
 * 시각을 바꾸거나 날짜를 옮기면 그 항목의 울림(alarmDone)을 지운다. series.template도 함께(이 날만이 아니면).
 */
export function editSeriesOps(
  sid: string,
  item: ItemDoc,
  changes: Changes<'items'>,
  targets: readonly ItemDoc[],
  series: SeriesDoc | undefined,
  withTemplate: boolean,
): WriteOp[] {
  const moved = changes.date && item.date ? daysBetween(item.date, changes.date) : 0;
  const ops: WriteOp[] = [];
  for (const t of targets) {
    const c: Record<string, unknown> = {};
    for (const k of FIELD_KEYS) if (Object.hasOwn(changes, k)) c[k] = changes[k];
    if (moved && t.date) c.date = addDays(t.date, moved);
    // 이미 같은 값이면 쓰지 않는다
    for (const k of Object.keys(c)) if (JSON.stringify(c[k] ?? null) === JSON.stringify((t as unknown as Record<string, unknown>)[k] ?? null)) delete c[k];
    // 그 항목의 시각이 바뀌거나 날짜를 옮기면 다시 울린다
    if (t.alarmDone && t.time && (Object.hasOwn(c, 'time') || Object.hasOwn(c, 'date'))) c.alarmDone = undefined;
    if (Object.keys(c).length) ops.push(writeOp.patch(itemPath(sid, t.id), c as Changes<'items'>, t));
  }
  if (withTemplate && series && FIELD_KEYS.some((k) => k !== 'due' && Object.hasOwn(changes, k))) {
    const tpl = { ...series.template };
    for (const k of ['text', 'labelIds', 'props', 'time'] as const) {
      if (!Object.hasOwn(changes, k)) continue;
      const v = changes[k];
      if (v === undefined) delete (tpl as Record<string, unknown>)[k];
      else (tpl as Record<string, unknown>)[k] = v;
    }
    ops.push(writeOp.patch(seriesPath(sid, series.id), { template: tpl }, series));
  }
  return ops;
}

/** 묶음 지우기 */
export function deleteSeriesOps(
  sid: string,
  item: ItemDoc,
  list: readonly ItemDoc[],
  series: SeriesDoc | undefined,
  scope: 'only' | 'after' | 'all',
): WriteOp[] {
  const targets = scopeItems(list, item, scope);
  const ops = targets.map((t) => writeOp.remove(itemPath(sid, t.id)));
  if (!series) return ops;
  const left = list.filter((d) => !targets.includes(d));
  if (left.length === 0) ops.push(writeOp.remove(seriesPath(sid, series.id)));
  else if (scope === 'after') {
    const until = left[left.length - 1].date!;
    if (until !== series.until) ops.push(writeOp.patch(seriesPath(sid, series.id), { until }, series));
  }
  return ops;
}

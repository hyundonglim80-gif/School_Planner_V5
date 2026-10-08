import { describe, expect, it } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import type { ItemDoc } from './eventOps';
import { createSeriesOps, deleteSeriesOps, editSeriesOps, scopeItems, seriesItemsOf, type SeriesDoc } from './seriesOps';

const SID = 'u_me';
const it3 = (id: string, date: string, i: number, more: Partial<ItemDoc> = {}) =>
  ({ id, kind: 'event', date, text: '협의회', labelIds: ['L'], order: 'a0', seriesId: 's1', seriesIndex: i, ...more }) as ItemDoc;
const list = [it3('a', '2026-10-06', 0), it3('b', '2026-10-13', 1, { time: '15:00', alarmDone: true }), it3('c', '2026-10-20', 2)];
const series = { id: 's1', rule: { freq: 'weekly', interval: 1, weekdays: [2] }, start: '2026-10-06', until: '2026-10-20', template: { text: '협의회', labelIds: ['L'] } } as unknown as SeriesDoc;
type Patch = Extract<WriteOp, { type: 'patch' }>;

describe('반복 만들기', () => {
  it('series 하나 + 날마다 항목 (seriesId·seriesIndex·그날 차례)', () => {
    const ops = createSeriesOps(SID, {
      rule: { freq: 'weekly', interval: 1, weekdays: [2] },
      start: '2026-10-05',
      until: '2026-10-20',
      data: { kind: 'event', date: '', text: '협의회', labelIds: ['L'], order: '', time: '15:00' },
      orderOn: (d) => `o${d.slice(-2)}`,
      seriesId: 's1',
      itemIds: ['x0', 'x1', 'x2'],
    });
    expect(ops).toHaveLength(4);
    expect(ops[0]).toMatchObject({ type: 'create', at: { coll: 'series', id: 's1' }, data: { count: 3, until: '2026-10-20', template: { text: '협의회', labelIds: ['L'], time: '15:00' } } });
    expect(ops[1]).toMatchObject({ type: 'create', at: { coll: 'items', id: 'x0' }, data: { date: '2026-10-06', order: 'o06', seriesId: 's1', seriesIndex: 0, time: '15:00' } });
    expect((ops[3] as Extract<WriteOp, { type: 'create' }>).data.date).toBe('2026-10-20');
  });
});

describe('반복 묶음 고르기', () => {
  it('같은 seriesId의 살아 있는 것, 날짜 차례', () => {
    const docs = { c: list[2], a: list[0], b: list[1], d: { ...list[0], id: 'd', deletedAt: 1 } as unknown as ItemDoc };
    expect(seriesItemsOf(docs, 's1').map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(scopeItems(list, list[1], 'after').map((d) => d.id)).toEqual(['b', 'c']);
    expect(scopeItems(list, list[1], 'only').map((d) => d.id)).toEqual(['b']);
  });
});

describe('반복 묶음 고치기', () => {
  it('바꾼 칸만 고른 항목들에 + template', () => {
    const ops = editSeriesOps(SID, list[1], { text: '학년 협의회' }, scopeItems(list, list[1], 'after'), series, true);
    expect(ops.map((o) => o.at.id)).toEqual(['b', 'c', 's1']);
    expect((ops[0] as Patch).changes).toEqual({ text: '학년 협의회' });
    expect((ops[2] as Patch).changes).toEqual({ template: { text: '학년 협의회', labelIds: ['L'] } });
  });
  it('날짜를 옮기면 같은 날 수만큼, 울린 알림은 다시', () => {
    const ops = editSeriesOps(SID, list[1], { date: '2026-10-14' }, list, series, true);
    expect(ops.map((o) => (o as Patch).changes)).toEqual([{ date: '2026-10-07' }, { date: '2026-10-14', alarmDone: undefined }, { date: '2026-10-21' }]);
  });
  it('이미 같은 값인 항목은 쓰지 않는다', () => {
    const ops = editSeriesOps(SID, list[0], { time: '15:00' }, list, series, false);
    expect(ops.map((o) => o.at.id)).toEqual(['a', 'c']);
  });
});

describe('반복 묶음 지우기', () => {
  it('이 날부터 = 그날부터 지운 표시 + series.until을 앞 항목 날로', () => {
    const ops = deleteSeriesOps(SID, list[1], list, series, 'after');
    expect(ops).toEqual([
      { type: 'remove', at: { sid: SID, coll: 'items', id: 'b' } },
      { type: 'remove', at: { sid: SID, coll: 'items', id: 'c' } },
      expect.objectContaining({ type: 'patch', at: { sid: SID, coll: 'series', id: 's1' }, changes: { until: '2026-10-06' } }),
    ]);
  });
  it('전부 = 항목 모두 + series', () => {
    const ops = deleteSeriesOps(SID, list[1], list, series, 'all');
    expect(ops.map((o) => `${o.type}:${o.at.id}`)).toEqual(['remove:a', 'remove:b', 'remove:c', 'remove:s1']);
  });
});

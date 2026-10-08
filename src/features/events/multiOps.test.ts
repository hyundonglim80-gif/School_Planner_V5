import { beforeEach, describe, expect, it } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import type { ItemDoc } from './eventOps';
import { endMulti, pickRange, togglePick, toggleMulti, useMulti } from './multi';
import { multiDeleteOps, multiDoneOps, multiLabelOps, multiMoveOps, pickedCount, resolvePicks } from './multiOps';

const SID = 'u_me';
const ev = (id: string, more: Partial<ItemDoc> = {}) => ({ id, kind: 'event', date: '2026-10-08', text: id, labelIds: ['L'], order: 'a0', ...more }) as ItemDoc;
// 10/7(수)~10/13(화) 주말 빼기
const span = ev('p', { date: '2026-10-07', endDate: '2026-10-13', workdays: true, time: '09:00' });
const items = { a: ev('a'), b: ev('b', { done: true }), c: ev('c', { date: '2026-10-05', carrying: true }), p: span, d: ev('d', { deletedAt: 1 as never }) };
type Patch = Extract<WriteOp, { type: 'patch' }>;
type Create = Extract<WriteOp, { type: 'create' }>;

describe('고르기 store', () => {
  beforeEach(() => endMulti());
  it('누르기 = 켜고 고르기·풀기, Shift = 앞서 누른 것부터 범위, 끝내면 비운다', () => {
    togglePick({ id: 'a', day: 'D' });
    expect(useMulti.getState()).toMatchObject({ on: true, picks: [{ id: 'a', day: 'D' }] });
    const list = ['a', 'b', 'c', 'd'].map((id) => ({ id, day: 'D' }));
    pickRange(list, { id: 'c', day: 'D' });
    expect(useMulti.getState().picks.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    togglePick({ id: 'b', day: 'D' });
    expect(useMulti.getState().picks.map((p) => p.id)).toEqual(['a', 'c']);
    toggleMulti();
    expect(useMulti.getState()).toMatchObject({ on: false, picks: [] });
  });
});

describe('여러 개 고르기 쓰기', () => {
  const picks = [
    { id: 'a', day: '2026-10-08' },
    { id: 'b', day: '2026-10-08' },
    { id: 'p', day: '2026-10-08' },
    { id: 'p', day: '2026-10-09' },
    { id: 'd', day: '2026-10-08' },
  ];
  const list = resolvePicks(picks, items);

  it('일정마다 모은다 (지운 것은 뺀다), 기간은 날마다 센다', () => {
    expect(list.map((p) => [p.item.id, p.days.length])).toEqual([
      ['a', 1],
      ['b', 1],
      ['p', 2],
    ]);
    expect(pickedCount(list)).toBe(4);
  });

  it('완료: 끝낸 것은 그대로, 기간은 고른 날들을 한 문서에, 오늘 칸에 따라온 것은 오늘로', () => {
    const ops = multiDoneOps(SID, [...list, ...resolvePicks([{ id: 'c', day: '2026-10-08' }], items)], {
      today: '2026-10-08',
      carriedIds: new Set(['c']),
      orderToday: () => 'z9',
      now: 5,
    }) as Patch[];
    expect(ops.map((o) => o.at.id)).toEqual(['a', 'p', 'c']);
    expect(ops[1].changes).toEqual({ doneDates: ['2026-10-08', '2026-10-09'] });
    expect(ops[2].changes).toMatchObject({ done: true, date: '2026-10-08', carriedFrom: '2026-10-05', order: 'z9', carrying: undefined });
  });

  it('라벨: 하나로 바꾸기·떼기 (같으면 쓰지 않는다), 따로 정한 속성은 걷는다', () => {
    const withProps = resolvePicks([{ id: 'x', day: 'D' }], { x: ev('x', { props: { forward: true } }) });
    expect((multiLabelOps(SID, withProps, 'M')[0] as Patch).changes).toEqual({ labelIds: ['M'], props: undefined });
    expect(multiLabelOps(SID, list, 'L')).toEqual([]);
    expect((multiLabelOps(SID, list, null) as Patch[]).map((o) => o.changes)).toEqual([{ labelIds: [] }, { labelIds: [] }, { labelIds: [] }]);
  });

  it('옮기기: 하루짜리는 date·order, 이미 그 날은 그대로, 기간은 고른 날을 빼고 하루 일정으로', () => {
    let n = 0;
    const r = multiMoveOps(SID, list, '2026-10-20', ['o1', 'o2', 'o3', 'o4'], () => `new${++n}`);
    expect(r.moved).toBe(4);
    const [a, b, p, c1, c2] = r.ops;
    expect((a as Patch).changes).toEqual({ date: '2026-10-20', order: 'o1' });
    expect((b as Patch).changes).toEqual({ date: '2026-10-20', order: 'o2' });
    expect((p as Patch).changes).toEqual({ skipDates: ['2026-10-08', '2026-10-09'] });
    expect((c1 as Create).data).toMatchObject({ date: '2026-10-20', text: 'p', order: 'o3' });
    expect((c1 as Create).data).not.toHaveProperty('time');
    expect((c2 as Create).at.id).toBe('new2');
    const same = multiMoveOps(SID, resolvePicks([{ id: 'a', day: '2026-10-08' }], items), '2026-10-08', ['o1'], () => 'x');
    expect(same).toEqual({ ops: [], moved: 0, same: 1 });
  });

  it('지우기: 지운 표시, 기간은 고른 날만', () => {
    const ops = multiDeleteOps(SID, list);
    expect(ops.map((o) => o.type)).toEqual(['remove', 'remove', 'patch']);
    expect((ops[2] as Patch).changes).toEqual({ skipDates: ['2026-10-08', '2026-10-09'] });
  });
});

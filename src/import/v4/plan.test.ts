import { describe, expect, it } from 'vitest';
import { toWrite, type WriteOp } from '../../data/repo/ops';
import type { Stored } from '../../data/types';
import {
  addCounts,
  changedTotal,
  contentOf,
  emptyCounts,
  fingerprint,
  IMPORT_DELETER,
  planDocs,
  untouched,
  type Planned,
} from './plan';

type L = Stored<'labels'>;
const TS = { seconds: 1, nanoseconds: 0 } as unknown as L['updatedAt'];

const planned = (id: string, name: string, extra: Partial<Planned<'labels'>['data']> = {}): Planned<'labels'> => ({
  id,
  data: { kind: 'event', name, color: 'blue', parentId: null, order: 'a0', ...extra },
  src: { path: 'settings/labels', id: `v4_${id}` },
});

/** 가져오기가 적은 모양 그대로의 V5 문서 */
function imported(p: Planned<'labels'>, over: Partial<L> = {}): L {
  const data = contentOf(p.data as Record<string, unknown>);
  return {
    ...(p.data as object),
    id: p.id,
    src: { from: 'v4', ...p.src, h: fingerprint(data) },
    createdAt: 1,
    authorId: 'me',
    deletedAt: null,
    updatedAt: TS,
    v: 1,
    ...over,
  } as L;
}

const owns = (d: L) => d.src?.path === 'settings/labels';
const byId = (...docs: L[]) => Object.fromEntries(docs.map((d) => [d.id, d]));
const ctx = { uid: 'me', now: 5 };
const writes = (ops: WriteOp[]) => ops.map((o) => toWrite(o, ctx) as { kind: string; path: string; data: Record<string, unknown> });

describe('planDocs - 처음 가져오기', () => {
  it('없는 문서는 새로 (src에 V4 자리와 지문)', () => {
    const p = planned('a', '달력');
    const { ops, counts } = planDocs('u_me', 'labels', [p], {}, owns);
    expect(counts).toEqual({ ...emptyCounts(), added: 1 });
    const [w] = writes(ops);
    expect(w.kind).toBe('set');
    expect(w.path).toBe('spaces/u_me/labels/a');
    expect(w.data).toMatchObject({ name: '달력', src: { from: 'v4', path: 'settings/labels', id: 'v4_a' }, deletedAt: null });
    expect((w.data.src as { h: string }).h).toBe(fingerprint(contentOf(p.data as Record<string, unknown>)));
  });

  it('같은 id가 두 번 나오면 처음 것만', () => {
    const { ops } = planDocs('u_me', 'labels', [planned('a', '달력'), planned('a', '다른')], {}, owns);
    expect(ops).toHaveLength(1);
  });
});

describe('planDocs - 다시 가져오기', () => {
  it('V4도 V5도 그대로면 쓰지 않는다 (바뀐 것 0)', () => {
    const p = planned('a', '달력');
    const { ops, counts } = planDocs('u_me', 'labels', [p], byId(imported(p)), owns);
    expect(ops).toEqual([]);
    expect(counts).toEqual({ ...emptyCounts(), same: 1 });
    expect(changedTotal(counts)).toBe(0);
  });

  it('V4에서 바뀌면 바뀐 칸만 (없어진 칸은 지우기) + 새 지문', () => {
    const old = planned('a', '달력', { props: { calendar: true, forward: false } });
    const now = planned('a', '행사', { color: 'blue' });
    const { ops, counts } = planDocs('u_me', 'labels', [now], byId(imported(old)), owns);
    expect(counts.changed).toBe(1);
    const [w] = writes(ops);
    expect(w.kind).toBe('update');
    expect(Object.keys(w.data).sort()).toEqual(['name', 'props', 'src', 'updatedAt']);
    expect(w.data.name).toBe('행사');
    expect(typeof w.data.props).toBe('symbol'); // 칸 지우기
    expect((w.data.src as { h: string }).h).toBe(fingerprint(contentOf(now.data as Record<string, unknown>)));
  });

  it('V5에서 고친 것은 덮지 않는다 (둠)', () => {
    const p = planned('a', '달력');
    const v5 = imported(p, { color: 'red' }); // 지문과 다르다
    expect(untouched(v5)).toBe(false);
    const { ops, counts } = planDocs('u_me', 'labels', [planned('a', '바뀐 이름')], byId(v5), owns);
    expect(ops).toEqual([]);
    expect(counts).toEqual({ ...emptyCounts(), kept: 1 });
  });

  it('V5에서 사용자가 지운 것은 되살리지 않는다', () => {
    const p = planned('a', '달력');
    const v5 = imported(p, { deletedAt: TS, deletedBy: 'me' });
    const { ops, counts } = planDocs('u_me', 'labels', [p], byId(v5), owns);
    expect(ops).toEqual([]);
    expect(counts.kept).toBe(1);
  });

  it('가져오기가 지운 것(V4에서 없어졌던 것)이 V4에 다시 있으면 새로 적는다', () => {
    const p = planned('a', '달력');
    const v5 = imported(p, { deletedAt: TS, deletedBy: IMPORT_DELETER });
    const { ops, counts } = planDocs('u_me', 'labels', [p], byId(v5), owns);
    expect(counts.added).toBe(1);
    expect(writes(ops)[0]).toMatchObject({ kind: 'set', data: { deletedAt: null } });
  });

  it('src가 없는 V5 문서와 id가 겹치면 그 문서는 V5 것 (둠)', () => {
    const p = planned('a', '달력');
    const v5 = { ...imported(p), src: undefined } as L;
    expect(planDocs('u_me', 'labels', [p], byId(v5), owns).counts.kept).toBe(1);
  });
});

describe('planDocs - V4에서 없어진 것', () => {
  it('V5에서 고치지 않았으면 지운 표시 (누가 = 가져오기)', () => {
    const gone = imported(planned('b', '옛 라벨'));
    const { ops, counts } = planDocs('u_me', 'labels', [], byId(gone), owns);
    expect(counts.removed).toBe(1);
    expect(writes(ops)[0]).toMatchObject({ kind: 'update', path: 'spaces/u_me/labels/b', data: { deletedBy: IMPORT_DELETER } });
  });

  it('V5에서 고쳤으면 두고, 이미 지운 것·이 종류가 아닌 것·V5에서 만든 것은 건드리지 않는다', () => {
    const edited = imported(planned('b', '옛 라벨'), { name: 'V5에서 고침' });
    const dead = imported(planned('c', '지운 것'), { deletedAt: TS });
    const other = { ...imported(planned('d', '다른 자리')), src: { from: 'v4', path: 'events/2026-03-02', id: 'x', h: 'y' } } as L;
    const mine = { ...imported(planned('e', 'V5 라벨')), src: undefined } as L;
    const { ops, counts } = planDocs('u_me', 'labels', [], byId(edited, dead, other, mine), owns);
    expect(ops).toEqual([]);
    expect(counts).toEqual({ ...emptyCounts(), kept: 1 });
  });
});

describe('결과 수', () => {
  it('학년도별 수를 함께 센다', () => {
    const p = { ...planned('a', '일정'), year: '2026' };
    const q = { ...planned('b', '일정'), year: '2025' };
    const r = { ...planned('c', '일정'), year: '2026' };
    const { counts } = planDocs('u_me', 'labels', [p, q, r], {}, owns);
    expect(counts.years).toEqual({ '2026': 2, '2025': 1 });
  });

  it('더하기', () => {
    const a = { ...emptyCounts(), added: 1, years: { '2026': 1 } };
    const b = { ...emptyCounts(), same: 2, years: { '2026': 2, '2025': 1 } };
    expect(addCounts(a, b)).toEqual({ added: 1, changed: 0, same: 2, kept: 0, removed: 0, years: { '2026': 3, '2025': 1 } });
    expect(addCounts(emptyCounts(), emptyCounts()).years).toBeUndefined();
  });
});

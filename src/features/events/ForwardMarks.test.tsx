// 이월 - 처음 따라올 때 carrying 한 번만 (앱을 열 때 이미 따라오던 일정에는 쓰지 않는다), 서버에서 받기 전에는 판단하지 않는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useCommonSettings } from '../../app/prefs';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { WriteOp } from '../../data/repo';
import ForwardMarks from './ForwardMarks';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  return {
    ...real,
    writeOps: vi.fn(async (ops: WriteOp[]) => {
      written.batches.push(ops);
    }),
  };
});

const SID = 'u_me';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const labels = new Map<string, Record<string, unknown>>([
  ['F', { ...base, kind: 'event', name: '이월', color: 'green', parentId: null, order: 'a0', props: { forward: true } }],
]);
const ev = (id: string, more: Record<string, unknown>) => [id, { ...base, kind: 'event', text: id, labelIds: ['F'], order: 'a0', ...more }] as const;

function seed(docs: Map<string, Record<string, unknown>>, status: 'live' | 'copy' = 'live') {
  for (const [coll, d] of [
    ['labels', labels],
    ['items', docs],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, d);
    setStatus(SID, coll, status);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
  useCommonSettings.setState({ forwardDays: 14 });
  resetMirrorStore();
  written.batches = [];
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ForwardMarks', () => {
  it('처음 따라오는 일정에만 carrying: true (한 묶음, 칸 하나), 이미 따라오던 것·오늘 것·끝낸 것은 쓰지 않는다', () => {
    seed(
      new Map([
        ev('new', { date: '2026-10-07' }),
        ev('kept', { date: '2026-09-01', carrying: true }),
        ev('today', { date: '2026-10-08' }),
        ev('done', { date: '2026-10-07', done: true }),
      ]),
    );
    render(<ForwardMarks />);
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0]).toEqual([expect.objectContaining({ type: 'patch', at: { sid: SID, coll: 'items', id: 'new' }, changes: { carrying: true } })]);
  });

  it('모두 이미 따라오던 것이면 아무것도 쓰지 않는다 (앱을 열 때 이월이 서버에 쓰지 않는다)', () => {
    seed(new Map([ev('kept', { date: '2026-10-01', carrying: true })]));
    render(<ForwardMarks />);
    expect(written.batches).toEqual([]);
  });

  it('서버에서 받기 전(사본으로만 그림)에는 판단하지 않고, 받으면 그때 한 번', () => {
    seed(new Map([ev('new', { date: '2026-10-07' })]), 'copy');
    render(<ForwardMarks />);
    expect(written.batches).toEqual([]);
    act(() => {
      setStatus(SID, 'items', 'live');
      setStatus(SID, 'labels', 'live');
    });
    expect(written.batches).toHaveLength(1);
    // 같은 일정은 이 탭에서 다시 쓰지 않는다 (적기가 아직 돌아오지 않았어도)
    act(() => setStatus(SID, 'items', 'live'));
    expect(written.batches).toHaveLength(1);
  });
});

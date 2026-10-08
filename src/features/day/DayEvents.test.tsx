// 하루 일정 칸 - 그날 일정만·카드(라벨 칩·⏰·기한·🔗)·완료(☐·칩)·순서(▲▼ = 문서 하나)·받는 중·고치는 일정 짚기
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useWindows } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import { undoCount } from '../../data/undo';
import type { WriteOp } from '../../data/repo';
import DayEvents from './DayEvents';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const record = async (ops: WriteOp[]) => {
    written.batches.push(ops);
    // 되돌리기 자리 (비어 있지 않으면 Ctrl+Z 더미에 쌓인다)
    return ops;
  };
  return {
    ...real,
    batch: vi.fn(record),
    patch: vi.fn((at, changes, before) => record([real.writeOp.patch(at, changes, before)])),
  };
});

const SID = 'u_me';
const DAY = '2026-10-08';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const labels = new Map<string, Record<string, unknown>>([
  ['L1', { ...base, kind: 'event', name: '회의', color: 'blue', parentId: null, order: 'a0', props: { forward: true } }],
]);
const ev = (id: string, order: string, more: Record<string, unknown> = {}) => [
  id,
  { ...base, kind: 'event', date: DAY, text: `일정 ${id}`, labelIds: [], order, ...more },
] as const;
const items = new Map<string, Record<string, unknown>>([
  ev('a', 'a0', { labelIds: ['L1', 'gone'], time: '09:30', due: '2026-10-10', linkIds: ['x', 'y'] }),
  ev('b', 'a1', { done: true, doneAt: 5 }),
  ev('c', 'a2'),
  ev('other', 'a0', { date: '2026-10-09' }),
  ['note', { ...base, kind: 'note', date: DAY, text: '기록', labelIds: [], order: 'a0' }],
  ['del', { ...base, kind: 'event', date: DAY, text: '지운 것', labelIds: [], order: 'a3', deletedAt: t }],
]);

const q = (s: string) => document.querySelector<HTMLElement>(s);
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
const cards = () => qa('[data-event-card]').map((c) => c.dataset.eventCard);

function seed(status: 'live' | 'loading' = 'live', docs = items) {
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
  resetMirrorStore();
  written.batches = [];
  useWindows.setState({ windows: [] });
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('하루 일정 칸', () => {
  it('그날의 일정만 차례대로 (기록·다른 날·지운 것은 빼고), 수와 카드', () => {
    seed();
    render(<DayEvents date={DAY} />);
    expect(cards()).toEqual(['a', 'b', 'c']);
    expect(q('[data-event-count]')?.textContent).toBe('3');
    const a = q('[data-event-card="a"]')!;
    // 모르는 라벨은 칩을 그리지 않는다
    expect([...a.querySelectorAll<HTMLElement>('[data-event-chip]')].map((c) => c.dataset.eventChip)).toEqual(['L1']);
    expect(a.querySelector('[data-event-alarm]')?.textContent).toContain('09:30');
    expect(a.querySelector('[data-due-badge]')).not.toBeNull();
    expect(a.querySelector('[data-event-links]')?.textContent).toContain('2');
    // 끝낸 일정은 체크·취소선
    expect(q('[data-event-card="b"]')!.dataset.eventDone).toBe('1');
    expect(q('[data-event-card="b"] [data-event-complete]')).toBeChecked();
  });

  it('☐ = 완료 (done·doneAt만 - 문서 하나), 안내 없이 Ctrl+Z 더미에', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    const before = undoCount(SID);
    await act(async () => fireEvent.click(q('[data-event-card="c"] [data-event-complete]')!));
    expect(written.batches).toHaveLength(1);
    const [op] = written.batches[0];
    expect(op).toMatchObject({ type: 'patch', at: { sid: SID, coll: 'items', id: 'c' } });
    expect(Object.keys((op as { changes: object }).changes).sort()).toEqual(['done', 'doneAt']);
    expect(undoCount(SID)).toBe(before + 1);
    expect(q('[data-toast]')).toBeNull();
  });

  it('라벨 칩을 눌러도 완료, 끝낸 일정은 풀기', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    await act(async () => fireEvent.click(q('[data-event-card="a"] [data-event-chip="L1"]')!));
    expect(written.batches[0][0]).toMatchObject({ changes: { done: true } });
    await act(async () => fireEvent.click(q('[data-event-card="b"] [data-event-complete]')!));
    expect(written.batches[1][0]).toMatchObject({ changes: { done: false, doneAt: undefined } });
    // 카드를 누른 것(수정 칸 열기)으로 번지지 않는다
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('▲▼ = 옮긴 일정의 order 하나만, 맨 위 ▲·맨 아래 ▼는 꺼짐', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    expect(q('[data-event-card="a"] [data-event-up]')).toBeDisabled();
    expect(q('[data-event-card="c"] [data-event-down]')).toBeDisabled();
    await act(async () => fireEvent.click(q('[data-event-card="c"] [data-event-up]')!));
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0]).toHaveLength(1);
    const op = written.batches[0][0] as { at: { id: string }; changes: Record<string, string> };
    expect(Object.keys(op.changes)).toEqual(['order']);
  });

  it('사본도 서버 소식도 없으면 받는 중, 받았는데 없으면 비었다고', () => {
    seed('loading', new Map());
    const { unmount } = render(<DayEvents date={DAY} />);
    expect(q('[data-event-waiting]')).not.toBeNull();
    unmount();
    seed('live', new Map());
    render(<DayEvents date={DAY} />);
    expect(q('[data-event-empty]')).not.toBeNull();
  });

  it('고치는 일정은 짚는다 (열린 일정 칸)', () => {
    seed();
    useWindows.setState({ windows: [{ key: 1, id: 'event', params: { sid: SID, date: DAY, id: 'c' }, openedAt: 1, raisedAt: 1 }] });
    render(<DayEvents date={DAY} />);
    expect(q('[data-event-card="c"]')!.className).toContain('ring-primary');
    expect(q('[data-event-card="a"]')!.className).not.toContain('ring-primary');
  });

  it('⏰ 표시 = 알림 시각 창, 바꾸거나 끄면 곧바로 저장 (time만)', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-event-card="a"] [data-event-alarm]')!);
    fireEvent.change(q('[data-alarm-time]')!, { target: { value: '1000' } });
    await act(async () => fireEvent.click(q('[data-alarm-save]')!));
    expect(written.batches[0][0]).toMatchObject({ type: 'patch', at: { id: 'a' }, changes: { time: '10:00' } });
    fireEvent.click(q('[data-event-card="a"] [data-event-alarm]')!);
    await act(async () => fireEvent.click(q('[data-alarm-off]')!));
    expect(written.batches[1][0]).toMatchObject({ changes: { time: undefined } });
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('▼ 접으면 카드와 + 추가를 숨긴다', () => {
    seed();
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-event-collapse]')!);
    expect(cards()).toEqual([]);
    expect(q('[data-event-add]')).toBeNull();
  });
});

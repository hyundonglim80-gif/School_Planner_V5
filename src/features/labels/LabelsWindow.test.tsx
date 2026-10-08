// 라벨 관리 창 - 탭·고친 것만 저장(이름 바꾸기 = 문서 하나)·추가는 곧바로·지우기·▲▼·상위·빈 라벨 정리·기본 라벨
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle } from '../../app/layoutPrefs';
import { anyWindowUnsaved } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { WriteOp } from '../../data/repo';
import LabelsWindow from './LabelsWindow';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
// 적기만 흉내 - 쓰기 묶음(WriteOp)을 남긴다
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  return {
    ...real,
    batch: vi.fn(async (ops: WriteOp[]) => {
      written.batches.push(ops);
      return [];
    }),
  };
});

const SID = 'u_me';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const labels = new Map<string, Record<string, unknown>>([
  ['e1', { ...base, kind: 'event', name: '회의', color: 'blue', parentId: null, order: 'a0', props: { calendar: true } }],
  ['e2', { ...base, kind: 'event', name: '행사', color: 'red', parentId: null, order: 'a1' }],
  ['w', { ...base, kind: 'note', name: '업무', color: 'green', parentId: null, order: 'a0' }],
  ['s', { ...base, kind: 'note', name: '학교', color: 'blue', parentId: null, order: 'a1' }],
  ['a', { ...base, kind: 'note', name: 'A초', color: 'gray', parentId: 's', order: 'a2' }],
  ['x', { ...base, kind: 'note', name: '빈것', color: 'gray', parentId: null, order: 'a3' }],
]);
const items = new Map<string, Record<string, unknown>>([
  ['m1', { ...base, kind: 'note', date: null, text: '메모', labelIds: ['w'], order: 'a0' }],
  ['r1', { ...base, kind: 'note', date: '2026-10-08', text: '기록', labelIds: ['a'], order: 'a0' }],
]);

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
const rowIds = () => qa('[data-label-row]').map((r) => r.dataset.labelRow);

function seed(opts: { labels?: Map<string, Record<string, unknown>>; status?: 'live' | 'loading' } = {}) {
  for (const [coll, docs] of [
    ['labels', opts.labels ?? labels],
    ['items', items],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, docs);
    setStatus(SID, coll, opts.status ?? 'live');
  }
}

const open = (tab?: 'event' | 'note') => render(<LabelsWindow params={tab ? { tab } : undefined} close={vi.fn()} raise={0} />);
const save = async () => {
  await act(async () => fireEvent.click(q('[data-label-save]')));
};

beforeEach(() => {
  resetHistoryForTest();
  resetMirrorStore();
  setPopupStyle('center');
  written.batches = [];
  useSession.setState({ loading: false, user: { uid: 'me', email: 'me@x', displayName: '', photoURL: '' } });
});

describe('라벨 관리 창', () => {
  it('탭 둘 - 일정 라벨이 먼저, ⚙️에서 그 탭으로 열 수 있다', () => {
    seed();
    open();
    expect(q('[data-label-tab="event"]')).toHaveAttribute('aria-selected', 'true');
    expect(rowIds()).toEqual(['e1', 'e2']);
    fireEvent.click(q('[data-label-tab="note"]'));
    // 하위는 제 상위 바로 뒤에
    expect(rowIds()).toEqual(['w', 's', 'a', 'x']);
    expect(q('[data-label-row="a"]').dataset.depth).toBe('1');
  });

  it('이름을 바꾸고 저장하면 그 라벨 문서 하나의 name만 쓴다 (끝 조건)', async () => {
    seed();
    open();
    fireEvent.change(q('[data-label-row="e2"] [data-label-name]'), { target: { value: '학교 행사' } });
    expect(anyWindowUnsaved()).toBe(true);
    await save();
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0]).toEqual([
      expect.objectContaining({ type: 'patch', at: { sid: SID, coll: 'labels', id: 'e2' }, changes: { name: '학교 행사' } }),
    ]);
    expect(anyWindowUnsaved()).toBe(false);
  });

  it('속성·색·▲▼·지우기를 한꺼번에 저장한다', async () => {
    seed();
    open();
    fireEvent.click(q('[data-label-row="e1"] [data-label-prop="forward"]'));
    fireEvent.click(q('[data-label-row="e2"] [data-label-up]'));
    expect(rowIds()).toEqual(['e2', 'e1']);
    fireEvent.click(q('[data-label-tab="note"]'));
    fireEvent.click(q('[data-label-row="x"] [data-label-delete]'));
    expect(rowIds()).toEqual(['w', 's', 'a']);
    await save();
    const ops = written.batches[0];
    expect(ops.map((o) => `${o.type}:${o.at.id}`).sort()).toEqual(['patch:e1', 'remove:x'].concat(ops.some((o) => o.at.id === 'e2') ? ['patch:e2'] : []).sort());
    const e1 = ops.find((o) => o.at.id === 'e1');
    expect(e1).toMatchObject({ changes: { props: { forward: true, calendar: true } } });
  });

  it('하위를 맨 위 단계로, 상위 후보는 맨 위 단계 라벨만(하위가 있으면 고를 수 없다)', async () => {
    seed();
    open('note');
    expect(q('[data-label-row="s"] [data-label-parent]')).toBeDisabled();
    const options = [...q('[data-label-row="x"] [data-label-parent]').querySelectorAll('option')].map((o) => o.value);
    expect(options).toEqual(['', 'w', 's']);
    fireEvent.change(q('[data-label-row="a"] [data-label-parent]'), { target: { value: '' } });
    await save();
    expect(written.batches[0]).toEqual([expect.objectContaining({ at: expect.objectContaining({ id: 'a' }), changes: { parentId: null } })]);
  });

  it('같은 이름이 둘이면 저장하지 않는다', async () => {
    seed();
    open();
    fireEvent.change(q('[data-label-row="e2"] [data-label-name]'), { target: { value: '회의' } });
    await save();
    expect(written.batches).toHaveLength(0);
    expect(anyWindowUnsaved()).toBe(true);
  });

  it('추가는 곧바로 저장한다 (메모·기록은 고른 상위 밑에)', async () => {
    seed();
    open('note');
    fireEvent.change(q('[data-label-new-name="note"]'), { target: { value: '#B초' } });
    fireEvent.change(q('[data-label-new-parent]'), { target: { value: 's' } });
    await act(async () => fireEvent.click(q('[data-label-add="note"]')));
    expect(written.batches[0]).toEqual([
      expect.objectContaining({ type: 'create', data: expect.objectContaining({ kind: 'note', name: 'B초', parentId: 's' }) }),
    ]);
    expect(q('[data-label-new-name="note"]')).toHaveValue('');
  });

  it('항목 수는 사본에서 바로 - 빈 라벨 정리는 고른 것만 지운다(맨 위·하위가 있는 상위는 처음에 빼 둔다)', async () => {
    seed();
    open('note');
    expect(q('[data-label-usage="s"]').dataset.total).toBe('1');
    expect(q('[data-label-usage="x"]').dataset.total).toBe('0');
    fireEvent.click(q('[data-label-prune]'));
    expect(qa('[data-label-prune-item]').map((c) => [c.dataset.labelPruneItem, (c as HTMLInputElement).checked])).toEqual([['x', true]]);
    await act(async () => fireEvent.click(q('[data-label-prune-confirm]')));
    expect(written.batches[0]).toEqual([{ type: 'remove', at: { sid: SID, coll: 'labels', id: 'x' } }]);
  });

  it('항목을 다 받기 전에는 세지 않는다 (덜 센 채로 비었다고 보이지 않게)', () => {
    seed({ status: 'loading' });
    open('note');
    expect(document.querySelector('[data-label-usage]')).toBeNull();
    expect(q('[data-label-prune]')).toBeDisabled();
  });

  it('라벨이 없으면 기본 라벨 넣기 (서버 확인 뒤에만)', async () => {
    seed({ labels: new Map() });
    open();
    await act(async () => fireEvent.click(q('[data-label-defaults="event"]')));
    expect(written.batches[0].map((o) => o.at.id)).toEqual(['dflt_e1', 'dflt_e2', 'dflt_e3', 'dflt_e4', 'dflt_e5']);
  });
});

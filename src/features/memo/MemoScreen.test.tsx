// 메모 화면 - 즐겨찾기로 열기(없으면 전체)·라벨로 보기(여러 개·상위 → 하위·기타)·숫자·진행/완료·전체 비우기·라벨 없는 메모·새 메모에 고른 라벨·ESC
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { handleAppKeyDown } from '../../app/keys';
import { useWindows } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { WriteOp } from '../../data/repo';
import { useLabelFilters } from '../notes/labelFilter';
import MemoScreen from './MemoScreen';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const record = async (ops: WriteOp[]) => {
    written.batches.push(ops);
    return ops;
  };
  return { ...real, batch: vi.fn(record), patch: vi.fn((at, c, b) => record([real.writeOp.patch(at, c, b)])), remove: vi.fn((at) => record([real.writeOp.remove(at)])) };
});
const opened = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock('../notes/open', async (orig) => {
  const real = await orig<typeof import('../notes/open')>();
  return { ...real, openNotePanel: vi.fn((p: unknown) => opened.calls.push(p)) };
});

const SID = 'u_me';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const labels = new Map<string, Record<string, unknown>>([
  ['P', { ...base, kind: 'note', name: '학교', color: 'blue', parentId: null, order: 'a0' }],
  ['C', { ...base, kind: 'note', name: 'A초', color: 'green', parentId: 'P', order: 'a1' }],
  ['U', { ...base, kind: 'note', name: '개인', color: 'red', parentId: null, order: 'a2' }],
]);
const memo = (id: string, order: string, more: Record<string, unknown> = {}) =>
  [id, { ...base, kind: 'note', date: null, text: `메모 ${id}`, labelIds: [], order, ...more }] as const;
const all = new Map<string, Record<string, unknown>>([
  memo('m1', 'a0', { labelIds: ['P'] }),
  memo('m2', 'a1', { labelIds: ['C'], favorite: true }),
  memo('m3', 'a2', { labelIds: ['U'] }),
  memo('m4', 'a3', { labelIds: ['U'], done: true }),
  memo('m5', 'a4'),
  ['rec', { ...base, kind: 'note', date: '2026-10-08', text: '기록', labelIds: [], order: 'a0' }],
]);

const q = (s: string) => document.querySelector<HTMLElement>(s);
const cards = () => [...document.querySelectorAll<HTMLElement>('[data-entry-card]')].map((c) => c.dataset.entryCard);

function seed(docs = all) {
  for (const [coll, d] of [
    ['labels', labels],
    ['items', docs],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, d);
    setStatus(SID, coll, 'live');
  }
}

beforeEach(() => {
  resetMirrorStore();
  useLabelFilters.setState({ memo: null });
  written.batches = [];
  opened.calls = [];
  useWindows.setState({ windows: [] });
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('메모 화면', () => {
  it('처음은 즐겨찾기, 즐겨찾기가 없으면 전체로 연다 (메모만 - 기록은 없다)', () => {
    seed();
    const { unmount } = render(<MemoScreen />);
    expect(q('[data-filter-chip="fav"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(cards()).toEqual(['m2']);
    unmount();
    resetMirrorStore();
    seed(new Map([memo('x', 'a0'), memo('y', 'a1')]));
    render(<MemoScreen />);
    expect(q('[data-filter-chip="all"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(cards()).toEqual(['x', 'y']);
  });

  it('라벨로 보기: 상위 = 하위 것도, Ctrl = 더하기, 기억, 숫자는 진행 중만, ESC = 전체', () => {
    seed();
    render(<MemoScreen />);
    expect(q('[data-filter-chip="U"]')?.textContent).toContain('1');
    fireEvent.click(q('[data-filter-chip="P"]')!);
    expect(cards()).toEqual(['m2', 'm1']);
    fireEvent.click(q('[data-filter-chip="U"]')!, { ctrlKey: true });
    expect(cards()).toEqual(['m2', 'm1', 'm3', 'm4']);
    expect(useLabelFilters.getState().memo).toEqual({ labels: ['P', 'U'], others: [] });
    act(() => handleAppKeyDown(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(useLabelFilters.getState().memo).toBe('all');
  });

  it("하위는 접혀 있고 ▸로 펴면 하위·'기타'(상위만 붙은 것)", () => {
    seed();
    render(<MemoScreen />);
    expect(q('[data-filter-chip="C"]')).toBeNull();
    fireEvent.click(q('[data-filter-caret="P"]')!);
    expect(q('[data-filter-chip="C"]')).not.toBeNull();
    fireEvent.click(q('[data-filter-chip="기타:P"]')!);
    expect(cards()).toEqual(['m1']);
  });

  it('진행·완료 구역, 완료 전체 비우기 = 한 묶음 지운 표시 + 되돌리기', async () => {
    useLabelFilters.setState({ memo: 'all' });
    seed();
    render(<MemoScreen />);
    expect(q('[data-memo-active]')?.dataset.memoActive).toBe('4');
    expect(q('[data-memo-done]')?.dataset.memoDone).toBe('1');
    await act(async () => fireEvent.click(q('[data-memo-clear-done]')!));
    expect(written.batches[0]).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'm4' } }]);
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
  });

  it("라벨 없는 메모 → '메모' 라벨을 만들어 붙인다 (한 묶음)", async () => {
    seed();
    render(<MemoScreen />);
    expect(q('[data-memo-unlabeled]')?.dataset.memoUnlabeled).toBe('1');
    await act(async () => fireEvent.click(q('[data-memo-label-unlabeled]')!));
    const [create, p] = written.batches[0] as { type: string; at: { coll: string; id: string }; data?: { name: string }; changes?: { labelIds: string[] } }[];
    expect(create).toMatchObject({ type: 'create', at: { coll: 'labels' }, data: { name: '메모' } });
    expect(p).toMatchObject({ type: 'patch', at: { id: 'm5' }, changes: { labelIds: [create.at.id] } });
  });

  it('+ 새 메모 = 날짜 없는 칸, 고른 라벨을 미리', () => {
    useLabelFilters.setState({ memo: { labels: ['U'], others: [] } });
    seed();
    render(<MemoScreen />);
    fireEvent.click(q('[data-memo-new]')!);
    expect(opened.calls).toEqual([{ sid: SID, date: null, labelIds: ['U'] }]);
  });
});

// 화면이 자료를 고르는 곳 - 날짜로·기간으로·라벨로·종류로·메모만·휴지통·라벨, 그리고 훅(지금 공간)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import {
  itemsBetween,
  itemsOfKind,
  itemsOn,
  itemsWithLabels,
  labelsOf,
  memos,
  trashOf,
  useItemsOn,
  useItemsWithLabels,
  useMemos,
  useMirrorStatus,
  type Docs,
} from './select';
import { applyBase, resetMirrorStore, setStatus, trackColl } from './mirror/store';
import { useSession } from './session';
import type { Stored } from './types';

// 지금 공간은 로그인 store에서 - Firebase는 띄우지 않는다
vi.mock('./firebase', () => ({ auth: {}, db: {} }));

const t = (s: number) => new Timestamp(s, 0);
type I = Stored<'items'>;

function item(id: string, fields: Partial<I>): I {
  return { id, kind: 'event', date: null, text: id, labelIds: [], order: 'a0', deletedAt: null, updatedAt: t(1), v: 1, createdAt: 0, authorId: 'me', ...fields } as I;
}
const docs = (...list: I[]): Docs<'items'> => Object.fromEntries(list.map((d) => [d.id, d]));
const ids = (list: { id: string }[]) => list.map((d) => d.id);

const sample = docs(
  item('e2', { date: '2026-10-08', order: 'a2' }),
  item('e1', { date: '2026-10-08', order: 'a1' }),
  item('r1', { kind: 'note', date: '2026-10-08', order: 'a0', labelIds: ['L1'] }),
  item('span', { date: '2026-10-06', endDate: '2026-10-09', order: 'a5' }),
  item('next', { date: '2026-10-09', order: 'a0', labelIds: ['L2'] }),
  item('m1', { kind: 'note', date: null, order: 'b0', labelIds: ['L1', 'L2'] }),
  item('m0', { kind: 'note', date: null, order: 'a0' }),
  item('gone', { date: '2026-10-08', deletedAt: t(9) }),
  item('gone2', { kind: 'note', date: null, deletedAt: t(3) }),
);

describe('고르기 (순수)', () => {
  it('날짜로: 그날 것 + 그날이 든 기간 일정, 차례대로, 지운 것은 빼고', () => {
    expect(ids(itemsOn(sample, '2026-10-08'))).toEqual(['r1', 'e1', 'e2', 'span']);
    expect(ids(itemsOn(sample, '2026-10-08', 'event'))).toEqual(['e1', 'e2', 'span']);
    expect(ids(itemsOn(sample, '2026-10-06'))).toEqual(['span']);
    expect(ids(itemsOn(sample, '2026-10-10'))).toEqual([]);
  });

  it('기간으로: 걸친 것을 날짜 다음 차례로', () => {
    expect(ids(itemsBetween(sample, '2026-10-09', '2026-10-31'))).toEqual(['span', 'next']);
    expect(ids(itemsBetween(sample, '2026-10-01', '2026-10-07'))).toEqual(['span']);
    expect(ids(itemsBetween(sample, '2026-10-08', '2026-10-08', 'note'))).toEqual(['r1']);
  });

  it('라벨로: 하나라도 붙은 것 (없으면 빈 목록)', () => {
    expect(ids(itemsWithLabels(sample, ['L2']))).toEqual(['next', 'm1']);
    expect(ids(itemsWithLabels(sample, ['L1', 'L2'], 'note'))).toEqual(['r1', 'm1']);
    expect(itemsWithLabels(sample, [])).toEqual([]);
  });

  it('종류로·메모만 (날짜 없는 메모·기록)', () => {
    expect(ids(itemsOfKind(sample, 'note'))).toEqual(['m0', 'r1', 'm1']); // 차례가 같으면 id로
    expect(ids(memos(sample))).toEqual(['m0', 'm1']);
  });

  it('휴지통: 지운 것만, 늦게 지운 것부터', () => {
    expect(ids(trashOf(sample))).toEqual(['gone', 'gone2']);
  });

  it('라벨: 지운 것 빼고 차례대로, 종류로', () => {
    const labels = {
      b: { id: 'b', kind: 'note', name: 'B', order: 'a1', deletedAt: null },
      a: { id: 'a', kind: 'note', name: 'A', order: 'a0', deletedAt: null },
      e: { id: 'e', kind: 'event', name: 'E', order: 'a0', deletedAt: null },
      x: { id: 'x', kind: 'note', name: 'X', order: 'a2', deletedAt: t(1) },
    } as unknown as Docs<'labels'>;
    expect(ids(labelsOf(labels))).toEqual(['a', 'e', 'b']);
    expect(ids(labelsOf(labels, 'note'))).toEqual(['a', 'b']);
  });

  it('같은 문서 표면 찾아보기를 다시 만들지 않는다 (같은 목록)', () => {
    expect(memos(sample)).toBe(memos(sample));
  });
});

describe('훅 (지금 공간 = 개인 공간)', () => {
  afterEach(() => {
    resetMirrorStore();
    useSession.setState({ loading: false, user: null });
  });

  it('기기 사본이 바뀌면 다시 고르고, 바뀌지 않으면 같은 목록', () => {
    useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
    trackColl('u_me', 'items');
    const day = renderHook(() => useItemsOn('2026-10-08'));
    const memo = renderHook(() => useMemos());
    expect(day.result.current).toEqual([]);
    act(() => {
      applyBase('u_me', 'items', new Map([['a', { ...item('a', { date: '2026-10-08' }), id: undefined }]]));
    });
    expect(ids(day.result.current)).toEqual(['a']);
    const before = memo.result.current;
    memo.rerender();
    expect(memo.result.current).toBe(before);
  });

  it('라벨로 보기는 배열이 새것이어도 같은 라벨이면 같은 목록', () => {
    useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
    trackColl('u_me', 'items');
    act(() => {
      applyBase('u_me', 'items', new Map([['m', { ...item('m', { kind: 'note', labelIds: ['L'] }), id: undefined }]]));
    });
    const h = renderHook(() => useItemsWithLabels(['L']));
    const first = h.result.current;
    h.rerender();
    expect(h.result.current).toBe(first);
    expect(ids(first)).toEqual(['m']);
  });

  it('받기 상태', () => {
    useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
    const h = renderHook(() => useMirrorStatus('items'));
    expect(h.result.current).toBe('idle');
    act(() => {
      trackColl('u_me', 'items');
      setStatus('u_me', 'items', 'live');
    });
    expect(h.result.current).toBe('live');
  });
});

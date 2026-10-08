import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { batch } from './repo';
import { useSession } from './session';
import { clearUndo, recordUndo, undoCount, undoLast, UNDO_LIMIT, watchUndoOwner } from './undo';
import { ShownError } from '../app/toast';
import type { Undo } from './repo';

vi.mock('./firebase', () => ({ auth: {}, db: {} }));
vi.mock('./repo', () => ({ batch: vi.fn(async () => []) }));

const sid = 'u_me';
const undoOf = (id: string): Undo => [{ type: 'restore', at: { sid, coll: 'items', id } }];

const toasts = () => [...document.querySelectorAll('[data-toast]')].map((t) => t.textContent ?? '');
const flush = () => act(async () => {});

beforeEach(() => {
  clearUndo();
  vi.mocked(batch).mockReset().mockResolvedValue([]);
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('되돌리기', () => {
  it('안내에 되돌리기 단추가 붙고, 누르면 되돌리는 쓰기를 적는다', async () => {
    recordUndo(sid, '🗑️ 메모를 지웠습니다.', undoOf('a'));
    const btn = document.querySelector<HTMLButtonElement>('[data-toast-action="되돌리기"]')!;
    expect(btn).not.toBeNull();
    btn.click();
    await flush();
    expect(batch).toHaveBeenCalledWith(undoOf('a'), expect.anything());
    expect(toasts().some((t) => t.includes('↩️ 되돌렸습니다.'))).toBe(true);
    // 단추로 되돌린 것은 Ctrl+Z 더미에서도 빠진다
    expect(undoCount(sid)).toBe(0);
  });

  it('Ctrl+Z(undoLast)는 지금 공간의 마지막 것부터', async () => {
    recordUndo(sid, '하나', undoOf('a'), { what: '메모 지우기' });
    recordUndo(sid, '둘', undoOf('b'), { what: '일정 옮기기' });
    expect(await undoLast()).toBe(true);
    expect(batch).toHaveBeenLastCalledWith(undoOf('b'), expect.anything());
    expect(toasts().some((t) => t.includes('되돌렸습니다 - 일정 옮기기'))).toBe(true);
    expect(await undoLast()).toBe(true);
    expect(batch).toHaveBeenLastCalledWith(undoOf('a'), expect.anything());
    expect(await undoLast()).toBe(false);
    expect(toasts().some((t) => t.includes('되돌릴 것이 없습니다'))).toBe(true);
  });

  it('Ctrl+Z로 되돌린 것은 안내 단추를 눌러도 다시 되돌리지 않는다', async () => {
    recordUndo(sid, '하나', undoOf('a'));
    await undoLast();
    document.querySelector<HTMLButtonElement>('[data-toast-action="되돌리기"]')?.click();
    await flush();
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it('공간마다 따로, 20개까지', async () => {
    for (let i = 0; i < UNDO_LIMIT + 5; i++) recordUndo(sid, `${i}`, undoOf(`a${i}`));
    recordUndo('g_x', '그룹', undoOf('g'));
    expect(undoCount(sid)).toBe(UNDO_LIMIT);
    expect(undoCount('g_x')).toBe(1);
    await undoLast('g_x');
    expect(batch).toHaveBeenLastCalledWith(undoOf('g'), expect.anything());
    expect(undoCount(sid)).toBe(UNDO_LIMIT);
  });

  it('되돌리기가 실패하면 안내하고 더미 맨 위로 돌려놓는다 (다시 해 볼 수 있게)', async () => {
    recordUndo(sid, '하나', undoOf('a'));
    vi.mocked(batch).mockRejectedValueOnce(new ShownError('되돌리지 못했습니다.'));
    expect(await undoLast()).toBe(false);
    expect(undoCount(sid)).toBe(1);
    expect(await undoLast()).toBe(true);
    expect(undoCount(sid)).toBe(0);
  });

  it('되돌릴 쓰기가 없으면 단추 없이 알리기만', () => {
    recordUndo(sid, '알림만', []);
    expect(document.querySelector('[data-toast-action]')).toBeNull();
    expect(undoCount(sid)).toBe(0);
  });

  it('로그인한 사람이 바뀌면 더미를 비운다', () => {
    const stop = watchUndoOwner();
    recordUndo(sid, '하나', undoOf('a'));
    useSession.setState({ user: { uid: 'other', email: '', displayName: '', photoURL: '' } });
    expect(undoCount(sid)).toBe(0);
    stop();
  });

  it('로그인 전에는 되돌릴 공간이 없다', async () => {
    useSession.setState({ user: null });
    expect(await undoLast()).toBe(false);
    expect(batch).not.toHaveBeenCalled();
  });
});

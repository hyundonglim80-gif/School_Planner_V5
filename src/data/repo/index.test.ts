import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeBatch } from 'firebase/firestore';
import { BATCH_LIMIT, batch, create, newPath, patch, purge, remove, restore, writeOp, writeOps } from './index';
import { ShownError } from '../../app/toast';
import type { Item } from '../types';

const fb = vi.hoisted(() => ({ auth: { currentUser: { uid: 'me' } as { uid: string } | null }, db: {} }));
vi.mock('../firebase', () => fb);

// 묶음 쓰기를 흉내 낸다 - 무엇을 어디에 적었나를 남긴다
const written = vi.hoisted(() => ({ batches: [] as { kind: string; path: string; data?: unknown }[][], fail: null as Error | null }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  serverTimestamp: () => 'SERVER_TIME',
  deleteField: () => 'DELETE_FIELD',
  writeBatch: vi.fn(() => {
    const ops: { kind: string; path: string; data?: unknown }[] = [];
    return {
      set: (ref: { path: string }, data: unknown) => ops.push({ kind: 'set', path: ref.path, data }),
      update: (ref: { path: string }, data: unknown) => ops.push({ kind: 'update', path: ref.path, data }),
      delete: (ref: { path: string }) => ops.push({ kind: 'delete', path: ref.path }),
      commit: async () => {
        if (written.fail) throw written.fail;
        written.batches.push(ops);
      },
    };
  }),
}));

const at = { sid: 'u_me', coll: 'items' as const, id: 'abc' };
const note: Omit<Item, 'updatedAt' | 'v' | 'createdAt' | 'authorId' | 'deletedAt' | 'deletedBy'> = {
  kind: 'note',
  date: null,
  text: '메모',
  labelIds: [],
  order: 'a0',
};

beforeEach(() => {
  written.batches = [];
  written.fail = null;
  fb.auth.currentUser = { uid: 'me' };
  vi.mocked(writeBatch).mockClear();
  document.body.innerHTML = '';
});

describe('저장 도우미', () => {
  it('newPath: 그 공간·컬렉션에 새 id (20자)', () => {
    const p = newPath('u_me', 'items');
    expect(p).toMatchObject({ sid: 'u_me', coll: 'items' });
    expect(p.id).toMatch(/^[A-Za-z0-9]{20}$/);
  });

  it('만들기: 서버 시각·지운 표시 null을 붙여 적고, 되돌리기 = 지운 표시', async () => {
    const undo = await create(at, note);
    expect(written.batches).toHaveLength(1);
    const [w] = written.batches[0];
    expect(w).toMatchObject({ kind: 'set', path: 'spaces/u_me/items/abc' });
    expect(w.data).toMatchObject({ ...note, authorId: 'me', deletedAt: null, updatedAt: 'SERVER_TIME', v: 1 });
    expect(undo).toEqual([{ type: 'remove', at }]);
  });

  it('칸 바꾸기: undefined는 deleteField로', async () => {
    const undo = await patch(at, { text: '새 글', time: undefined }, { text: '옛 글', time: '09:00' });
    expect(written.batches[0][0]).toEqual({
      kind: 'update',
      path: 'spaces/u_me/items/abc',
      data: { text: '새 글', time: 'DELETE_FIELD', updatedAt: 'SERVER_TIME' },
    });
    expect(undo[0]).toMatchObject({ type: 'patch', changes: { text: '옛 글', time: '09:00' } });
  });

  it('지우기·되살리기·영구 지우기', async () => {
    await remove(at);
    await restore(at);
    await purge(at, { ...note } as Item);
    expect(written.batches.map((b) => b[0].kind)).toEqual(['update', 'update', 'delete']);
    expect(written.batches[0][0].data).toEqual({ deletedAt: 'SERVER_TIME', deletedBy: 'me', updatedAt: 'SERVER_TIME' });
    expect(written.batches[1][0].data).toEqual({ deletedAt: null, deletedBy: 'DELETE_FIELD', updatedAt: 'SERVER_TIME' });
  });

  it('되돌리는 쓰기를 그대로 batch에 넣으면 되돌아간다', async () => {
    const undo = await remove(at);
    await batch(undo);
    expect(written.batches[1][0].data).toMatchObject({ deletedAt: null });
  });

  it('여럿은 한 묶음으로, 한도를 넘으면 나눠 적는다', async () => {
    await batch([writeOp.remove(at), writeOp.remove({ ...at, id: 'def' })]);
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0]).toHaveLength(2);

    written.batches = [];
    const many = Array.from({ length: BATCH_LIMIT + 3 }, (_, i) => writeOp.remove({ ...at, id: `id${i}` }));
    const undo = await batch(many);
    expect(written.batches.map((b) => b.length)).toEqual([BATCH_LIMIT, 3]);
    expect(undo).toHaveLength(BATCH_LIMIT + 3);
  });

  it('⚠️ 실패하면 안내하고 던진다 (삼키면 칸이 닫히며 글이 사라진다 - V4)', async () => {
    written.fail = Object.assign(new Error('offline'), { code: 'unavailable' });
    await expect(create(at, note)).rejects.toBeInstanceOf(ShownError);
    expect(document.querySelector('[data-toast="error"]')?.textContent).toMatch(/저장하지 못했습니다/);
  });

  it('부르는 쪽이 준 실패 안내를 쓴다', async () => {
    written.fail = new Error('x');
    await expect(remove(at, { fail: '일정을 지우지 못했습니다.' })).rejects.toThrow('일정을 지우지 못했습니다.');
  });

  it('로그인이 풀렸으면 적지 않고 안내한다', async () => {
    fb.auth.currentUser = null;
    await expect(create(at, note)).rejects.toThrow(/로그인이 풀려/);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('writeOps는 안내 없이 원래 오류를 던진다 (뒤에서 맞추는 설정 동기화)', async () => {
    written.fail = Object.assign(new Error('denied'), { code: 'permission-denied' });
    await expect(writeOps([writeOp.remove(at)])).rejects.toMatchObject({ code: 'permission-denied' });
    expect(document.querySelector('[data-toast]')).toBeNull();
  });

  it('빈 묶음은 아무것도 적지 않는다', async () => {
    expect(await batch([])).toEqual([]);
    expect(writeBatch).not.toHaveBeenCalled();
  });
});

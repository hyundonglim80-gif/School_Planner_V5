import { describe, it, expect } from 'vitest';
import { DELETE_FIELD, failMessage, SERVER_TIME, toWrite, undoOf, undoOfAll, valueAt, writeOp, type WriteOp } from './ops';
import type { DocPath, Item } from '../types';

const at: DocPath<'items'> = { sid: 'u_me', coll: 'items', id: 'abc' };
const ctx = { uid: 'me', now: 1000 };

const note = { kind: 'note', date: null, text: '메모', labelIds: [], order: 'a0' } as const;

describe('toWrite - 무엇을 적나', () => {
  it('만들기: 서버 시각·판·만든 때·만든 사람·지운 표시 null을 붙인다', () => {
    expect(toWrite(writeOp.create(at, { ...note, labelIds: [] }), ctx)).toEqual({
      kind: 'set',
      path: 'spaces/u_me/items/abc',
      data: {
        ...note,
        createdAt: 1000,
        authorId: 'me',
        deletedAt: null,
        updatedAt: SERVER_TIME,
        v: 1,
      },
    });
  });

  it('칸 바꾸기: 바꾼 칸과 서버 시각만, undefined는 칸 지우기, 점은 깊은 칸', () => {
    const op = writeOp.patch<'items'>(at, { text: '새 글', time: undefined, 'props.forward': false }, {});
    expect(toWrite(op, ctx)).toEqual({
      kind: 'update',
      path: 'spaces/u_me/items/abc',
      data: { text: '새 글', time: DELETE_FIELD, 'props.forward': false, updatedAt: SERVER_TIME },
    });
  });

  it('지우기 = 지운 표시 (누가 지웠나와 함께)', () => {
    expect(toWrite(writeOp.remove(at), ctx)).toEqual({
      kind: 'update',
      path: 'spaces/u_me/items/abc',
      data: { deletedAt: SERVER_TIME, deletedBy: 'me', updatedAt: SERVER_TIME },
    });
  });

  it('되살리기: 지운 표시를 null로, 지운 사람 칸은 뺀다', () => {
    expect(toWrite(writeOp.restore(at), ctx).kind).toBe('update');
    expect((toWrite(writeOp.restore(at), ctx) as { data: unknown }).data).toEqual({
      deletedAt: null,
      deletedBy: DELETE_FIELD,
      updatedAt: SERVER_TIME,
    });
  });

  it('통째로 적기: 들어온 서버 시각·판은 버리고 새로 붙인다', () => {
    const op = writeOp.put({ sid: 'u_me', coll: 'settings', id: 'pc' }, { fontScale: 1.1, updatedAt: 'old', v: 9 });
    expect(toWrite(op, ctx)).toEqual({
      kind: 'set',
      path: 'spaces/u_me/settings/pc',
      data: { fontScale: 1.1, updatedAt: SERVER_TIME, v: 1 },
    });
  });

  it('영구 지우기는 문서를 지운다', () => {
    expect(toWrite(writeOp.purge(at, {} as Item), ctx)).toEqual({ kind: 'delete', path: 'spaces/u_me/items/abc' });
  });

  it('저장 도우미가 붙이는 칸을 기능 코드가 쓰면 던진다', () => {
    expect(() => writeOp.create(at, { ...note, deletedAt: null } as never)).toThrow(/deletedAt/);
    expect(() => writeOp.patch(at, { updatedAt: 1 } as never, {})).toThrow(/updatedAt/);
    expect(() => writeOp.patch(at, { 'deletedAt.x': 1 }, {})).toThrow(/deletedAt/);
  });

  it('바꿀 칸이 없는 patch는 던진다 (서버 시각만 바뀌어 사본을 흔들지 않게)', () => {
    expect(() => writeOp.patch(at, {}, {})).toThrow();
  });
});

describe('undoOf - 되돌리는 쓰기', () => {
  it('만들기 → 지운 표시 (영구로 지우지 않는다 - 다른 기기 사본이 모른다)', () => {
    expect(undoOf(writeOp.create(at, note as never))).toEqual([{ type: 'remove', at }]);
  });

  it('지우기 ↔ 되살리기', () => {
    expect(undoOf(writeOp.remove(at))).toEqual([{ type: 'restore', at }]);
    expect(undoOf(writeOp.restore(at))).toEqual([{ type: 'remove', at }]);
  });

  it('칸 바꾸기 → 고치기 전 값으로, 없던 칸은 지우기', () => {
    const before: Partial<Item> = { text: '옛 글', time: '09:00', props: { forward: true } };
    const op = writeOp.patch<'items'>(at, { text: '새 글', due: '2026-10-09', 'props.forward': false }, before);
    const [back] = undoOf(op);
    expect(back).toEqual({
      type: 'patch',
      at,
      changes: { text: '옛 글', due: undefined, 'props.forward': true },
      before: { text: '새 글', due: '2026-10-09', 'props.forward': false },
    });
    // 되돌리는 쓰기를 적으면 없던 칸은 지운다
    expect((toWrite(back, ctx) as { data: Record<string, unknown> }).data.due).toBe(DELETE_FIELD);
    // 되돌리기의 되돌리기는 다시 바꾼 값
    expect(undoOf(back)[0]).toMatchObject({ changes: { text: '새 글', due: '2026-10-09', 'props.forward': false } });
  });

  it('영구 지우기 → 그 문서 그대로 다시 적기 (서버 시각만 새로)', () => {
    const doc = { ...note, createdAt: 5, authorId: 'me', deletedAt: 'T', updatedAt: 'T2', v: 1 } as unknown as Item;
    const [back] = undoOf(writeOp.purge(at, doc));
    expect(back).toEqual({
      type: 'put',
      at,
      data: { ...note, createdAt: 5, authorId: 'me', deletedAt: 'T' },
      before: null,
    });
    // 그것을 되돌리면 다시 영구 지우기
    expect(undoOf(back)[0].type).toBe('purge');
  });

  it('통째로 적기: 있던 문서로, 없었으면 지우기', () => {
    const s = { sid: 'u_me', coll: 'settings', id: 'pc' } as const;
    expect(undoOf(writeOp.put(s, { a: 2 }, { a: 1, updatedAt: 'T', v: 1 } as never))[0]).toEqual({
      type: 'put',
      at: s,
      data: { a: 1 },
      before: { a: 2 },
    });
    expect(undoOf(writeOp.put(s, { a: 2 }))[0]).toEqual({ type: 'purge', at: s, before: { a: 2 } });
  });

  it('여럿이면 나중 것부터 되돌린다', () => {
    const a2 = { ...at, id: 'def' };
    const ops: WriteOp[] = [writeOp.create(at, note as never), writeOp.remove(a2)];
    expect(undoOfAll(ops)).toEqual([
      { type: 'restore', at: a2 },
      { type: 'remove', at },
    ]);
  });
});

describe('그 밖', () => {
  it('valueAt: 점으로 깊은 칸', () => {
    expect(valueAt({ periods: { '3': { memo: '준비물' } } }, 'periods.3.memo')).toBe('준비물');
    expect(valueAt({ periods: {} }, 'periods.3.memo')).toBeUndefined();
    expect(valueAt({ a: 1 }, 'a.b')).toBeUndefined();
  });

  it('실패 안내는 쓰기 종류로', () => {
    expect(failMessage([writeOp.remove(at)])).toMatch(/지우지 못했/);
    expect(failMessage([writeOp.restore(at)])).toMatch(/되살리지 못했/);
    expect(failMessage([writeOp.create(at, note as never)])).toMatch(/저장하지 못했/);
  });

  it('화면이 든 문서의 자리(id)는 적지 않는다 - 만들기·통째로·영구 지우기 되돌리기 (P2-2)', () => {
    const shown = { ...note, id: 'x1' } as never;
    expect((toWrite(writeOp.create(at, shown), ctx) as { data: object }).data).not.toHaveProperty('id');
    expect((toWrite(writeOp.put(at, shown), ctx) as { data: object }).data).not.toHaveProperty('id');
    const [back] = undoOf(writeOp.purge(at, { ...note, id: 'x1', updatedAt: 1, v: 1 } as never));
    expect((back as { data: object }).data).not.toHaveProperty('id');
    expect(() => writeOp.patch(at, { id: 'y' } as never, {})).toThrow(/자리/);
  });
});


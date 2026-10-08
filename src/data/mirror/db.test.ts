// 기기 사본 저장소 (fake-indexeddb). 두 탭 = 같은 DB에 연결 둘.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { deleteMirrorDb, emptyMeta, mergeMeta, mirrorDbName, openMirrorDb, type MirrorDb } from './db';

const t = (s: number) => new Timestamp(s, 0);
const doc = (text: string, s: number, extra: Record<string, unknown> = {}) => ({ text, updatedAt: t(s), deletedAt: null, ...extra });

let n = 0;
const opened: MirrorDb[] = [];
async function open(uid: string, onLost = vi.fn()) {
  const db = await openMirrorDb(uid, onLost);
  opened.push(db);
  return db;
}
const freshUid = () => `db-test-${++n}-${Date.now()}`;

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  vi.unstubAllGlobals();
});

describe('기기 사본 저장소', () => {
  it('공간·컬렉션마다 넣고 꺼낸다 - 시각은 Timestamp로 되살아난다', async () => {
    const uid = freshUid();
    const db = await open(uid);
    await db.save('u_a', 'items', new Map([['x', doc('하나', 10, { deletedAt: t(9) })]]), [], { cursor: t(10), complete: true });
    await db.save('u_a', 'labels', new Map([['l', doc('라벨', 3)]]), [], null);
    await db.save('u_b', 'items', new Map([['y', doc('다른 공간', 4)]]), [], null);

    const { docs, meta } = await db.load('u_a', 'items');
    expect([...docs.keys()]).toEqual(['x']);
    expect(docs.get('x')!.deletedAt).toBeInstanceOf(Timestamp);
    expect(meta.cursor?.isEqual(t(10))).toBe(true);
    expect(meta.complete).toBe(true);
    expect([...(await db.load('u_a', 'labels')).docs.keys()]).toEqual(['l']);
    expect((await db.load('u_a', 'labels')).meta).toEqual(emptyMeta());
    expect([...(await db.load('u_b', 'items')).docs.keys()]).toEqual(['y']);
  });

  it('두 탭이 함께 적어도 늦은 판이 이기고 커서는 뒤로 가지 않는다', async () => {
    const uid = freshUid();
    const tabA = await open(uid);
    const tabB = await open(uid);
    await tabB.save('u_a', 'items', new Map([['x', doc('새 판', 20)]]), [], { cursor: t(20), complete: true });
    // A가 늦게 받은 옛 판을 뒤에 적는다
    await tabA.save('u_a', 'items', new Map([['x', doc('옛 판', 10)]]), [], { cursor: t(10), complete: false });
    const { docs, meta } = await tabA.load('u_a', 'items');
    expect(docs.get('x')!.text).toBe('새 판');
    expect(meta.cursor?.isEqual(t(20))).toBe(true);
    expect(meta.complete).toBe(true);
    // 같은 판은 덮는다 (겹쳐 받기)
    await tabA.save('u_a', 'items', new Map([['x', doc('새 판 다시', 20)]]), [], null);
    expect((await tabB.load('u_a', 'items')).docs.get('x')!.text).toBe('새 판 다시');
  });

  it('빼기는 그 판까지만 - 그 사이 더 늦은 판(영구 지우기를 되돌림)이 적혔으면 둔다', async () => {
    const db = await open(freshUid());
    await db.save('u_a', 'items', new Map([['x', doc('되살림', 30)], ['y', doc('지울 것', 5)]]), [], null);
    await db.save('u_a', 'items', new Map(), [{ id: 'x', upTo: t(10) }, { id: 'y', upTo: t(5) }, { id: 'none', upTo: null }], null);
    expect([...(await db.load('u_a', 'items')).docs.keys()]).toEqual(['x']);
  });

  it('받기 상태 합치기: 커서·이어 받을 자리는 늦은 쪽, 다 받음은 한쪽만 참이어도 참', () => {
    const a = { cursor: t(5), after: { at: t(5), id: 'b' }, complete: true, prunedAt: 100 };
    const m = mergeMeta(a, { cursor: t(3), after: { at: t(5), id: 'a' }, complete: false, prunedAt: 50 });
    expect(m).toEqual(a);
    expect(mergeMeta(emptyMeta(), { after: { at: t(1), id: 'z' } }).after).toEqual({ at: t(1), id: 'z' });
    expect(mergeMeta(a, { cursor: null }).cursor).toBe(a.cursor);
  });

  it('IndexedDB가 없으면 던진다 (부르는 쪽이 메모리로만)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(openMirrorDb(freshUid(), vi.fn())).rejects.toThrow('IndexedDB가 없다');
    await expect(deleteMirrorDb('x')).resolves.toBeUndefined();
  });

  it('열기가 막혀 오래 걸리면 던진다', async () => {
    const uid = freshUid();
    // 다른 탭이 지우는 중인데 또 다른 연결이 비켜 주지 않는다 → 그 뒤의 열기는 기다리기만 한다
    const holder = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open(mirrorDbName(uid), 1);
      req.onsuccess = () => resolve(req.result);
    });
    indexedDB.deleteDatabase(mirrorDbName(uid));
    await expect(openMirrorDb(uid, vi.fn(), 200)).rejects.toThrow('끝나지 않았다');
    holder.close();
  });

  it('다른 탭이 사본을 지우면 이 연결은 비켜 주고 잃었다고 알린다 - 그 뒤 쓰기는 던진다', async () => {
    const uid = freshUid();
    const onLost = vi.fn();
    const db = await open(uid, onLost);
    await db.save('u_a', 'items', new Map([['x', doc('하나', 1)]]), [], null);
    await deleteMirrorDb(uid);
    expect(onLost).toHaveBeenCalledTimes(1);
    await expect(db.save('u_a', 'items', new Map([['y', doc('둘', 2)]]), [], null)).rejects.toThrow('잃었다');
    // 새로 열면 빈 사본
    const again = await open(uid);
    expect((await again.load('u_a', 'items')).docs.size).toBe(0);
  });
});

// 기기 사본 맞추기 - 흉내 낸 서버 + fake-indexeddb.
// 처음 받기(이번 학년도 먼저·쪽 나눠·끊기면 이어서) · 사본으로 먼저 그리기 · 구독(커서 - 1분) · 빠짐 확인 · 지운 항목 견주기 ·
// 고장 대비(사본이 없음·잃음·적기 실패에도 서버 구독은 그대로) · 다시 받기.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { writeOp } from '../repo/ops';
import { deleteMirrorDb, openMirrorDb } from './db';
import { OfflineError, type MirrorServer, type ServerBatch, type ServerPage } from './server';
import { beginLocalWrite, useMirror, type Plain } from './store';
import { MIRRORED, mirrorEngine, OVERLAP_MS, PRUNE_EVERY_MS, resetMirror, startMirror, stopMirror, wipeMirror } from './sync';

// 진짜 Firebase 앱을 띄우지 않는다 - 띄우면 시험이 끝난 뒤 Firebase가 IndexedDB를 열다 jsdom이 걷혀 '처리하지 않은 오류'가 가끔 남는다(PLAN 5장 'P3-1 테스트와 Firebase')
vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const t = (s: number) => new Timestamp(s, 0);

interface Listener {
  key: string;
  since: Timestamp | null;
  onBatch: (b: ServerBatch) => void;
}

/** 서버 흉내: 쓰면 updatedAt이 1초씩 늘고, 구독에 알린다. 영구 지우기는 결과에서 '빠짐'으로 */
class FakeServer implements MirrorServer {
  clock = 1_000_000;
  data = new Map<string, Map<string, Plain>>();
  listeners = new Set<Listener>();
  calls = { pages: [] as { coll: string; from: number | null }[], fromDate: [] as { coll: string; date: string }[], fetchOne: [] as string[], deletedIds: 0 };
  /** 이 수만큼 쪽을 준 뒤 연결이 끊긴다 */
  failAfterPages: number | null = null;
  /** 구독의 첫 소식을 붙잡아 둔다 (사본으로 먼저 그리는지 보려고) */
  holdListen: Promise<void> | null = null;

  private coll(sid: string, coll: string) {
    const key = `${sid}/${coll}`;
    if (!this.data.has(key)) this.data.set(key, new Map());
    return this.data.get(key)!;
  }

  /** 구독 결과 전체(since보다 늦은 것)에서 가장 늦은 판 - Firestore가 주는 것과 같다 */
  private latestFor(l: Listener) {
    let max: Timestamp | null = null;
    for (const d of this.data.get(l.key)?.values() ?? []) {
      const at = d.updatedAt as Timestamp;
      if ((!l.since || at.seconds > l.since.seconds) && (!max || at.seconds > max.seconds)) max = at;
    }
    return max;
  }

  write(sid: string, coll: string, id: string, fields: Plain | null) {
    const map = this.coll(sid, coll);
    if (fields === null) {
      map.delete(id);
      for (const l of this.listeners) {
        if (l.key === `${sid}/${coll}`) l.onBatch({ docs: new Map(), removed: [id], fromCache: false, latest: this.latestFor(l) });
      }
      return;
    }
    const doc = { deletedAt: null, v: 1, ...fields, updatedAt: t(++this.clock) };
    map.set(id, doc);
    for (const l of this.listeners) {
      if (l.key === `${sid}/${coll}`) l.onBatch({ docs: new Map([[id, doc]]), removed: [], fromCache: false, latest: this.latestFor(l) });
    }
    return doc;
  }

  private sorted(sid: string, coll: string) {
    return [...this.coll(sid, coll)].sort(
      ([ia, a], [ib, b]) => (a.updatedAt as Timestamp).seconds - (b.updatedAt as Timestamp).seconds || (ia < ib ? -1 : 1),
    );
  }

  private async *chunk(rows: [string, Plain][], size: number): AsyncGenerator<ServerPage> {
    let given = 0;
    for (let i = 0; i < rows.length || i === 0; i += size) {
      await Promise.resolve();
      if (this.failAfterPages !== null && given >= this.failAfterPages) throw new OfflineError();
      const part = rows.slice(i, i + size);
      const last = part.at(-1);
      given++;
      yield { docs: new Map(part), last: last ? { at: last[1].updatedAt as Timestamp, id: last[0] } : null };
      if (part.length < size) return;
    }
  }

  pages(sid: string, coll: string, from: Timestamp | null, size: number) {
    this.calls.pages.push({ coll, from: from?.seconds ?? null });
    return this.chunk(
      this.sorted(sid, coll).filter(([, d]) => !from || (d.updatedAt as Timestamp).seconds >= from.seconds),
      size,
    );
  }

  pagesFromDate(sid: string, coll: string, fromDate: string, size: number) {
    this.calls.fromDate.push({ coll, date: fromDate });
    return this.chunk(
      this.sorted(sid, coll).filter(([, d]) => typeof d.date === 'string' && d.date >= fromDate),
      size,
    );
  }

  listen(sid: string, coll: string, since: Timestamp | null, onBatch: (b: ServerBatch) => void) {
    const l: Listener = { key: `${sid}/${coll}`, since, onBatch };
    const first = new Map(this.sorted(sid, coll).filter(([, d]) => !since || (d.updatedAt as Timestamp).seconds > since.seconds));
    void (this.holdListen ?? Promise.resolve()).then(() => {
      if (!this.listeners.has(l)) return;
      onBatch({ docs: first, removed: [], fromCache: false, latest: this.latestFor(l) });
    });
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  async fetchOne(sid: string, coll: string, id: string) {
    this.calls.fetchOne.push(id);
    return this.coll(sid, coll).get(id) ?? null;
  }

  async deletedIds(sid: string, coll: string) {
    this.calls.deletedIds++;
    return new Set([...this.coll(sid, coll)].filter(([, d]) => d.deletedAt).map(([id]) => id));
  }

  listening(coll: string) {
    return [...this.listeners].filter((l) => l.key.endsWith(`/${coll}`));
  }
}

let n = 0;
const freshUid = () => `sync-test-${++n}-${Date.now()}`;
const sidOf = (uid: string) => `u_${uid}`;
const docsOf = (uid: string, coll = 'items') => useMirror.getState().colls[`${sidOf(uid)}/${coll}`]?.docs ?? {};
const statusOf = (uid: string, coll = 'items') => useMirror.getState().colls[`${sidOf(uid)}/${coll}`]?.status;
const allLive = (uid: string) => MIRRORED.every((c) => statusOf(uid, c) === 'live');
const item = (text: string, date: string | null, extra: Plain = {}) => ({ kind: 'note', date, text, labelIds: [], order: 'a0', ...extra });

async function readCopy(uid: string, coll = 'items') {
  const db = await openMirrorDb(uid, () => {});
  try {
    return await db.load(sidOf(uid), coll);
  } finally {
    db.close();
  }
}

afterEach(() => {
  stopMirror();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('처음 받기', () => {
  it('이번 학년도 항목 먼저, 그다음 updatedAt 차례로 모두 받고, 다 받은 커서 - 1분부터 구독한다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'old', item('작년 기록', '2025-05-01'));
    server.write(sid, 'items', 'now', item('올해 기록', '2026-10-01'));
    server.write(sid, 'items', 'memo', item('메모', null));
    server.write(sid, 'labels', 'l1', { kind: 'note', name: '라벨', color: '#000', parentId: null, order: 'a0' });

    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));

    expect(server.calls.fromDate).toEqual([{ coll: 'items', date: '2026-03-01' }]);
    expect(server.calls.pages.map((c) => c.coll).sort()).toEqual(['items', 'labels', 'lessonDays', 'series', 'timetables']);
    expect(Object.keys(docsOf(uid)).sort()).toEqual(['memo', 'now', 'old']);
    expect(docsOf(uid).now).toMatchObject({ id: 'now', text: '올해 기록' });
    expect(Object.keys(docsOf(uid, 'labels'))).toEqual(['l1']);
    // 구독은 받은 것 가운데 가장 늦은 판 - 1분부터
    const [listener] = server.listening('items');
    expect(listener.since!.seconds).toBe(server.clock - 1 - OVERLAP_MS / 1000);
    await vi.waitFor(async () => {
      const copy = await readCopy(uid);
      expect([...copy.docs.keys()].sort()).toEqual(['memo', 'now', 'old']);
      expect(copy.meta).toMatchObject({ complete: true });
      expect(copy.meta.cursor!.seconds).toBe(server.clock - 1);
    });
    expect(useMirror.getState().persisted).toBe('disk');
  });

  it('끊기면 받은 데까지부터 잇는다 (연결이 돌아오면 곧바로)', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    for (let i = 1; i <= 5; i++) server.write(sid, 'items', `i${i}`, item(`${i}`, null));
    server.failAfterPages = 1;
    startMirror(uid, { server, today: '2026-10-08', pageSize: 2 });
    await vi.waitFor(() => expect(statusOf(uid)).toBe('offline'));
    expect(Object.keys(docsOf(uid)).sort()).toEqual(['i1', 'i2']);

    server.failAfterPages = null;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(statusOf(uid)).toBe('live'));
    expect(Object.keys(docsOf(uid)).sort()).toEqual(['i1', 'i2', 'i3', 'i4', 'i5']);
    // 둘째 받기는 첫 쪽의 마지막 시각부터 (같은 시각은 겹쳐 받는다)
    const itemPages = server.calls.pages.filter((c) => c.coll === 'items');
    expect(itemPages.map((c) => c.from)).toEqual([null, (docsOf(uid).i2.updatedAt as Timestamp).seconds]);
  });
});

describe('다시 열 때', () => {
  it('사본으로 먼저 그리고(서버를 기다리지 않는다), 처음 받기 없이 커서 - 1분부터 구독한다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const first = new FakeServer();
    first.write(sid, 'items', 'a', item('사본에 있는 것', '2026-10-08'));
    startMirror(uid, { server: first, today: '2026-10-08' });
    await vi.waitFor(async () => expect((await readCopy(uid)).meta.complete).toBe(true));
    stopMirror();
    expect(docsOf(uid)).toEqual({});

    // 그동안 다른 기기에서 하나 더
    first.write(sid, 'items', 'b', item('닫힌 동안 생긴 것', '2026-10-08'));
    let release!: () => void;
    first.holdListen = new Promise((r) => (release = r));
    first.calls.pages = [];
    startMirror(uid, { server: first, today: '2026-10-08' });
    await vi.waitFor(() => expect(statusOf(uid)).toBe('copy'));
    expect(Object.keys(docsOf(uid))).toEqual(['a']);
    release();
    await vi.waitFor(() => expect(statusOf(uid)).toBe('live'));
    expect(Object.keys(docsOf(uid)).sort()).toEqual(['a', 'b']);
    expect(first.calls.pages).toEqual([]);
  });
});

describe('구독', () => {
  it('다른 기기의 쓰기·지운 표시를 받아 화면과 사본에 넣는다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));

    server.write(sid, 'items', 'x', item('다른 탭에서', null));
    expect(docsOf(uid).x).toMatchObject({ text: '다른 탭에서', deletedAt: null });
    const deleted = server.write(sid, 'items', 'x', { ...item('다른 탭에서', null), deletedAt: t(5), deletedBy: 'other' })!;
    expect(docsOf(uid).x.deletedAt).toEqual(t(5));
    await vi.waitFor(async () => {
      const copy = await readCopy(uid);
      expect(copy.docs.get('x')!.deletedAt).toEqual(t(5));
      expect(copy.meta.cursor!.isEqual(deleted.updatedAt as Timestamp)).toBe(true);
    });
  });

  it('빠진 문서는 서버에 물어 정말 없으면 뺀다 - 내가 쓰는 중이면 묻지 않는다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'gone', item('다른 기기에서 영구로 지울 것', null, { deletedAt: t(1) }));
    server.write(sid, 'items', 'mine', item('내가 고치는 것', null));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));

    server.write(sid, 'items', 'gone', null);
    await vi.waitFor(() => expect(docsOf(uid).gone).toBeUndefined());
    expect(server.calls.fetchOne).toEqual(['gone']);
    await vi.waitFor(async () => expect((await readCopy(uid)).docs.has('gone')).toBe(false));

    // 내 쓰기 중에 구독이 '빠짐'을 주는 것(서버 시각을 기다리느라)은 영구 지우기가 아니다
    beginLocalWrite([writeOp.patch({ sid, coll: 'items', id: 'mine' }, { text: '고치는 중' }, {})], { uid, now: 1 });
    for (const l of server.listening('items')) l.onBatch({ docs: new Map(), removed: ['mine'], fromCache: false, latest: null });
    expect(server.calls.fetchOne).toEqual(['gone']);
    expect(docsOf(uid).mine.text).toBe('고치는 중');
  });

  it('캐시에서 온 소식은 문서만 넣고 커서는 옮기지 않는다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'a', item('a', null));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    const runner = mirrorEngine()!.runners.find((r) => r.coll === 'items')!;
    const before = runner.meta.cursor!;
    const late = { ...item('캐시', null), updatedAt: t(server.clock + 100), deletedAt: null };
    for (const l of server.listening('items')) l.onBatch({ docs: new Map([['c', late]]), removed: [], fromCache: true, latest: late.updatedAt });
    expect(docsOf(uid).c).toBeDefined();
    expect(runner.meta.cursor!.isEqual(before)).toBe(true);
  });
});

describe('구독 - 서버 확인 소식', () => {
  it('첫 소식이 캐시에서 오면 아직 구독 중이 아니고, 서버가 같은 결과를 확인하는 소식(문서 변화 없음)에 구독 중·커서를 옮긴다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'a', item('a', null));
    let release!: () => void;
    server.holdListen = new Promise((r) => (release = r));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(server.listening('items')).toHaveLength(1));
    const runner = mirrorEngine()!.runners.find((r) => r.coll === 'items')!;
    const cursor = runner.meta.cursor!;
    const [l] = server.listening('items');
    const later = t(server.clock + 50);
    l.onBatch({ docs: new Map(), removed: [], fromCache: true, latest: later });
    expect(statusOf(uid)).not.toBe('live');
    expect(runner.meta.cursor!.isEqual(cursor)).toBe(true);
    l.onBatch({ docs: new Map(), removed: [], fromCache: false, latest: later });
    expect(statusOf(uid)).toBe('live');
    expect(runner.meta.cursor!.isEqual(later)).toBe(true);
    release();
  });
});

describe('다른 기기의 영구 지우기 견주기 (하루 한 번)', () => {
  it('사본의 지운 항목 가운데 서버에 없는 것을 뺀다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'trash1', item('휴지통 하나', null, { deletedAt: t(1) }));
    server.write(sid, 'items', 'trash2', item('휴지통 둘', null, { deletedAt: t(1) }));
    server.write(sid, 'items', 'alive', item('살아 있음', null));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    await vi.waitFor(async () => expect((await readCopy(uid)).meta.prunedAt).toBeGreaterThan(0));
    stopMirror();

    // 닫힌 동안 다른 기기가 휴지통에서 영구로 지웠다 (구독에 보이지 않는다)
    server.data.get(`${sid}/items`)!.delete('trash1');
    // 하루가 지났다
    const db = await openMirrorDb(uid, () => {});
    await db.save(sid, 'items', new Map(), [], {});
    db.close();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PRUNE_EVERY_MS + 1000);
    const before = server.calls.deletedIds;
    let release!: () => void;
    server.holdListen = new Promise((r) => (release = r));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(statusOf(uid)).toBe('copy'));
    expect(docsOf(uid).trash1).toBeDefined();
    release();
    await vi.waitFor(() => expect(server.calls.deletedIds).toBeGreaterThan(before));
    await vi.waitFor(() => expect(docsOf(uid).trash1).toBeUndefined());
    expect(docsOf(uid).trash2).toBeDefined();
    expect(docsOf(uid).alive).toBeDefined();
    await vi.waitFor(async () => expect((await readCopy(uid)).docs.has('trash1')).toBe(false));
  });
});

describe('고장 대비 - 사본이 고장 나도 서버 구독은 멈추지 않는다', () => {
  it('IndexedDB가 없으면 메모리로만 받고 구독한다', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'a', item('서버 자료', null));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    expect(useMirror.getState().persisted).toBe('memory');
    expect(docsOf(uid).a).toBeDefined();
    server.write(sid, 'items', 'b', item('나중 것', null));
    expect(docsOf(uid).b).toBeDefined();
  });

  it('도는 동안 사본을 잃어도(다른 탭·브라우저가 지움) 구독은 그대로 - 다시 열지 않는다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    expect(useMirror.getState().persisted).toBe('disk');

    await deleteMirrorDb(uid);
    expect(useMirror.getState().persisted).toBe('memory');
    server.write(sid, 'items', 'after', item('지운 뒤에 온 것', null));
    expect(docsOf(uid).after).toBeDefined();
    expect(server.listening('items')).toHaveLength(1);
    // 잃은 뒤로는 새 DB를 만들지 않는다 (빈 DB에 커서만 앞서 적히면 다음에 앞부분을 못 받는다)
    const dbs = await indexedDB.databases();
    expect(dbs.map((d) => d.name)).not.toContain(`sp5-mirror-${uid}`);
  });

  it('사본에 적기가 실패하면(용량 등) 메모리로만 - 구독은 그대로', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('꽉 찼다', 'QuotaExceededError');
    });
    server.write(sid, 'items', 'x', item('적지 못해도 보인다', null));
    expect(docsOf(uid).x).toBeDefined();
    await vi.waitFor(() => expect(useMirror.getState().persisted).toBe('memory'));
    server.write(sid, 'items', 'y', item('그 뒤에도', null));
    expect(docsOf(uid).y).toBeDefined();
  });
});

describe('다시 받기 · 로그아웃', () => {
  it('다시 받기: 사본을 지우고 처음부터 받는다', async () => {
    const uid = freshUid();
    const sid = sidOf(uid);
    const server = new FakeServer();
    server.write(sid, 'items', 'a', item('a', null));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    server.calls.pages = [];
    await resetMirror({ server, today: '2026-10-08' });
    await vi.waitFor(() => expect(allLive(uid)).toBe(true));
    expect(server.calls.pages.filter((c) => c.coll === 'items')).toEqual([{ coll: 'items', from: null }]);
    expect(docsOf(uid).a).toBeDefined();
  });

  it('로그아웃: 멈추고 이 계정의 사본을 지운다', async () => {
    const uid = freshUid();
    const server = new FakeServer();
    server.write(sidOf(uid), 'items', 'a', item('a', null));
    startMirror(uid, { server, today: '2026-10-08' });
    await vi.waitFor(async () => expect((await readCopy(uid)).docs.size).toBe(1));
    await wipeMirror(uid);
    expect(mirrorEngine()).toBeNull();
    expect(server.listeners.size).toBe(0);
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(`sp5-mirror-${uid}`);
  });
});

// 기기 사본 맞추기 (DESIGN 6-2). 로그인한 동안 공간·컬렉션마다 하나씩 돈다.
//
//   1. 사본(IndexedDB)에서 꺼내 화면 store에 넣는다 - 서버를 기다리지 않고 먼저 그린다.
//   2. 처음이면(이 기기에서 다 받은 적이 없으면) 쪽을 나눠 받는다: 항목은 이번 학년도 것 먼저, 그다음 updatedAt 차례로 모두.
//      끊기면 받은 데까지(after)부터 잇는다. 받는 동안 다른 기기가 고친 것은 updatedAt이 늦어 뒤 쪽에서 온다.
//   3. 그 뒤로는 컬렉션마다 구독 하나: updatedAt > 커서 - 1분 (겹쳐 받아도 id로 덮는다). 지운 표시도 그대로 받는다.
//   + 하루 한 번 서버의 지운 항목과 견줘 다른 기기에서 영구로 지운 것을 뺀다(영구 지우기는 구독에 보이지 않는다).
//
// ⚠️ V4 09-22 교훈 - 사본이 고장 나도 서버 구독은 멈추지 않는다:
//   - 받은 것은 **먼저 메모리(store)에** 넣고 사본에는 뒤따라 적는다(기다리지 않는다). 사본 쓰기가 실패하면 그때부터 메모리로만.
//   - 사본을 열지 못하거나(없음·막힘·시간 넘음) 꺼내지 못해도 서버 받기는 그대로 - 커서가 없으니 처음부터 받는다.
//   - 열어 둔 동안 사본을 잃으면(브라우저가 지움·다른 탭이 지움) 이 탭은 메모리로만 이어 가고 다시 열지 않는다
//     (새로 열면 빈 DB에 커서만 앞서 적혀 다음에 앞부분을 영영 못 받는다). 다음에 앱을 열 때 다시 연다.
//   - 사본은 화면에 먼저 보이는 데만 쓴다. "있다/없다"를 판단해 쓰는 데 쓰지 않는다(쓰기는 문서 하나 - 읽고 고칠 일이 없다).
import { useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { academicYearOf, academicYearRange, todayStr } from '../../domain/dateUtils';
import { personalSpaceId } from '../space';
import type { SpaceCollection } from '../types';
import { compareTime } from './codec';
import { deleteMirrorDb, emptyMeta, mergeMeta, openMirrorDb, type MirrorDb, type MirrorDrop, type MirrorMeta } from './db';
import { firestoreServer, OfflineError, type MirrorServer, type ServerPage } from './server';
import {
  applyBase,
  baseDoc,
  baseDocs,
  dropBase,
  hasOverlay,
  resetMirrorStore,
  setPersisted,
  setPurgeSink,
  setStatus,
  trackColl,
  useMirror,
  type Plain,
} from './store';

/** 사본에 두는 컬렉션 - 그 기능을 옮기는 세션이 더한다(수업 P6-1, 학급 P7-1 …). 개인·그룹 공간 같다 */
export const MIRRORED: readonly SpaceCollection[] = ['items', 'labels', 'series', 'timetables', 'lessonDays', 'progress', 'classes', 'attendance', 'notices', 'subjectAttendance'];
/** 지운 표시(deletedAt)가 있는 컬렉션 - 영구 지우기를 서버와 견준다 (lessonDays는 날짜 문서라 지우지 않는다) */
const WITH_TRASH = new Set<string>(['items', 'labels', 'series', 'timetables', 'progress', 'classes']);

/** 구독은 커서보다 이만큼 앞부터 (서버 시각이 앞뒤로 조금 어긋나도 놓치지 않게) */
export const OVERLAP_MS = 60_000;
export const PAGE_SIZE = 500;
export const PRIORITY_PAGE_SIZE = 300;
/** 서버의 지운 항목과 견주는 간격 */
export const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;
/** 받지 못하면 다시 해 보는 간격 (연결이 돌아오면 곧바로) */
const RETRY_MS = [2000, 5000, 15000, 30000, 60000];

const timeOf = (doc: Plain | undefined) => (doc?.updatedAt ?? null) as Timestamp | null;

function latest(docs: ReadonlyMap<string, Plain>): Timestamp | null {
  let max: Timestamp | null = null;
  for (const d of docs.values()) {
    const t = timeOf(d);
    if (t && compareTime(t, max) > 0) max = t;
  }
  return max;
}

export interface MirrorOptions {
  server?: MirrorServer;
  /** 받을 공간 (기본 = 개인 공간 하나 - 그룹은 P8-4) */
  spaces?: string[];
  /** 오늘 (처음 받기에서 이번 학년도 먼저) */
  today?: string;
  /** IndexedDB를 열지 않는다 (시험) */
  noDisk?: boolean;
  /** 처음 받기 한 쪽 크기 (시험) */
  pageSize?: number;
}

class Engine {
  stopped = false;
  db: MirrorDb | null = null;
  readonly dbReady: Promise<MirrorDb | null>;
  readonly runners: Runner[] = [];
  private readonly onOnline = () => this.runners.forEach((r) => r.wake());

  readonly uid: string;
  readonly server: MirrorServer;
  readonly today: string;
  readonly pageSize: number;

  constructor(uid: string, opts: MirrorOptions) {
    const { server = firestoreServer, today = todayStr(), spaces = [personalSpaceId(uid)], noDisk = false, pageSize = PAGE_SIZE } = opts;
    this.uid = uid;
    this.server = server;
    this.today = today;
    this.pageSize = pageSize;
    this.dbReady = noDisk
      ? Promise.resolve(null)
      : openMirrorDb(uid, (why) => this.lose(why)).then(
          (db) => {
            if (this.stopped) {
              db.close();
              return null;
            }
            this.db = db;
            setPersisted('disk');
            return db;
          },
          (e: unknown) => {
            console.warn('[mirror] 기기 사본을 열지 못해 메모리로만 받습니다.', e);
            setPersisted('memory');
            return null;
          },
        );
    if (noDisk) setPersisted('memory');
    setPurgeSink((key, drop) => {
      const cut = key.indexOf('/');
      this.persist(key.slice(0, cut), key.slice(cut + 1), new Map(), [drop], null);
    });
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
    for (const sid of spaces) for (const coll of MIRRORED) this.runners.push(new Runner(this, sid, coll));
    for (const r of this.runners) void r.start();
  }

  /** 사본을 잃었다 - 이 탭은 메모리로만. 다시 열지 않는다(맨 위 ⚠️) */
  lose(why: unknown) {
    if (!this.db && useMirror.getState().persisted === 'memory') return;
    console.warn('[mirror] 기기 사본을 잃어 메모리로만 받습니다(서버 구독은 그대로).', why);
    const db = this.db;
    this.db = null;
    try {
      db?.close();
    } catch {
      /* 이미 닫힘 */
    }
    setPersisted('memory');
  }

  /** 사본에 뒤따라 적는다 (기다리지 않는다 - 실패하면 메모리로만) */
  persist(sid: string, coll: string, put: ReadonlyMap<string, Plain>, drop: MirrorDrop[], meta: Partial<MirrorMeta> | null) {
    const db = this.db;
    if (!db || this.stopped || (put.size === 0 && drop.length === 0 && !meta)) return;
    db.save(sid, coll, new Map(put), drop, meta).catch((e: unknown) => this.lose(e));
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const r of this.runners) r.stop();
    setPurgeSink(null);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
    this.db?.close();
    this.db = null;
  }
}

class Runner {
  meta: MirrorMeta = emptyMeta();
  private unlisten: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private busy = false;
  private pruned = false;

  private readonly engine: Engine;
  readonly sid: string;
  readonly coll: string;

  constructor(engine: Engine, sid: string, coll: string) {
    this.engine = engine;
    this.sid = sid;
    this.coll = coll;
  }

  private get stopped() {
    return this.engine.stopped;
  }

  async start() {
    trackColl(this.sid, this.coll);
    setStatus(this.sid, this.coll, 'loading');
    const db = await this.engine.dbReady;
    if (this.stopped) return;
    if (db) {
      try {
        const { docs, meta } = await db.load(this.sid, this.coll);
        if (this.stopped) return;
        this.meta = meta;
        if (docs.size > 0) {
          applyBase(this.sid, this.coll, docs);
          setStatus(this.sid, this.coll, 'copy');
        }
      } catch (e) {
        // 꺼내지 못하는 사본은 다음에 새로 받게 지워 둔다(이 탭은 메모리로만, 처음부터 받는다)
        this.engine.lose(e);
        this.meta = emptyMeta();
        void deleteMirrorDb(this.engine.uid).catch(() => {});
      }
    }
    await this.catchUp();
  }

  /** 끊겼던 받기를 곧바로 다시 (연결이 돌아왔을 때) */
  wake() {
    if (this.stopped || this.unlisten || this.busy) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    void this.catchUp();
  }

  private async catchUp() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    try {
      if (!this.meta.complete) {
        // 처음: 이번 학년도 항목 먼저 (커서는 옮기지 않는다 - updatedAt 차례가 아니다)
        if (this.coll === 'items' && !this.meta.after && !this.meta.cursor) {
          const first = academicYearRange(academicYearOf(this.engine.today))[0];
          for await (const page of this.engine.server.pagesFromDate(this.sid, this.coll, first, Math.min(PRIORITY_PAGE_SIZE, this.engine.pageSize))) {
            if (this.stopped) return;
            this.take(page.docs, null);
          }
        }
        for await (const page of this.engine.server.pages(this.sid, this.coll, this.meta.after?.at ?? null, this.engine.pageSize)) {
          if (this.stopped) return;
          this.takePage(page);
        }
        if (this.stopped) return;
        this.take(new Map(), { complete: true });
      }
      this.listen();
    } catch (e) {
      if (this.stopped) return;
      if (!(e instanceof OfflineError)) console.warn(`[mirror] ${this.coll} 받기 실패 - 다시 해 봅니다.`, e);
      setStatus(this.sid, this.coll, e instanceof OfflineError ? 'offline' : 'error');
      this.retry();
    } finally {
      this.busy = false;
    }
  }

  private retry() {
    if (this.stopped) return;
    const ms = RETRY_MS[Math.min(this.attempt, RETRY_MS.length - 1)];
    this.attempt++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.catchUp();
    }, ms);
  }

  private takePage(page: ServerPage) {
    this.take(page.docs, page.last ? { after: page.last, cursor: latest(page.docs) } : null);
  }

  /** 받은 것: 먼저 화면(store), 사본에는 뒤따라 */
  private take(docs: ReadonlyMap<string, Plain>, meta: Partial<MirrorMeta> | null) {
    if (docs.size > 0) applyBase(this.sid, this.coll, docs);
    if (meta) this.meta = mergeMeta(this.meta, meta);
    this.engine.persist(this.sid, this.coll, docs, [], meta);
  }

  private listen() {
    if (this.stopped || this.unlisten) return;
    const since = this.meta.cursor ? Timestamp.fromMillis(this.meta.cursor.toMillis() - OVERLAP_MS) : null;
    this.unlisten = this.engine.server.listen(
      this.sid,
      this.coll,
      since,
      (batch) => {
        if (this.stopped) return;
        // 캐시에서 온 것은 문서만 믿고 커서는 옮기지 않는다. 서버가 확인한 소식이면 결과 전체에서 가장 늦은 판이 커서
        const moved = !batch.fromCache && batch.latest && compareTime(batch.latest, this.meta.cursor) > 0;
        this.take(batch.docs, moved ? { cursor: batch.latest } : null);
        for (const id of batch.removed) {
          // 내가 쓰는 중이면 서버 시각을 기다리느라 잠깐 빠진 것이다 - 덧칠이 보이고 있다
          if (!hasOverlay(this.sid, this.coll, id)) void this.confirmGone(id);
        }
        if (!batch.fromCache) {
          this.attempt = 0;
          setStatus(this.sid, this.coll, 'live');
          void this.maybePrune();
        }
      },
      (e) => {
        if (this.stopped) return;
        console.warn(`[mirror] ${this.coll} 구독이 끊겼습니다 - 다시 해 봅니다.`, e);
        this.unlisten = null;
        setStatus(this.sid, this.coll, 'error');
        this.retry();
      },
    );
  }

  /** 구독에서 빠진 문서가 정말 서버에서 없어졌나 (영구 지우기) - 서버에 물어 본다 */
  private async confirmGone(id: string) {
    const upTo = timeOf(baseDoc(this.sid, this.coll, id));
    let got: Plain | null | undefined;
    try {
      got = await this.engine.server.fetchOne(this.sid, this.coll, id);
    } catch (e) {
      console.warn('[mirror] 빠진 문서를 확인하지 못했습니다.', e);
      return;
    }
    if (this.stopped || got === undefined) return;
    if (got === null) {
      const drop = [{ id, upTo }];
      dropBase(this.sid, this.coll, drop);
      this.engine.persist(this.sid, this.coll, new Map(), drop, null);
    } else {
      this.take(new Map([[id, got]]), null);
    }
  }

  /** 하루 한 번: 사본의 지운 항목 가운데 서버에 없는 것(다른 기기에서 영구로 지운 것)을 뺀다 */
  private async maybePrune() {
    if (this.pruned || !WITH_TRASH.has(this.coll) || Date.now() - this.meta.prunedAt < PRUNE_EVERY_MS) return;
    this.pruned = true;
    // 묻기 전의 판을 잡아 둔다 - 그 사이 바뀐 것(되살림·방금 지움)은 건드리지 않는다
    const candidates: MirrorDrop[] = [];
    for (const [id, doc] of baseDocs(this.sid, this.coll)) if (doc.deletedAt) candidates.push({ id, upTo: timeOf(doc) });
    let onServer: Set<string> | null;
    try {
      onServer = await this.engine.server.deletedIds(this.sid, this.coll);
    } catch (e) {
      console.warn('[mirror] 지운 항목을 견주지 못했습니다.', e);
      return;
    }
    if (this.stopped || !onServer) {
      this.pruned = false;
      return;
    }
    const drop = candidates.filter((c) => !onServer.has(c.id));
    const now = Date.now();
    this.meta = mergeMeta(this.meta, { prunedAt: now });
    dropBase(this.sid, this.coll, drop);
    this.engine.persist(this.sid, this.coll, new Map(), drop, { prunedAt: now });
  }

  stop() {
    this.unlisten?.();
    this.unlisten = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}

let running: Engine | null = null;

/** 로그인한 동안 기기 사본을 맞춘다. 같은 사람으로 두 번 부르면 하나만 돈다 */
export function startMirror(uid: string, opts: MirrorOptions = {}): void {
  if (running && running.uid === uid && !running.stopped) return;
  stopMirror();
  running = new Engine(uid, opts);
}

/** 멈추고 화면 store를 비운다 (사본은 둔다) */
export function stopMirror(): void {
  running?.stop();
  running = null;
  resetMirrorStore();
}

/** 이 계정의 사본을 지운다 (로그아웃 - 공용 PC에 학생 자료를 남기지 않는다). 돌고 있으면 먼저 멈춘다 */
export async function wipeMirror(uid: string): Promise<void> {
  if (running?.uid === uid) stopMirror();
  await deleteMirrorDb(uid);
}

/**
 * '이 기기 사본 다시 받기' (환경설정 '앱' 탭): 사본을 지우고 처음부터 받는다.
 * 다른 탭은 사본을 비켜 주고 메모리로만 이어 간다(새로고침하면 새 사본을 쓴다).
 */
export async function resetMirror(opts: MirrorOptions = {}): Promise<void> {
  const uid = running?.uid;
  if (!uid) return;
  stopMirror();
  try {
    await deleteMirrorDb(uid);
  } finally {
    startMirror(uid, opts);
  }
}

/** 지금 도는 것 (시험·점검) */
export function mirrorEngine(): { uid: string; runners: readonly Runner[] } | null {
  return running;
}

export function useMirrorSync(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;
    startMirror(uid);
    return () => stopMirror();
  }, [uid]);
}

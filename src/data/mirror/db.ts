// 기기 사본 저장소 (IndexedDB, idb) - DESIGN 6-2.
//
//   DB `sp5-mirror-{uid}` (계정마다 따로) · 저장소 둘
//     docs : 문서 하나 = 줄 하나, 열쇠 [공간, 컬렉션, id]  - 공간·컬렉션마다 열쇠 범위로 꺼낸다
//     meta : 공간·컬렉션마다 커서(어디까지 받았나), 열쇠 [공간, 컬렉션]
//   저장소를 공간·컬렉션마다 따로 두지 않는다 - 저장소를 더하려면 DB 판을 올려야 하고, 판 올리기는 다른 탭이 열어 둔 동안 막힌다
//   (그룹 공간에 들어갈 때마다 판을 올릴 수는 없다). 열쇠 범위로 나누면 저장소는 처음 둘 그대로다.
//
// ⚠️ 이 사본은 '먼저 보여 줄 복사본'일 뿐이다. 여기가 고장 나도(없음·막힘·지워짐) 서버 구독은 멈추지 않는다 -
//    부르는 쪽(sync.ts)이 실패를 받으면 메모리로만 돈다. Firestore SDK의 오프라인 저장소는 쓰지 않는다(V4 09-22).
//
// 두 탭이 같은 DB에 함께 적는다 - 줄마다 **늦은 판이 이긴다**(updatedAt), 커서는 큰 쪽, '다 받음'은 한쪽만 참이어도 참.
// 문서와 커서는 한 번에(같은 트랜잭션) 적는다 - 커서가 가리키는 데까지의 문서가 늘 사본에 함께 있다.
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import type { Timestamp } from 'firebase/firestore';
import { compareTime, decodeDoc, decodeValue, encodeDoc, encodeValue } from './codec';

type Plain = Record<string, unknown>;

export const MIRROR_DB_VERSION = 1;
export const mirrorDbName = (uid: string) => `sp5-mirror-${uid}`;
/** 열기가 이보다 오래 걸리면(막힘) 메모리로만 */
export const OPEN_TIMEOUT_MS = 3000;

/** 공간·컬렉션 하나의 받기 상태 */
export interface MirrorMeta {
  /** 받은 updatedAt 가운데 가장 늦은 것 - 이것까지의 문서는 사본에 다 있다(구독은 1분 겹쳐 받는다) */
  cursor: Timestamp | null;
  /** 처음 받기(updatedAt 차례로 쪽 나눠)가 어디까지 왔나 - 끊기면 여기서 잇는다 */
  after: { at: Timestamp; id: string } | null;
  /** 처음 받기를 다 했다 → 그 뒤로는 구독 하나 */
  complete: boolean;
  /** 서버의 지운 항목과 견준 때(ms) - 다른 기기의 영구 지우기는 받기에 보이지 않는다 */
  prunedAt: number;
}

export const emptyMeta = (): MirrorMeta => ({ cursor: null, after: null, complete: false, prunedAt: 0 });

/** 사본에서 뺄 문서. upTo = 이 판까지만 뺀다(그 사이 다른 탭이 더 늦은 판을 적었으면 두고 - 영구 지우기를 되돌린 것) */
export interface MirrorDrop {
  id: string;
  upTo: Timestamp | null;
}

export interface MirrorDb {
  /** 공간·컬렉션 하나를 통째로 (문서는 Timestamp를 되살린 모양, id 칸 없이) */
  load(sid: string, coll: string): Promise<{ docs: Map<string, Plain>; meta: MirrorMeta }>;
  /** 받은 문서·뺄 문서·받기 상태를 한 번에 */
  save(sid: string, coll: string, put: Map<string, Plain>, drop: MirrorDrop[], meta: Partial<MirrorMeta> | null): Promise<void>;
  close(): void;
}

interface DocRow {
  sid: string;
  coll: string;
  id: string;
  data: Plain;
}

interface MetaRow {
  sid: string;
  coll: string;
  meta: Plain;
}

const range = (sid: string, coll: string) => IDBKeyRange.bound([sid, coll], [sid, coll, []]);

const timeOf = (doc: Plain | undefined) => (doc?.updatedAt ?? null) as Timestamp | null;
/** 사본에 든(표시한 모양) 문서의 판 - 문서 전체를 되살리지 않고 */
const storedTime = (row: DocRow) => decodeValue(row.data.updatedAt ?? null) as Timestamp | null;

function readMeta(row: MetaRow | undefined): MirrorMeta {
  if (!row) return emptyMeta();
  const m = decodeValue(row.meta) as Partial<MirrorMeta>;
  return {
    cursor: m.cursor ?? null,
    after: m.after ?? null,
    complete: m.complete === true,
    prunedAt: typeof m.prunedAt === 'number' ? m.prunedAt : 0,
  };
}

/** 두 탭이 함께 적어도 뒤로 가지 않게 합친다 */
export function mergeMeta(old: MirrorMeta, next: Partial<MirrorMeta>): MirrorMeta {
  const later = <T extends { at: Timestamp; id: string } | null>(a: T, b: T): T => {
    if (!a) return b;
    if (!b) return a;
    const c = compareTime(a.at, b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return c >= 0 ? a : b;
  };
  return {
    cursor: next.cursor !== undefined && compareTime(next.cursor, old.cursor) > 0 ? next.cursor : old.cursor,
    after: next.after !== undefined ? later(old.after, next.after) : old.after,
    complete: old.complete || next.complete === true,
    prunedAt: Math.max(old.prunedAt, next.prunedAt ?? 0),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what}: ${ms}ms 안에 끝나지 않았다`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * 사본 DB를 연다. IndexedDB가 없거나 열리지 않으면(막힘·시간 넘음) 던진다 - 부르는 쪽이 메모리로만 돈다.
 * onLost: 열어 둔 동안 DB를 잃으면(브라우저가 지움·다른 탭이 지우려 함) 한 번 부른다. 그 뒤로는 이 연결을 쓰지 않는다.
 */
export async function openMirrorDb(uid: string, onLost: (why: string) => void, timeoutMs = OPEN_TIMEOUT_MS): Promise<MirrorDb> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB가 없다');
  let lost = false;
  const lose = (why: string) => {
    if (lost) return;
    lost = true;
    onLost(why);
  };
  const idb: IDBPDatabase = await withTimeout(
    openDB(mirrorDbName(uid), MIRROR_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: ['sid', 'coll', 'id'] });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: ['sid', 'coll'] });
      },
      // 다른 탭이 지우거나 판을 올리려 한다 - 비켜 준다(이 탭은 메모리로만 이어 간다)
      blocking(_current, _blocked, event) {
        (event.target as IDBDatabase).close();
        lose('다른 탭이 사본을 지우거나 새 판으로 연다');
      },
      // 브라우저가 연결을 끊었다(인터넷 사용 기록 삭제 등)
      terminated() {
        lose('브라우저가 사본 연결을 끊었다');
      },
    }),
    timeoutMs,
    '사본 열기',
  );
  const guard = () => {
    if (lost) throw new Error('사본 연결을 잃었다');
  };

  return {
    async load(sid, coll) {
      guard();
      const tx = idb.transaction(['docs', 'meta'], 'readonly');
      const [rows, metaRow] = await Promise.all([
        tx.objectStore('docs').getAll(range(sid, coll)) as Promise<DocRow[]>,
        tx.objectStore('meta').get([sid, coll]) as Promise<MetaRow | undefined>,
      ]);
      const docs = new Map<string, Plain>();
      for (const row of rows) docs.set(row.id, decodeDoc(row.data));
      return { docs, meta: readMeta(metaRow) };
    },

    async save(sid, coll, put, drop, meta) {
      guard();
      const tx = idb.transaction(['docs', 'meta'], 'readwrite');
      const docs = tx.objectStore('docs');
      const work: Promise<unknown>[] = [];
      for (const [id, data] of put) {
        work.push(
          docs.get([sid, coll, id]).then((old: DocRow | undefined) => {
            // 늦은 판이 이긴다 - 다른 탭이 이미 더 늦은 판을 적었으면 두고
            if (old && compareTime(storedTime(old), timeOf(data)) > 0) return;
            return docs.put({ sid, coll, id, data: encodeDoc(data) } satisfies DocRow);
          }),
        );
      }
      for (const { id, upTo } of drop) {
        work.push(
          docs.get([sid, coll, id]).then((old: DocRow | undefined) => {
            if (!old) return;
            if (upTo && compareTime(storedTime(old), upTo) > 0) return;
            return docs.delete([sid, coll, id]);
          }),
        );
      }
      if (meta) {
        const metaStore = tx.objectStore('meta');
        work.push(
          metaStore.get([sid, coll]).then((row: MetaRow | undefined) =>
            metaStore.put({ sid, coll, meta: encodeValue(mergeMeta(readMeta(row), meta)) as Plain } satisfies MetaRow),
          ),
        );
      }
      await Promise.all([...work, tx.done]);
    },

    close() {
      lost = true;
      idb.close();
    },
  };
}

/** 이 계정의 사본을 통째로 지운다('이 기기 사본 다시 받기'·로그아웃). 다른 탭이 열어 두었으면 그 탭이 비켜 준다(blocking) */
export async function deleteMirrorDb(uid: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await withTimeout(deleteDB(mirrorDbName(uid)), OPEN_TIMEOUT_MS * 2, '사본 지우기');
}

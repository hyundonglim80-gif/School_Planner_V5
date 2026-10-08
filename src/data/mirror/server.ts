// 기기 사본이 서버에서 받는 길 (Firestore). 동기화 규칙(sync.ts)은 이 모양(MirrorServer)만 보고, 테스트는 흉내 낸 서버를 꽂는다.
//
// 서버에 묻는 것은 칸 하나짜리뿐이다(복합 색인이 필요 없다 - DESIGN 4-10):
//   처음 받기   orderBy('updatedAt') 쪽 나눠 (이어 받을 때는 그 시각부터 - 같은 시각은 겹쳐 받는다, id로 덮으니 괜찮다)
//   이번 학년도 where('date', '>=', 첫날) orderBy('date') 쪽 나눠 (항목만 - 처음 받기에서 먼저)
//   그 뒤      where('updatedAt', '>', 커서 - 1분) 구독 하나
//   견주기      where('deletedAt', '!=', null) - 지운 항목 id (다른 기기의 영구 지우기는 구독에 보이지 않는다)
// 처음 받기·견주기·하나 확인은 서버에서만 읽는다(…FromServer) - 연결이 없으면 캐시의 일부를 '다 받음'으로 믿지 않고 실패로.
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  startAt,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

type Plain = Record<string, unknown>;

export interface ServerPage {
  docs: Map<string, Plain>;
  /** 이 쪽의 마지막 문서 (다음에 이어 받을 자리) */
  last: { at: Timestamp; id: string } | null;
}

export interface ServerBatch {
  /** 들어오거나 바뀐 문서 (서버 시각을 기다리는 내 쓰기는 뺀다) */
  docs: Map<string, Plain>;
  /** 결과에서 빠진 문서 id. ⚠️ 영구 지우기만이 아니다 - 내가 쓰는 동안에도 빠졌다가 돌아온다(서버 시각이 아직 없어서) */
  removed: string[];
  /** 연결 없이 캐시에서 온 것 - 문서는 믿어도 '여기까지 다 받았다'는 믿지 않는다(커서를 옮기지 않는다) */
  fromCache: boolean;
}

/** 연결이 없어 받지 못했다 (나중에 다시) */
export class OfflineError extends Error {
  constructor(cause?: unknown) {
    super('서버에 닿지 못했다', { cause });
    this.name = 'OfflineError';
  }
}

export interface MirrorServer {
  /** updatedAt 차례로 쪽 나눠 받는다 (from = 이 시각부터). 연결이 없으면 OfflineError */
  pages(sid: string, coll: string, from: Timestamp | null, size: number): AsyncGenerator<ServerPage>;
  /** 날짜가 이날부터인 것을 쪽 나눠 (처음 받기에서 이번 학년도 먼저) */
  pagesFromDate(sid: string, coll: string, fromDate: string, size: number): AsyncGenerator<ServerPage>;
  /** since보다 늦게 바뀐 것을 구독한다(since가 없으면 모두). 끊는 함수를 돌려준다 */
  listen(
    sid: string,
    coll: string,
    since: Timestamp | null,
    onBatch: (batch: ServerBatch) => void,
    onError: (e: unknown) => void,
  ): () => void;
  /** 서버의 그 문서: 문서 / null = 없음 / undefined = 연결이 없어 모름 */
  fetchOne(sid: string, coll: string, id: string): Promise<Plain | null | undefined>;
  /** 지운 표시가 있는 문서 id (연결이 없으면 null) */
  deletedIds(sid: string, coll: string): Promise<Set<string> | null>;
}

const isOffline = (e: unknown) => (e as { code?: string })?.code === 'unavailable';

function docsOf(snap: QuerySnapshot<DocumentData>): Map<string, Plain> {
  const docs = new Map<string, Plain>();
  for (const d of snap.docs) if (!d.metadata.hasPendingWrites) docs.set(d.id, d.data());
  return docs;
}

async function* paged(first: Query, next: (last: QueryDocumentSnapshot) => Query, size: number): AsyncGenerator<ServerPage> {
  let q = query(first, limit(size));
  for (;;) {
    let snap: QuerySnapshot<DocumentData>;
    try {
      snap = await getDocsFromServer(q);
    } catch (e) {
      throw isOffline(e) ? new OfflineError(e) : e;
    }
    const lastSnap = snap.docs.at(-1);
    const at = lastSnap?.get('updatedAt') as Timestamp | undefined;
    yield { docs: docsOf(snap), last: lastSnap && at ? { at, id: lastSnap.id } : null };
    if (!lastSnap || snap.size < size) return;
    q = query(next(lastSnap), limit(size));
  }
}

export const firestoreServer: MirrorServer = {
  pages(sid, coll, from, size) {
    const col = collection(db, 'spaces', sid, coll);
    const ordered = query(col, orderBy('updatedAt'));
    return paged(from ? query(ordered, startAt(from)) : ordered, (last) => query(ordered, startAfter(last)), size);
  },

  pagesFromDate(sid, coll, fromDate, size) {
    const col = collection(db, 'spaces', sid, coll);
    const ordered = query(col, where('date', '>=', fromDate), orderBy('date'));
    return paged(ordered, (last) => query(ordered, startAfter(last)), size);
  },

  listen(sid, coll, since, onBatch, onError) {
    const col = collection(db, 'spaces', sid, coll);
    return onSnapshot(
      since ? query(col, where('updatedAt', '>', since)) : col,
      (snap) => {
        const docs = new Map<string, Plain>();
        const removed: string[] = [];
        for (const change of snap.docChanges()) {
          if (change.type === 'removed') removed.push(change.doc.id);
          else if (!change.doc.metadata.hasPendingWrites) docs.set(change.doc.id, change.doc.data());
        }
        onBatch({ docs, removed, fromCache: snap.metadata.fromCache });
      },
      onError,
    );
  },

  async fetchOne(sid, coll, id) {
    try {
      const snap = await getDocFromServer(doc(db, 'spaces', sid, coll, id));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      if (isOffline(e)) return undefined;
      throw e;
    }
  },

  async deletedIds(sid, coll) {
    try {
      const snap = await getDocsFromServer(query(collection(db, 'spaces', sid, coll), where('deletedAt', '!=', null)));
      return new Set(snap.docs.map((d) => d.id));
    } catch (e) {
      if (isOffline(e)) return null;
      throw e;
    }
  },
};

// 구글 캘린더 보낼 항목 큐 (DESIGN 4-9 `gcalQueue/{itemId}` = { at, fails }) - 개인 공간, 계정에 있어 다른 기기에서도 보낸다.
// 화면 store(기기 사본)에 넣지 않는다: 보낸 것은 지워야 하는데 사본은 영구 지우기를 믿지 않는다(구독이 '빠짐'으로 준다).
// 그래서 큐는 여기서 바로 구독하고 바로 쓴다 - 뒤에서 도는 보내기(features/gcal)만 쓴다.
import { collection, doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Stored } from './types';

export interface GcalQueueEntry {
  id: string;
  at: number;
  fails: number;
}

const queueCol = (sid: string) => collection(db, 'spaces', sid, 'gcalQueue');

/** 큐 구독 (끊으면 함수를 부른다). 못 읽으면 빈 큐 */
export function watchGcalQueue(sid: string, cb: (entries: GcalQueueEntry[]) => void): () => void {
  return onSnapshot(
    queueCol(sid),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const v = d.data() as { at?: unknown; fails?: unknown };
          return { id: d.id, at: Number(v.at) || 0, fails: Number(v.fails) || 0 };
        }),
      ),
    (e) => {
      console.warn('[gcal] 보낼 일정 큐를 받지 못했습니다.', e);
      cb([]);
    },
  );
}

/** 항목들을 큐에 (이미 있으면 at만 새로 - 못 보낸 수는 둔다) */
export async function queueGcalItems(sid: string, ids: readonly string[], at = Date.now()): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const b = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) b.set(doc(queueCol(sid), id), { at, updatedAt: serverTimestamp() }, { merge: true });
    await b.commit();
  }
}

/** 보낸 항목을 큐에서 뺀다 - 그새 다시 쌓였으면(at이 바뀜) 둔다 */
export async function dropGcalQueue(sid: string, id: string, at: number): Promise<void> {
  const ref = doc(queueCol(sid), id);
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.exists() && Number(fresh.data().at) === at) tx.delete(ref);
  });
}

/** 못 보낸 수 하나 더 */
export function markGcalFail(sid: string, id: string, fails: number): Promise<void> {
  return setDoc(doc(queueCol(sid), id), { fails, updatedAt: serverTimestamp() }, { merge: true });
}

/** 항목 하나를 서버에서 (보낼 때 - 다른 기기가 큐에 넣은 것을 이 기기 사본이 아직 못 받았을 수 있다). 없으면 null */
export async function readItemFromServer(sid: string, id: string): Promise<Stored<'items'> | null> {
  const snap = await getDocFromServer(doc(db, 'spaces', sid, 'items', id));
  return snap.exists() ? ({ ...(snap.data() as Stored<'items'>), id: snap.id } as Stored<'items'>) : null;
}

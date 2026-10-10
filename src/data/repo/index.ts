// 저장 도우미 (DESIGN 6-1). 화면·기능 코드는 Firestore를 직접 부르지 않고 이것만 쓴다.
//
//   create  새 문서 (id는 newPath로 기기에서 만든다 - 저장 전에 그 항목의 칸을 열 수 있게)
//   patch   칸 바꾸기 (before = 고치기 전 문서, 되돌리기에 쓴다)
//   remove  지운 표시 / restore 되살리기 / purge 영구 지우기(휴지통에서만)
//   put     문서 통째로 (설정 문서)
//   merge   칸 바꾸기 - 문서가 없으면 만든다 (날짜 문서 lessonDays)
//   batch   여럿을 한 묶음으로 (링크 양쪽·반복 묶음·공간 옮기기)
//
// 모두 **되돌리는 쓰기(Undo)**를 돌려준다 - 안내의 '되돌리기'와 Ctrl+Z가 그것을 쓴다(data/undo.ts).
// 실패는 안내하고 던진다(failWithToast) - 부르는 칸은 실패하면 닫지 않는다(V4 규칙).
//
// ⚠️ Firestore는 기기 저장소 없이(memoryLocalCache) 쓰므로 약속은 서버가 받았을 때 풀린다.
//    화면에 먼저 보이기는 기기 사본이 한다 - 적기 직전에 그 결과를 화면 store에 얹고(data/mirror/store 덧칠), 실패하면 걷는다.
import { deleteField, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { failWithToast } from '../../app/toast';
import { newId } from '../id';
import { beginLocalWrite, endLocalWrite } from '../mirror/store';
import type { DocOf, DocPath, Editable, SpaceCollection } from '../types';
import {
  DELETE_FIELD,
  failMessage,
  nestPaths,
  SERVER_TIME,
  toWrite,
  undoOfAll,
  writeOp,
  type Changes,
  type Fields,
  type Undo,
  type WriteOp,
} from './ops';

export { writeOp, type Changes, type Undo, type WriteOp } from './ops';

/** 한 묶음에 넣을 수 있는 쓰기 수 (Firestore 한도). 넘으면 나눠 적는다 - 그때는 묶음마다만 한꺼번에 */
export const BATCH_LIMIT = 500;

export interface WriteOptions {
  /** 실패 안내 (없으면 쓰기 종류로 - ops.failMessage) */
  fail?: string;
}

/** 새 문서 자리 (id는 기기에서) */
export function newPath<C extends SpaceCollection>(sid: string, coll: C): DocPath<C> {
  return { sid, coll, id: newId() };
}

function toFirestore(data: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = value === SERVER_TIME ? serverTimestamp() : value === DELETE_FIELD ? deleteField() : value;
  }
  return out;
}

/** 겹친 모양 안쪽까지 자리 표시를 바꾼다 (merge 쓰기 - 칸 지우기가 깊은 칸에 있다) */
function toFirestoreDeep(data: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] =
      value === SERVER_TIME
        ? serverTimestamp()
        : value === DELETE_FIELD
          ? deleteField()
          : value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
            ? toFirestoreDeep(value as Fields)
            : value;
  }
  return out;
}

/**
 * 쓰기 지켜보기 (P8-1 구글 캘린더 자동 보내기 - V4 lib/gcalNote). 적기 직전에 ops와 함께 부르고(화면 store가 아직 옛 판일 때),
 * 돌려준 함수를 끝난 뒤 성공 여부와 함께 부른다. 지켜보는 쪽은 가볍게 - 쓰기를 늦추지 않게 오래 걸리는 일은 뒤로 미룬다.
 */
export type WriteObserver = (ops: readonly WriteOp[]) => ((ok: boolean) => void) | void;
const observers = new Set<WriteObserver>();

export function observeWrites(fn: WriteObserver): () => void {
  observers.add(fn);
  return () => {
    observers.delete(fn);
  };
}

function noticeWrites(ops: readonly WriteOp[]): (ok: boolean) => void {
  const after: Array<(ok: boolean) => void> = [];
  for (const fn of observers) {
    try {
      const done = fn(ops);
      if (done) after.push(done);
    } catch (e) {
      console.warn('[repo] 쓰기 지켜보기 실패', e);
    }
  }
  return (ok) => {
    for (const done of after) {
      try {
        done(ok);
      } catch (e) {
        console.warn('[repo] 쓰기 지켜보기 실패', e);
      }
    }
  };
}

/**
 * 안내 없이 적는다 - 실패하면 Firestore 오류를 그대로 던진다.
 * 사용자가 누른 저장이 아니라 뒤에서 맞추는 것(설정 동기화)만 쓴다. 나머지는 아래 도우미로.
 */
export async function writeOps(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const uid = auth.currentUser?.uid;
  if (!uid) throw Object.assign(new Error('로그인하지 않아 적을 수 없다'), { code: 'unauthenticated' });
  const ctx = { uid, now: Date.now() };
  const noticed = observers.size ? noticeWrites(ops) : null;
  const local = beginLocalWrite(ops, ctx);
  try {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const b = writeBatch(db);
      for (const op of ops.slice(i, i + BATCH_LIMIT)) {
        const w = toWrite(op, ctx);
        const ref = doc(db, w.path);
        if (w.kind === 'set') b.set(ref, toFirestore(w.data));
        else if (w.kind === 'update') b.update(ref, toFirestore(w.data));
        else if (w.kind === 'merge') b.set(ref, toFirestoreDeep(nestPaths(w.data)), { merge: true });
        else b.delete(ref);
      }
      await b.commit();
    }
  } catch (e) {
    endLocalWrite(local, false);
    noticed?.(false);
    throw e;
  }
  endLocalWrite(local, true);
  noticed?.(true);
}

/** 여럿을 한 묶음으로 적고 되돌리는 쓰기를 돌려준다. 실패는 안내하고 던진다 */
export async function batch(ops: WriteOp[], opts: WriteOptions = {}): Promise<Undo> {
  try {
    await writeOps(ops);
  } catch (e) {
    const message =
      (e as { code?: string })?.code === 'unauthenticated'
        ? '로그인이 풀려 저장하지 못했습니다. 다시 로그인해 주세요.'
        : (opts.fail ?? failMessage(ops));
    failWithToast(message, e);
  }
  return undoOfAll(ops);
}

export function create<C extends SpaceCollection>(at: DocPath<C>, data: Editable<C>, opts?: WriteOptions): Promise<Undo> {
  return batch([writeOp.create(at, data)], opts);
}

export function patch<C extends SpaceCollection>(
  at: DocPath<C>,
  changes: Changes<C>,
  before: Partial<DocOf<C>>,
  opts?: WriteOptions,
): Promise<Undo> {
  return batch([writeOp.patch(at, changes, before)], opts);
}

/** 칸 바꾸기 - 문서가 없으면 만든다 (날짜 문서). before = 지금 문서(없으면 null) */
export function merge<C extends SpaceCollection>(
  at: DocPath<C>,
  changes: Changes<C>,
  before: Partial<DocOf<C>> | null,
  opts?: WriteOptions,
): Promise<Undo> {
  return batch([writeOp.merge(at, changes, before)], opts);
}

export function remove(at: DocPath, opts?: WriteOptions): Promise<Undo> {
  return batch([writeOp.remove(at)], opts);
}

export function restore(at: DocPath, opts?: WriteOptions): Promise<Undo> {
  return batch([writeOp.restore(at)], opts);
}

export function put<C extends SpaceCollection>(
  at: DocPath<C>,
  data: Editable<C>,
  before: Partial<DocOf<C>> | null = null,
  opts?: WriteOptions,
): Promise<Undo> {
  return batch([writeOp.put(at, data, before)], opts);
}

export function purge<C extends SpaceCollection>(at: DocPath<C>, before: DocOf<C>, opts?: WriteOptions): Promise<Undo> {
  return batch([writeOp.purge(at, before)], opts);
}

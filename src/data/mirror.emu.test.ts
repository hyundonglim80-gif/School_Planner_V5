// 기기 사본 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`).
// 실제 Firestore와 규칙 위에서: 다른 기기(같은 계정의 다른 앱)의 쓰기·지운 표시·영구 지우기가 사본에 들어오고, 내 쓰기는 먼저 보이고,
// 사본에서 꺼낸 문서(Timestamp를 되살린 것)로 영구 지우기·되돌리기가 규칙을 지나며, 다시 열면 닫힌 동안의 것을 겹쳐 받는다.
// IndexedDB는 jsdom의 fake-indexeddb. 점검 전용 계정(mirrortest@)의 개인 공간에만 쓰고 끝에 지운다.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  serverTimestamp,
  setDoc,
  terminate,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { app, auth, db } from './firebase';
import { batch, create, purge } from './repo';
import { personalSpaceId } from './space';
import { useSession } from './session';
import { useMirror } from './mirror/store';
import { openMirrorDb } from './mirror/db';
import { resetMirror, startMirror, stopMirror } from './mirror/sync';
import type { Stored } from './types';

const EMAIL = 'mirrortest@example.com';
const PASSWORD = 'test1234';

let uid = '';
let sid = '';
// 다른 기기 = 같은 계정으로 들어간 다른 앱
const otherApp = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, 'other-device');
let other: Firestore;

const items = () => useMirror.getState().colls[`${sid}/items`]?.docs ?? {};
const statusOf = (coll = 'items') => useMirror.getState().colls[`${sid}/${coll}`]?.status;
const allLive = () => ['items', 'labels', 'series', 'timetables', 'lessonDays'].every((c) => statusOf(c) === 'live');

/** 다른 기기에서 적기 (규칙이 보는 칸을 갖춰 - 저장 도우미가 붙이는 것과 같다) */
function otherWrite(id: string, text: string) {
  return setDoc(doc(other, 'spaces', sid, 'items', id), {
    kind: 'note',
    date: null,
    text,
    labelIds: [],
    order: 'a0',
    createdAt: Date.now(),
    authorId: uid,
    deletedAt: null,
    updatedAt: serverTimestamp(),
    v: 1,
  });
}

beforeAll(async () => {
  try {
    await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/network-request-failed') {
      throw new Error('에뮬레이터가 꺼져 있다 - 다른 창에서 npm run emu', { cause: e });
    }
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  }
  uid = auth.currentUser!.uid;
  sid = personalSpaceId(uid);
  useSession.setState({ loading: false, user: { uid, email: EMAIL, displayName: '', photoURL: '' } });

  const otherAuth = initializeAuth(otherApp, { persistence: inMemoryPersistence });
  connectAuthEmulator(otherAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInWithEmailAndPassword(otherAuth, EMAIL, PASSWORD);
  other = initializeFirestore(otherApp, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(other, '127.0.0.1', 8080);

  // 지난 시험이 남긴 것을 비운다
  for (const coll of ['items', 'labels', 'series', 'timetables', 'lessonDays']) {
    for (const d of (await getDocs(collection(other, 'spaces', sid, coll))).docs) await deleteDoc(d.ref);
  }
});

afterAll(async () => {
  stopMirror();
  for (const d of (await getDocs(collection(other, 'spaces', sid, 'items'))).docs) await deleteDoc(d.ref);
  await signOut(auth);
  await terminate(db);
  await terminate(other);
  await deleteApp(app);
  await deleteApp(otherApp);
});

describe('기기 사본 (에뮬레이터)', () => {
  it('처음 받기: 서버에 있던 것을 받고 구독을 건다', async () => {
    await otherWrite('first', '처음부터 있던 것');
    startMirror(uid);
    await vi.waitFor(() => expect(allLive()).toBe(true), { timeout: 10_000 });
    expect(items().first).toMatchObject({ id: 'first', text: '처음부터 있던 것', deletedAt: null });
    expect(useMirror.getState().persisted).toBe('disk');
  });

  it('다른 기기에서 만든 것이 2초 안에 들어오고, 지운 표시도 그대로 온다', async () => {
    const start = Date.now();
    await otherWrite('fromOther', '다른 기기에서');
    await vi.waitFor(() => expect(items().fromOther?.text).toBe('다른 기기에서'), { timeout: 2000 });
    expect(Date.now() - start).toBeLessThan(2000);

    await updateDoc(doc(other, 'spaces', sid, 'items', 'fromOther'), { deletedAt: serverTimestamp(), deletedBy: uid, updatedAt: serverTimestamp() });
    await vi.waitFor(() => expect(items().fromOther?.deletedAt).toBeInstanceOf(Timestamp), { timeout: 2000 });
  });

  it('다른 기기의 영구 지우기: 구독에서 빠진 것을 서버에 물어 사본에서도 뺀다', async () => {
    await deleteDoc(doc(other, 'spaces', sid, 'items', 'first'));
    await vi.waitFor(() => expect(items().first).toBeUndefined(), { timeout: 3000 });
  });

  it('내 쓰기는 화면에 먼저 - 서버가 받기 전에 보이고, 받은 뒤에는 서버 시각', async () => {
    const at = { sid, coll: 'items' as const, id: 'mine' };
    const saving = create(at, { kind: 'note', date: '2026-10-08', text: '내가 쓴 것', labelIds: [], order: 'a0' });
    expect(items().mine?.text).toBe('내가 쓴 것');
    await saving;
    await vi.waitFor(async () => {
      const server = (await getDoc(doc(other, 'spaces', sid, 'items', 'mine'))).data();
      const shown = items().mine?.updatedAt as Timestamp | undefined;
      expect(shown?.isEqual(server!.updatedAt as Timestamp)).toBe(true);
    });
  });

  it('다시 열면 사본으로 먼저 그리고, 닫힌 동안 다른 기기가 쓴 것을 겹쳐 받는다', async () => {
    stopMirror();
    expect(items()).toEqual({});
    await otherWrite('whileClosed', '닫힌 동안');
    startMirror(uid);
    await vi.waitFor(() => expect(items().mine).toBeDefined());
    await vi.waitFor(() => expect(items().whileClosed?.text).toBe('닫힌 동안'), { timeout: 5000 });
  });

  it('사본에서 꺼낸 문서로 영구 지우기·되돌리기가 규칙을 지난다 (Timestamp를 되살린다 - P2-1에서 넘겨받음)', async () => {
    await vi.waitFor(() => expect(allLive()).toBe(true));
    // IndexedDB에서 꺼낸 그대로
    const copy = await openMirrorDb(uid, () => {});
    const { docs } = await copy.load(sid, 'items');
    copy.close();
    const fromCopy = docs.get('fromOther')!;
    expect(fromCopy.deletedAt).toBeInstanceOf(Timestamp);
    // 화면이 든 문서(자리 id가 붙어 있다)를 그대로 넘긴다
    const shown = items().fromOther as unknown as Stored<'items'>;
    const undo = await purge({ sid, coll: 'items', id: 'fromOther' }, shown);
    expect((await getDoc(doc(other, 'spaces', sid, 'items', 'fromOther'))).exists()).toBe(false);
    await vi.waitFor(() => expect(items().fromOther).toBeUndefined());
    await batch(undo);
    const back = (await getDoc(doc(other, 'spaces', sid, 'items', 'fromOther'))).data()!;
    expect(back.deletedAt).toBeInstanceOf(Timestamp);
    expect(back).not.toHaveProperty('id');
    await vi.waitFor(() => expect(items().fromOther?.text).toBe('다른 기기에서'));
  });

  it('다시 받기: 사본을 지우고 처음부터 받는다', async () => {
    await resetMirror();
    await vi.waitFor(() => expect(allLive()).toBe(true), { timeout: 10_000 });
    expect(Object.keys(items()).sort()).toEqual(['fromOther', 'mine', 'whileClosed']);
  });

  it('IndexedDB가 없어도 서버 자료는 들어오고 구독도 돈다', async () => {
    stopMirror();
    vi.stubGlobal('indexedDB', undefined);
    try {
      startMirror(uid);
      await vi.waitFor(() => expect(allLive()).toBe(true), { timeout: 10_000 });
      expect(useMirror.getState().persisted).toBe('memory');
      expect(items().mine).toBeDefined();
      await otherWrite('noDisk', '사본 없이');
      await vi.waitFor(() => expect(items().noDisk?.text).toBe('사본 없이'), { timeout: 2000 });
    } finally {
      stopMirror();
      vi.unstubAllGlobals();
    }
  });
});

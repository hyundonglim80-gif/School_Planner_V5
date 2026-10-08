// 쓰던 글 보관 (DESIGN 6-3) - 쓰는 칸의 글을 2초 뒤 이 기기 IndexedDB에 남긴다. 계정에 올리지 않는다.
//
//   DB `sp5-drafts-{uid}`(계정마다) · 저장소 drafts(열쇠 = 칸 열쇠 - 'note:u_x:id', 'note:u_x:new:2026-10-08'…)
//   - 칸이 손댄 동안 2초 뒤 적는다. 저장하면 지운다(clear). 칸을 다시 열면 '저장하지 않은 글이 있습니다 - 되살리기'.
//   - 닫기·ESC로 버리고 닫아도 남는다 - 다시 열어 '버리기'로 지운다(잘못 닫은 글을 살리는 것이 이 기능이다).
//   - 탭을 닫거나 화면이 꺼지는 때(pagehide)와 칸이 닫히는 때는 기다리던 것을 곧바로 적는다.
//   - 로그아웃하면 그 계정의 보관을 지운다(wipeDrafts - 공용 PC에 학생 이야기가 남지 않게, 기기 사본과 같다).
// ⚠️ 여기가 고장 나도(없음·막힘) 칸은 그대로 쓴다 - 보관만 조용히 쉰다(콘솔에 한 번).
import { useEffect, useRef, useState } from 'react';
import { deleteDB, openDB, type IDBPDatabase, type IDBPObjectStore } from 'idb';
import { useSession } from './session';

export const draftsDbName = (uid: string) => `sp5-drafts-${uid}`;
/** 손대고 이만큼 멈추면 적는다 */
export const DRAFT_DELAY_MS = 2000;
const OPEN_TIMEOUT_MS = 3000;

export interface Draft<T> {
  value: T;
  /** 적은 때(ms) */
  savedAt: number;
}

interface DraftRow {
  key: string;
  value: unknown;
  savedAt: number;
}

const dbs = new Map<string, Promise<IDBPDatabase | null>>();
let warned = false;

function warnOnce(e: unknown) {
  if (warned) return;
  warned = true;
  console.warn('[drafts] 쓰던 글 보관을 쓰지 못합니다 (이 기기의 IndexedDB).', e);
}

function open(uid: string): Promise<IDBPDatabase | null> {
  let p = dbs.get(uid);
  if (!p) {
    const opening = openDB(draftsDbName(uid), 1, {
      upgrade(db) {
        db.createObjectStore('drafts', { keyPath: 'key' });
      },
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), OPEN_TIMEOUT_MS));
    p = Promise.race([opening, timeout]).catch((e: unknown) => {
      warnOnce(e);
      return null;
    });
    dbs.set(uid, p);
  }
  return p;
}

/**
 * 저장소 하나로 일을 한다. 트랜잭션의 끝(tx.done)까지 함께 기다린다 - 따로 두면 트랜잭션이 끊길 때(탭이 닫힘·DB가 지워짐)
 * idb가 만든 done 약속이 받는 이 없이 거절되어 '처리하지 않은 오류'가 된다. 실패는 조용히(콘솔에 한 번).
 */
async function run<R>(uid: string, mode: IDBTransactionMode, work: (store: Store) => Promise<R>): Promise<R | undefined> {
  try {
    const db = await open(uid);
    if (!db) return undefined;
    const tx = db.transaction('drafts', mode);
    const [out] = await Promise.all([work(tx.store as Store), tx.done]);
    return out;
  } catch (e) {
    warnOnce(e);
    return undefined;
  }
}
/** 읽기 트랜잭션에서는 get만 부른다 */
type Store = IDBPObjectStore<unknown, ['drafts'], 'drafts', 'readwrite'>;

export async function readDraft<T>(uid: string, key: string): Promise<Draft<T> | null> {
  const row = (await run(uid, 'readonly', (store) => store.get(key))) as DraftRow | undefined;
  return row ? { value: row.value as T, savedAt: row.savedAt } : null;
}

export async function writeDraft(uid: string, key: string, value: unknown, now = Date.now()): Promise<void> {
  await run(uid, 'readwrite', (store) => store.put({ key, value, savedAt: now } satisfies DraftRow));
}

export async function deleteDraft(uid: string, key: string): Promise<void> {
  await run(uid, 'readwrite', (store) => store.delete(key));
}

/** 로그아웃 - 그 계정의 보관을 통째로 */
export async function wipeDrafts(uid: string): Promise<void> {
  const db = await dbs.get(uid);
  db?.close();
  dbs.delete(uid);
  await deleteDB(draftsDbName(uid));
}

/** 시험에서 열어 둔 DB를 잊는다 */
export function resetDraftsForTest() {
  for (const p of dbs.values()) void p.then((db) => db?.close());
  dbs.clear();
  warned = false;
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface DraftKeeper<T> {
  /** 다시 열었을 때 남아 있던 글 (지금 칸과 같으면 null) - '되살리기'를 묻는다 */
  offer: Draft<T> | null;
  /** 되살리기를 골랐다 - 남은 글을 돌려주고 묻기를 거둔다(보관은 그대로 - 저장하면 지운다) */
  take: () => T | null;
  /** 버리기 - 남은 글을 지운다 */
  discard: () => void;
  /** 저장했다 - 기다리던 것을 거두고 이 칸의 보관을 지운다 */
  clear: () => void;
}

/**
 * 쓰는 칸 하나의 보관. key = 칸 열쇠(새 칸은 공간·자리, 고치는 칸은 항목 id - 바뀌면 앞 열쇠의 보관은 옮겨 적으며 지운다).
 * touched = 칸을 손댔나(열었을 때·저장한 때와 다르다) - 손댄 동안만 적는다.
 */
export function useDraft<T>(key: string | null, value: T, touched: boolean): DraftKeeper<T> {
  const uid = useSession((s) => s.user?.uid ?? null);
  const [offer, setOffer] = useState<Draft<T> | null>(null);
  const pending = useRef<{ key: string; value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 마지막으로 적은 열쇠 - 열쇠가 바뀌면(새 칸의 날짜를 바꿈) 앞 것을 지운다 */
  const written = useRef<string | null>(null);
  const uidRef = useRef(uid);
  useEffect(() => {
    uidRef.current = uid;
  });

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    const u = uidRef.current;
    if (!p || !u) return;
    if (written.current && written.current !== p.key) void deleteDraft(u, written.current);
    written.current = p.key;
    void writeDraft(u, p.key, p.value);
  };

  // 다시 열면(열쇠가 생기면) 남은 글을 찾는다
  useEffect(() => {
    if (!uid || !key) return;
    let alive = true;
    void readDraft<T>(uid, key).then((d) => {
      if (alive && d) setOffer(d);
    });
    return () => {
      alive = false;
    };
  }, [uid, key]);

  // 손댄 동안 2초 뒤 적는다 (칸 글이 바뀔 때마다 다시 센다)
  const valueKey = JSON.stringify(value);
  useEffect(() => {
    if (!touched || !key) return;
    pending.current = { key, value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, DRAFT_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 값은 글자 열쇠로 본다
  }, [touched, key, valueKey]);

  // 탭을 닫거나 화면이 꺼질 때, 칸이 닫힐 때는 기다리던 것을 곧바로
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 남은 글이 지금 칸과 같으면(이미 저장된 글) 묻지 않고 지운다
  const shown = offer && !sameValue(offer.value, value) ? offer : null;
  useEffect(() => {
    if (offer && !shown && uid && key && !touched) {
      setOffer(null);
      void deleteDraft(uid, key);
    }
  }, [offer, shown, uid, key, touched]);

  return {
    offer: shown,
    take: () => {
      const v = offer?.value ?? null;
      setOffer(null);
      return v;
    },
    discard: () => {
      setOffer(null);
      if (uid && key) void deleteDraft(uid, key);
    },
    clear: () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      setOffer(null);
      const u = uidRef.current;
      if (!u) return;
      for (const k of new Set([key, written.current])) if (k) void deleteDraft(u, k);
      written.current = null;
    },
  };
}

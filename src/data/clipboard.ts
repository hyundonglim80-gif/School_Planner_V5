// 왼쪽 클립보드 칸의 '복사한 것' 목록 (V4 lib/clipboardHistory.ts - 붙여넣기는 features/clipboard/paste.ts).
//
// 어디서 모으나
//   1) 이 앱 안에서 Ctrl+C / 잘라내기 한 글자 (copy·cut - features/clipboard의 useClipboardCapture)
//   2) 다른 프로그램에서 복사하거나 캡처(Win+Shift+S 등)한 것 - 브라우저가 클립보드 읽기를 허락해야 한다.
//      칸의 '⤓ 가져오기'를 한 번 누르면 크롬이 묻고, 허락해 두면 이 창으로 돌아올 때·칸이 열린 동안 스스로 가져온다.
//
// 어디에 두나
//   이 기기의 IndexedDB(`sp5-clipboard-{uid}`)에만 - 계정에 올리지 않는다(비밀번호·캡처가 지나간다). 비밀번호 칸의 복사는 모으지 않는다.
//   V5는 계정마다 따로 두고 로그아웃하면 지운다(공용 PC - 쓰던 글 보관·기기 사본과 같다, PLAN 5장).
//   지우면 이 기기의 휴지통 칸(trash)으로 - 휴지통 창(P5-4)이 '이 기기'로 보여 준다.
// ⚠️ 트랜잭션은 일과 tx.done을 함께 기다린다(P3-2 교훈 - 따로 두면 끊길 때 '처리하지 않은 오류').
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { create } from 'zustand';

export interface ClipItem {
  id: string;
  kind: 'text' | 'image';
  text?: string;
  blob?: Blob;
  /** 같은 것을 두 번 담지 않으려고 쓰는 값 (글자는 글자 그대로, 그림은 내용의 해시) */
  key: string;
  createdAt: number;
}

/** 휴지통에 든 클립보드 항목 (이 기기에만) */
export interface ClipTrashItem extends ClipItem {
  deletedAt: number;
}

/** 많이 쌓이면 오래된 것부터 버린다. 그림은 커서 따로 적게 둔다. */
export const MAX_ITEMS = 100;
export const MAX_IMAGES = 30;
/** 너무 긴 글자는 담지 않는다 (책 한 권을 복사한 경우 등) */
const MAX_TEXT = 200_000;
const MAX_TRASH = 200;
const MAX_TRASH_IMAGES = 60;

interface ClipState {
  /** 지금 목록의 주인 (로그인한 계정) */
  uid: string | null;
  items: ClipItem[];
  trash: ClipTrashItem[];
  loaded: boolean;
}

export const useClipboard = create<ClipState>(() => ({ uid: null, items: [], trash: [], loaded: false }));

// ── IndexedDB ──────────────────────────────────────────────
export const clipboardDbName = (uid: string) => `sp5-clipboard-${uid}`;
type StoreName = 'items' | 'trash';
const OPEN_TIMEOUT_MS = 3000;
const dbs = new Map<string, Promise<IDBPDatabase | null>>();
let warned = false;

function warnOnce(e: unknown) {
  if (warned) return;
  warned = true;
  console.warn('[clipboard] 클립보드 목록을 이 기기에 남기지 못합니다 (IndexedDB) - 이 탭에서만 보입니다.', e);
}

function open(uid: string): Promise<IDBPDatabase | null> {
  let p = dbs.get(uid);
  if (!p) {
    const opening = openDB(clipboardDbName(uid), 1, {
      upgrade(db) {
        db.createObjectStore('items', { keyPath: 'id' });
        db.createObjectStore('trash', { keyPath: 'id' });
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

/** 저장소 하나에 쓴다 (넣기·빼기). 실패는 조용히 - 목록은 이 탭에 남는다 */
async function write(uid: string, store: StoreName, puts: ClipItem[], deletes: string[]): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return;
  try {
    const db = await open(uid);
    if (!db) return;
    const tx = db.transaction(store, 'readwrite');
    await Promise.all([...puts.map((it) => tx.store.put(it)), ...deletes.map((id) => tx.store.delete(id)), tx.done]);
  } catch (e) {
    warnOnce(e);
  }
}

async function readAll<T>(uid: string, store: StoreName): Promise<T[]> {
  try {
    const db = await open(uid);
    if (!db) return [];
    const tx = db.transaction(store, 'readonly');
    const [rows] = await Promise.all([tx.store.getAll(), tx.done]);
    return rows as T[];
  } catch (e) {
    warnOnce(e);
    return [];
  }
}

/** 로그인한 계정의 목록을 읽는다 (처음 한 번 - 읽는 사이에 담긴 것은 합친다) */
export async function loadClipboard(uid: string): Promise<void> {
  const cur = useClipboard.getState();
  if (cur.uid === uid && cur.loaded) return;
  if (cur.uid !== uid) useClipboard.setState({ uid, items: [], trash: [], loaded: false });
  const [items, trash] = await Promise.all([readAll<ClipItem>(uid, 'items'), readAll<ClipTrashItem>(uid, 'trash')]);
  const now = useClipboard.getState();
  if (now.uid !== uid) return;
  const merged = [...now.items, ...items.filter((it) => !now.items.some((c) => c.key === it.key))].sort((a, b) => b.createdAt - a.createdAt);
  const mergedTrash = [...now.trash, ...trash.filter((t) => !now.trash.some((c) => c.id === t.id))].sort((a, b) => b.deletedAt - a.deletedAt);
  useClipboard.setState({ items: merged, trash: mergedTrash, loaded: true });
}

/** 로그아웃 - 그 계정의 목록·휴지통을 통째로 */
export async function wipeClipboard(uid: string): Promise<void> {
  const db = await dbs.get(uid);
  db?.close();
  dbs.delete(uid);
  if (useClipboard.getState().uid === uid) useClipboard.setState({ uid: null, items: [], trash: [], loaded: false });
  await deleteDB(clipboardDbName(uid));
}

/** 시험에서 열어 둔 DB를 잊는다 */
export function resetClipboardForTest() {
  for (const p of dbs.values()) void p.then((db) => db?.close());
  dbs.clear();
  warned = false;
  useClipboard.setState({ uid: null, items: [], trash: [], loaded: false });
}

// ── 담기 ───────────────────────────────────────────────────
const newClipId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function hashBlob(blob: Blob): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${blob.type}:${blob.size}`;
  }
}

/** 새 항목을 맨 위에. 같은 것이 있으면 그것을 맨 위로, 넘치면 오래된 것을 버린다 */
async function put(item: Omit<ClipItem, 'id' | 'createdAt'>): Promise<void> {
  const { uid, items } = useClipboard.getState();
  if (!uid) return;
  const existing = items.find((it) => it.key === item.key);
  // 이미 맨 위면 할 일이 없다 (창으로 돌아올 때마다 같은 클립보드를 읽는다)
  if (existing && items[0] === existing) return;
  const entry: ClipItem = existing ? { ...existing, createdAt: Date.now() } : { ...item, id: newClipId(), createdAt: Date.now() };

  let next = [entry, ...items.filter((it) => it.key !== item.key)];
  const dropped: ClipItem[] = [];
  let images = 0;
  next = next.filter((it) => {
    if (it.kind === 'image' && ++images > MAX_IMAGES) {
      dropped.push(it);
      return false;
    }
    return true;
  });
  while (next.length > MAX_ITEMS) dropped.push(next.pop()!);

  useClipboard.setState({ items: next });
  await write(
    uid,
    'items',
    [entry],
    dropped.map((it) => it.id),
  );
}

export async function addClipText(text: string): Promise<void> {
  if (!text || !text.trim() || text.length > MAX_TEXT) return;
  await put({ kind: 'text', text, key: `t:${text}` });
}

export async function addClipImage(blob: Blob): Promise<void> {
  if (!blob || blob.size === 0) return;
  await put({ kind: 'image', blob, key: `i:${await hashBlob(blob)}` });
}

// ── 지우기 = 이 기기 휴지통으로 ────────────────────────────
async function moveClipsToTrash(ids: string[]): Promise<void> {
  const { uid, items, trash } = useClipboard.getState();
  if (!uid) return;
  const now = Date.now();
  const moved: ClipTrashItem[] = items.filter((it) => ids.includes(it.id)).map((it) => ({ ...it, deletedAt: now }));
  if (moved.length === 0) return;

  let nextTrash = [...moved, ...trash];
  const dropped: ClipTrashItem[] = [];
  let images = 0;
  nextTrash = nextTrash.filter((t) => {
    if (t.kind === 'image' && ++images > MAX_TRASH_IMAGES) {
      dropped.push(t);
      return false;
    }
    return true;
  });
  while (nextTrash.length > MAX_TRASH) dropped.push(nextTrash.pop()!);

  useClipboard.setState({ items: items.filter((it) => !ids.includes(it.id)), trash: nextTrash });
  await write(uid, 'items', [], ids);
  await write(
    uid,
    'trash',
    moved,
    dropped.map((t) => t.id),
  );
}

export async function removeClip(id: string): Promise<void> {
  void markSystemClipboardSeen();
  await moveClipsToTrash([id]);
}

export async function clearClips(): Promise<void> {
  void markSystemClipboardSeen();
  await moveClipsToTrash(useClipboard.getState().items.map((it) => it.id));
}

/** 휴지통에서 되살린다 - 복사했던 때의 자리로(같은 것이 이미 목록에 있으면 그것을 둔다) */
export async function restoreClipFromTrash(id: string): Promise<void> {
  const { uid, items, trash } = useClipboard.getState();
  const t = trash.find((x) => x.id === id);
  if (!uid || !t) return;
  const { deletedAt: _deletedAt, ...item } = t;
  const exists = items.some((it) => it.key === item.key);
  useClipboard.setState({ items: exists ? items : [...items, item].sort((a, b) => b.createdAt - a.createdAt), trash: trash.filter((x) => x.id !== id) });
  await write(uid, 'trash', [], [id]);
  if (!exists) await write(uid, 'items', [item], []);
}

/** 휴지통에서 영구 삭제 */
export async function deleteClipTrash(ids: string[]): Promise<void> {
  const { uid } = useClipboard.getState();
  if (!uid || ids.length === 0) return;
  useClipboard.setState((s) => ({ trash: s.trash.filter((t) => !ids.includes(t.id)) }));
  await write(uid, 'trash', [], ids);
}

/** cutoff(ms)보다 먼저 지운 것을 영구 삭제 (휴지통 자동 비우기). 지운 개수 */
export async function purgeClipTrash(cutoff: number): Promise<number> {
  const old = useClipboard
    .getState()
    .trash.filter((t) => t.deletedAt < cutoff)
    .map((t) => t.id);
  await deleteClipTrash(old);
  return old.length;
}

// ── 시스템 클립보드 읽기 ───────────────────────────────────
export type ReadResult = 'ok' | 'skipped' | 'denied' | 'unsupported';

/** 클립보드 읽기를 이미 허락해 두었나 (묻는 창을 띄우지 않고 알아본다) */
export async function clipboardReadGranted(): Promise<boolean> {
  try {
    const st = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
    return st?.state === 'granted';
  } catch {
    return false;
  }
}

// 스스로 읽을 때는 지난번에 본 것과 달라졌을 때만 담는다 - 아니면 '모두 지우기' 뒤 2초 만에 클립보드의 것이 도로 담겼다(V4).
// 무엇을 봤는지는 이 기기에 기억한다(새로 연 뒤에도 지운 것이 되살아나지 않게). '가져오기'를 누르면 그대로 담는다.
const LAST_SEEN_KEY = 'sp5-clipboard-last-seen';

/** 긴 글자도 짧게 기억하려는 해시 (FNV-1a) */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(v: string) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, v);
  } catch {
    /* 기억 못 하면 다음에 한 번 더 담길 뿐이다 */
  }
}

/** 이 앱 안에서 Ctrl+C 한 글자. 그 글자가 곧 시스템 클립보드이므로 '본 것'으로 적어 둔다. */
export async function addCopiedText(text: string): Promise<void> {
  if (!text) return;
  writeLastSeen(`t:${shortHash(text)}`);
  await addClipText(text);
}

type Found = { kind: 'text'; text: string } | { kind: 'image'; blob: Blob };

/** 시스템 클립보드에 지금 있는 것 */
async function readFound(cb: Clipboard): Promise<Found[]> {
  const found: Found[] = [];
  if (cb.read) {
    for (const ci of await cb.read()) {
      const imageType = ci.types.find((t) => t.startsWith('image/'));
      if (imageType) found.push({ kind: 'image', blob: await ci.getType(imageType) });
      else if (ci.types.includes('text/plain')) found.push({ kind: 'text', text: await (await ci.getType('text/plain')).text() });
    }
  } else {
    found.push({ kind: 'text', text: await cb.readText() });
  }
  return found;
}

const keysOf = async (found: Found[]) => (await Promise.all(found.map(async (f) => (f.kind === 'text' ? `t:${shortHash(f.text)}` : `i:${await hashBlob(f.blob)}`)))).join('|');

/** 지우거나 비운 순간의 시스템 클립보드를 '본 것'으로 적는다 (다음에 스스로 읽을 때 방금 지운 것을 도로 담지 않게) */
async function markSystemClipboardSeen(): Promise<void> {
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb || !(await clipboardReadGranted())) return;
  try {
    writeLastSeen(await keysOf(await readFound(cb)));
  } catch {
    /* 창이 초점을 잃었으면 못 읽는다 - 다음 읽기가 맞춘다 */
  }
}

/**
 * 시스템 클립보드를 읽어 담는다.
 * userAsked가 아니면(창으로 돌아올 때 등) 이미 허락된 경우에만 읽고, 지난번과 달라졌을 때만 담는다 - 묻는 창이 불쑥 뜨면 안 되고 지운 것이 되살아나도 안 된다.
 */
export async function readSystemClipboard(userAsked: boolean): Promise<ReadResult> {
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb || (!cb.read && !cb.readText)) return 'unsupported';
  if (!userAsked && !(await clipboardReadGranted())) return 'skipped';
  if (typeof document !== 'undefined' && !document.hasFocus()) return 'skipped';
  try {
    const found = await readFound(cb);
    const seen = await keysOf(found);
    const changed = seen !== readLastSeen();
    writeLastSeen(seen);
    if (!userAsked && !changed) return 'ok';
    for (const f of found) {
      if (f.kind === 'image') await addClipImage(f.blob);
      else await addClipText(f.text);
    }
    return 'ok';
  } catch {
    return 'denied';
  }
}

/** 항목을 시스템 클립보드에 도로 담는다 (받을 칸이 없을 때) */
export async function copyClipToSystem(item: ClipItem): Promise<boolean> {
  try {
    if (item.kind === 'text') await navigator.clipboard.writeText(item.text || '');
    // 대부분의 브라우저는 PNG만 클립보드에 쓸 수 있다
    else if (item.blob) await navigator.clipboard.write([new ClipboardItem({ [item.blob.type || 'image/png']: item.blob })]);
    return true;
  } catch {
    return false;
  }
}

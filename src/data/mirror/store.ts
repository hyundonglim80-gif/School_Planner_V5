// 화면이 보는 자료 (DESIGN 6-2). 공간·컬렉션마다 문서 표 하나 - 화면은 이것을 고르기(data/select.ts)로만 본다.
//
// 보이는 문서 = 서버 판(base) 위에 **내 쓰기(덧칠)**를 얹은 것.
//   - 서버 판: 사본(IndexedDB)에서 꺼낸 것과 서버에서 받은 것. 판마다 **늦은 판이 이긴다**(updatedAt) - 어느 쪽이 먼저 와도 뒤로 가지 않는다.
//   - 덧칠: 저장 도우미(data/repo)가 적기 시작할 때 그 결과를 곧바로 얹는다("내 쓰기는 화면에 먼저").
//     Firestore 구독은 서버 시각을 기다리는 동안 그 문서를 보여 주지 않는다(updatedAt > 커서 조건에 맞지 않아 '빠짐'으로 온다 -
//     P2-2 에뮬레이터로 확인). 그래서 덧칠은 쓰기가 끝나고 서버 판이 한 번 더 올 때 걷는다(실패하면 곧바로 걷어 서버 판으로).
// 덧칠은 메모리에만 둔다 - 사본(IndexedDB)에는 서버가 준 판만 들어간다.
import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import { DELETE_FIELD, SERVER_TIME, toWrite, type WriteContext, type WriteOp } from '../repo/ops';
import { compareTime } from './codec';
import type { MirrorDrop } from './db';

export type Plain = Record<string, unknown>;
/** 화면이 보는 문서 - 문서 칸 + 자리(id) */
export type Shown = Plain & { id: string };

/**
 * 컬렉션 하나의 받기 상태
 *   idle 아직 / copy 사본으로 그림(서버 확인 전) / loading 처음 받는 중 / live 구독 중 / offline 연결을 기다림 / error 받지 못함(권한 등)
 */
export type MirrorStatus = 'idle' | 'copy' | 'loading' | 'live' | 'offline' | 'error';

export interface CollState {
  docs: Readonly<Record<string, Shown>>;
  status: MirrorStatus;
}

interface MirrorState {
  colls: Readonly<Record<string, CollState>>;
  /** 기기 사본에 적고 있나. memory = IndexedDB 없이 메모리로만(서버 구독은 그대로), null = 아직 모름 */
  persisted: 'disk' | 'memory' | null;
}

export const useMirror = create<MirrorState>(() => ({ colls: {}, persisted: null }));

export const collKey = (sid: string, coll: string) => `${sid}/${coll}`;
export const EMPTY_DOCS: Readonly<Record<string, Shown>> = Object.freeze({});

/** 쓰기가 끝났는데 서버 판이 오지 않으면(구독 전 등) 이만큼 뒤에 덧칠을 걷는다 */
export const SETTLE_WAIT_MS = 8000;

interface Overlay {
  /** 내 쓰기를 얹은 문서. null = 영구 지움 */
  doc: Plain | null;
  /** 끝나지 않은 쓰기 수 */
  open: number;
  failed: boolean;
  /** 마지막 쓰기를 시작한 뒤 서버 판이 왔나 */
  fresh: boolean;
  /** 영구 지우기 - 끝나면 서버 판에서도 뺀다(구독은 그 사실을 알려 주지 않는다). 지우기 전 판 */
  purgedFrom?: Timestamp | null;
  timer?: ReturnType<typeof setTimeout>;
}

const base = new Map<string, Map<string, Plain>>();
const overlays = new Map<string, Map<string, Overlay>>();

const timeOf = (doc: Plain | null | undefined) => (doc?.updatedAt ?? null) as Timestamp | null;

function publish(key: string, ids: Iterable<string>) {
  const state = useMirror.getState();
  const cur = state.colls[key];
  if (!cur) return;
  const docs: Record<string, Shown> = { ...cur.docs };
  let changed = false;
  for (const id of ids) {
    const ov = overlays.get(key)?.get(id);
    const v = ov ? ov.doc : base.get(key)?.get(id);
    if (v) {
      docs[id] = { ...v, id };
      changed = true;
    } else if (id in docs) {
      delete docs[id];
      changed = true;
    }
  }
  if (changed) useMirror.setState({ colls: { ...state.colls, [key]: { ...cur, docs } } });
}

/** 이 공간·컬렉션을 받기 시작한다 (덧칠은 받는 컬렉션에만 얹는다) */
export function trackColl(sid: string, coll: string) {
  const key = collKey(sid, coll);
  if (!base.has(key)) base.set(key, new Map());
  const state = useMirror.getState();
  if (!state.colls[key]) useMirror.setState({ colls: { ...state.colls, [key]: { docs: {}, status: 'idle' } } });
}

export function isTracked(sid: string, coll: string) {
  return base.has(collKey(sid, coll));
}

export function setStatus(sid: string, coll: string, status: MirrorStatus) {
  const key = collKey(sid, coll);
  const state = useMirror.getState();
  const cur = state.colls[key];
  if (!cur || cur.status === status) return;
  useMirror.setState({ colls: { ...state.colls, [key]: { ...cur, status } } });
}

export function setPersisted(persisted: MirrorState['persisted']) {
  if (useMirror.getState().persisted !== persisted) useMirror.setState({ persisted });
}

/** 서버 판 하나 (덧칠 없이) */
export function baseDoc(sid: string, coll: string, id: string): Plain | undefined {
  return base.get(collKey(sid, coll))?.get(id);
}

export function baseDocs(sid: string, coll: string): ReadonlyMap<string, Plain> {
  return base.get(collKey(sid, coll)) ?? new Map();
}

export function hasOverlay(sid: string, coll: string, id: string): boolean {
  return overlays.get(collKey(sid, coll))?.has(id) ?? false;
}

function dropOverlay(key: string, id: string) {
  const ov = overlays.get(key)?.get(id);
  if (!ov) return;
  if (ov.timer) clearTimeout(ov.timer);
  overlays.get(key)!.delete(id);
}

/**
 * 서버 판(사본에서 꺼낸 것 포함)을 넣는다. 늦은 판만 들어간다. 실제로 바뀐 id를 돌려준다.
 * 끝난 쓰기의 덧칠은 서버 판이 오면 걷는다(서버 시각을 받은 판 = 내 쓰기가 든 판 - 구독은 쓰는 동안 그 문서를 주지 않는다).
 */
export function applyBase(sid: string, coll: string, docs: ReadonlyMap<string, Plain>): string[] {
  const key = collKey(sid, coll);
  const map = base.get(key);
  if (!map) return [];
  const touched: string[] = [];
  for (const [id, doc] of docs) {
    const old = map.get(id);
    if (old && compareTime(timeOf(old), timeOf(doc)) > 0) continue;
    map.set(id, doc);
    touched.push(id);
    const ov = overlays.get(key)?.get(id);
    if (ov) {
      ov.fresh = true;
      if (ov.open === 0) dropOverlay(key, id);
    }
  }
  publish(key, touched);
  return touched;
}

/** 서버에 없는 문서를 뺀다 (upTo = 이 판까지만 - 그 사이 더 늦은 판이 왔으면 두고). 실제로 뺀 id를 돌려준다 */
export function dropBase(sid: string, coll: string, drops: readonly MirrorDrop[]): string[] {
  const key = collKey(sid, coll);
  const map = base.get(key);
  if (!map) return [];
  const gone: string[] = [];
  for (const { id, upTo } of drops) {
    const old = map.get(id);
    if (!old) continue;
    if (upTo && compareTime(timeOf(old), upTo) > 0) continue;
    map.delete(id);
    gone.push(id);
  }
  publish(key, gone);
  return gone;
}

// ─────────────── 내 쓰기 (덧칠) ───────────────

function setDeep(doc: Plain, path: string, value: unknown) {
  const keys = path.split('.');
  let cur = doc;
  for (const k of keys.slice(0, -1)) {
    const next = cur[k];
    cur[k] = next !== null && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Plain) } : {};
    cur = cur[k] as Plain;
  }
  const last = keys[keys.length - 1];
  if (value === DELETE_FIELD) delete cur[last];
  else cur[last] = value === SERVER_TIME ? Timestamp.now() : value;
}

/** 저장 도우미가 적을 것(toWrite)을 지금 문서에 얹은 결과. 없는 문서를 고치는 쓰기(서버에서 실패한다)는 undefined */
export function applyWrite(before: Plain | null, op: WriteOp, ctx: WriteContext): Plain | null | undefined {
  const w = toWrite(op, ctx);
  if (w.kind === 'delete') return null;
  if (w.kind === 'set') {
    const doc: Plain = {};
    for (const [k, v] of Object.entries(w.data)) if (v !== DELETE_FIELD) doc[k] = v === SERVER_TIME ? Timestamp.now() : v;
    return doc;
  }
  // merge는 문서가 없어도 만든다(날짜 문서). update는 없는 문서면 서버에서 실패한다
  if (!before && w.kind !== 'merge') return undefined;
  const doc: Plain = { ...(before ?? {}) };
  for (const [path, v] of Object.entries(w.data)) setDeep(doc, path, v);
  return doc;
}

export interface LocalWrite {
  keys: { key: string; id: string }[];
}

/** 저장 도우미가 적기 직전에 부른다 - 받는 컬렉션의 쓰기를 화면에 먼저 얹는다 */
export function beginLocalWrite(ops: readonly WriteOp[], ctx: WriteContext): LocalWrite {
  const keys: LocalWrite['keys'] = [];
  const touched = new Map<string, Set<string>>();
  for (const op of ops) {
    const key = collKey(op.at.sid, op.at.coll);
    const map = base.get(key);
    if (!map) continue;
    let byId = overlays.get(key);
    if (!byId) overlays.set(key, (byId = new Map()));
    const ov = byId.get(op.at.id);
    const before = ov ? ov.doc : (map.get(op.at.id) ?? null);
    const after = applyWrite(before, op, ctx);
    if (after === undefined) continue;
    if (ov) {
      if (ov.timer) clearTimeout(ov.timer);
      ov.timer = undefined;
      ov.doc = after;
      ov.open++;
      ov.fresh = false;
    } else {
      byId.set(op.at.id, { doc: after, open: 1, failed: false, fresh: false });
    }
    const cur = byId.get(op.at.id)!;
    if (op.type === 'purge') cur.purgedFrom = timeOf(map.get(op.at.id));
    else if (op.type === 'create' || op.type === 'put' || op.type === 'merge') cur.purgedFrom = undefined;
    keys.push({ key, id: op.at.id });
    if (!touched.has(key)) touched.set(key, new Set());
    touched.get(key)!.add(op.at.id);
  }
  for (const [key, ids] of touched) publish(key, ids);
  return { keys };
}

type PurgeSink = (key: string, drop: MirrorDrop) => void;
let purgeSink: PurgeSink | null = null;

/** 내 영구 지우기가 끝났을 때 사본(IndexedDB)에서도 빼게 (sync.ts가 단다) */
export function setPurgeSink(sink: PurgeSink | null) {
  purgeSink = sink;
}

/** 적기가 끝났을 때 (ok = 서버가 받음) */
export function endLocalWrite(w: LocalWrite, ok: boolean) {
  const touched = new Map<string, Set<string>>();
  for (const { key, id } of w.keys) {
    const ov = overlays.get(key)?.get(id);
    if (!ov) continue;
    ov.open = Math.max(0, ov.open - 1);
    if (!ok) ov.failed = true;
    if (ov.open > 0) continue;
    if (!touched.has(key)) touched.set(key, new Set());
    touched.get(key)!.add(id);
    if (ov.failed) {
      dropOverlay(key, id);
    } else if (ov.doc === null) {
      // 영구 지우기: 서버에 없으니 서버 판에서도 뺀다
      const upTo = ov.purgedFrom ?? null;
      const map = base.get(key);
      const old = map?.get(id);
      if (old && !(upTo && compareTime(timeOf(old), upTo) > 0)) map!.delete(id);
      dropOverlay(key, id);
      purgeSink?.(key, { id, upTo });
    } else if (ov.fresh) {
      dropOverlay(key, id);
    } else {
      ov.timer = setTimeout(() => {
        if (overlays.get(key)?.get(id) !== ov) return;
        dropOverlay(key, id);
        publish(key, [id]);
      }, SETTLE_WAIT_MS);
    }
  }
  for (const [key, ids] of touched) publish(key, ids);
}

/** 모두 비운다 (로그아웃·다시 받기) */
export function resetMirrorStore() {
  for (const byId of overlays.values()) for (const ov of byId.values()) if (ov.timer) clearTimeout(ov.timer);
  overlays.clear();
  base.clear();
  useMirror.setState({ colls: {}, persisted: null });
}

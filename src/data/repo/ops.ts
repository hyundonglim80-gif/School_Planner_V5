// 저장 도우미의 규칙 부분 (서버 없이 시험한다). 쓰기 하나 = WriteOp 하나, 무엇을 적을지(toWrite)와
// 되돌리는 쓰기(undoOf)를 여기서 정한다. 실제로 적는 것은 repo/index.ts.
//
// - 늘 붙인다: updatedAt = 서버 시각(기기 사본이 이것으로 바뀐 것만 받는다), v = 1
// - 만들 때 더: createdAt(ms)·authorId·deletedAt: null (없는 칸은 쿼리로 거를 수 없다)
// - 지우기 = 지운 표시(deletedAt·deletedBy). 영구 지우기(purge)는 휴지통에서만
// - 칸 바꾸기(patch)에서 undefined는 '그 칸 지우기', 'periods.3.memo'처럼 점은 깊은 칸
// - 되돌리기는 고치기 전 칸 값으로 다시 쓰는 것 - 안내의 '되돌리기'와 Ctrl+Z가 같은 길(data/undo.ts)
import type { DocOf, DocPath, Editable, SpaceCollection } from '../types';

export type Fields = Record<string, unknown>;

/** 서버 시각 자리 (적을 때 serverTimestamp()로 바뀐다) */
export const SERVER_TIME: unique symbol = Symbol('sp5.serverTime');
/** 칸 지우기 자리 (적을 때 deleteField()로 바뀐다) */
export const DELETE_FIELD: unique symbol = Symbol('sp5.deleteField');

/** 칸 바꾸기. 'periods.3.memo'처럼 점으로 깊은 칸을 고른다. undefined = 그 칸 지우기 */
export type Changes<C extends SpaceCollection> = { [K in keyof Editable<C>]?: Editable<C>[K] | undefined } & {
  [path: `${string}.${string}`]: unknown;
};

export type WriteOp =
  | { type: 'create'; at: DocPath; data: Fields }
  | { type: 'patch'; at: DocPath; changes: Fields; before: Fields }
  | { type: 'remove'; at: DocPath }
  | { type: 'restore'; at: DocPath }
  /** 문서를 통째로 적는다 (설정 문서, 영구 지우기 되돌리기). before = 그 자리에 있던 문서(없으면 null) */
  | { type: 'put'; at: DocPath; data: Fields; before: Fields | null }
  | { type: 'purge'; at: DocPath; before: Fields };

/** 되돌리기 = 이 쓰기들을 차례대로 한 묶음으로 */
export type Undo = WriteOp[];

/** 저장 도우미가 붙이는 칸 - 기능 코드는 쓰지 않는다 */
const MANAGED = new Set(['updatedAt', 'v', 'createdAt', 'authorId', 'deletedAt', 'deletedBy']);

function assertNoManaged(fields: Fields, what: string) {
  for (const key of Object.keys(fields)) {
    if (MANAGED.has(key.split('.')[0])) throw new Error(`${what}: '${key}'는 저장 도우미가 붙이는 칸이다`);
  }
}

/** 칸을 고르는 쓰기 짓기 - 타입을 맞춰 WriteOp로 */
export const writeOp = {
  create<C extends SpaceCollection>(at: DocPath<C>, data: Editable<C>): WriteOp {
    assertNoManaged(data as Fields, 'create');
    return { type: 'create', at, data: data as Fields };
  },
  /** before = 고치기 전 문서(화면이 들고 있는 것). 되돌리기에 쓴다 */
  patch<C extends SpaceCollection>(at: DocPath<C>, changes: Changes<C>, before: Partial<DocOf<C>>): WriteOp {
    assertNoManaged(changes as Fields, 'patch');
    if (Object.keys(changes).length === 0) throw new Error('patch: 바꿀 칸이 없다');
    return { type: 'patch', at, changes: changes as Fields, before: before as Fields };
  },
  remove(at: DocPath): WriteOp {
    return { type: 'remove', at };
  },
  restore(at: DocPath): WriteOp {
    return { type: 'restore', at };
  },
  put<C extends SpaceCollection>(at: DocPath<C>, data: Editable<C>, before: Partial<DocOf<C>> | null = null): WriteOp {
    return { type: 'put', at, data: data as Fields, before: before as Fields | null };
  },
  /** before = 지우는 문서 통째(되돌리기로 그대로 되살린다) */
  purge<C extends SpaceCollection>(at: DocPath<C>, before: DocOf<C>): WriteOp {
    return { type: 'purge', at, before: before as unknown as Fields };
  },
};

/** 점으로 고른 깊은 칸의 값 (없으면 undefined) */
export function valueAt(doc: Fields, path: string): unknown {
  let cur: unknown = doc;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Fields)[key];
  }
  return cur;
}

/** 서버 시각 칸은 다시 적을 때 새로 붙는다 */
function withoutStamp(data: Fields): Fields {
  const rest = { ...data };
  delete rest.updatedAt;
  delete rest.v;
  return rest;
}

/** 이 쓰기를 되돌리는 쓰기 */
export function undoOf(op: WriteOp): Undo {
  switch (op.type) {
    // 만든 것은 지운 표시로 (영구로 지우면 다른 기기의 사본이 그 사실을 모른다)
    case 'create':
      return [{ type: 'remove', at: op.at }];
    case 'patch': {
      // before는 문서 모양이거나(화면이 든 것) 바꾼 칸 표(되돌리기의 되돌리기 - 'props.forward' 같은 점 이름 그대로)
      const back: Fields = {};
      for (const key of Object.keys(op.changes)) back[key] = Object.hasOwn(op.before, key) ? op.before[key] : valueAt(op.before, key);
      return [{ type: 'patch', at: op.at, changes: back, before: op.changes }];
    }
    case 'remove':
      return [{ type: 'restore', at: op.at }];
    case 'restore':
      return [{ type: 'remove', at: op.at }];
    case 'put':
      return op.before
        ? [{ type: 'put', at: op.at, data: withoutStamp(op.before), before: op.data }]
        : [{ type: 'purge', at: op.at, before: op.data }];
    case 'purge':
      return [{ type: 'put', at: op.at, data: withoutStamp(op.before), before: null }];
  }
}

/** 여러 쓰기를 되돌리기 - 나중 것부터 */
export function undoOfAll(ops: WriteOp[]): Undo {
  return [...ops].reverse().flatMap(undoOf);
}

/** 서버에 적을 모양 (SERVER_TIME·DELETE_FIELD 자리는 적는 쪽이 바꾼다) */
export type Write =
  | { kind: 'set'; path: string; data: Fields }
  | { kind: 'update'; path: string; data: Fields }
  | { kind: 'delete'; path: string };

export const docPathString = (at: DocPath) => `spaces/${at.sid}/${at.coll}/${at.id}`;

export interface WriteContext {
  uid: string;
  /** 만든 때(ms) */
  now: number;
}

export function toWrite(op: WriteOp, ctx: WriteContext): Write {
  const path = docPathString(op.at);
  switch (op.type) {
    case 'create':
      return {
        kind: 'set',
        path,
        data: { ...op.data, createdAt: ctx.now, authorId: ctx.uid, deletedAt: null, updatedAt: SERVER_TIME, v: 1 },
      };
    case 'patch': {
      const data: Fields = {};
      for (const [key, value] of Object.entries(op.changes)) data[key] = value === undefined ? DELETE_FIELD : value;
      data.updatedAt = SERVER_TIME;
      return { kind: 'update', path, data };
    }
    case 'remove':
      return { kind: 'update', path, data: { deletedAt: SERVER_TIME, deletedBy: ctx.uid, updatedAt: SERVER_TIME } };
    case 'restore':
      return { kind: 'update', path, data: { deletedAt: null, deletedBy: DELETE_FIELD, updatedAt: SERVER_TIME } };
    case 'put':
      return { kind: 'set', path, data: { ...withoutStamp(op.data), updatedAt: SERVER_TIME, v: 1 } };
    case 'purge':
      return { kind: 'delete', path };
  }
}

/** 실패 안내 (부르는 쪽이 따로 주지 않으면). 여럿이면 첫 쓰기로 */
export function failMessage(ops: WriteOp[]): string {
  switch (ops[0]?.type) {
    case 'remove':
      return '지우지 못했습니다. 네트워크를 확인해 주세요.';
    case 'restore':
      return '되살리지 못했습니다. 네트워크를 확인해 주세요.';
    case 'purge':
      return '영구 삭제하지 못했습니다. 네트워크를 확인해 주세요.';
    default:
      return '저장하지 못했습니다. 네트워크를 확인하고 다시 저장해 주세요.';
  }
}

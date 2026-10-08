// 되돌리기 (V4 lib/undoToast.ts + 새 기능 Ctrl+Z). 한 일을 알리는 안내의 '되돌리기' 단추와 Ctrl+Z(글 칸 밖)가 **한 길**이다:
// 저장 도우미(data/repo)가 돌려준 되돌리는 쓰기(Undo)를 recordUndo로 남기면 안내에 단추가 붙고 Ctrl+Z 더미에도 쌓인다.
// 어느 쪽으로 되돌려도 그 하나가 더미에서 빠진다(두 번 되돌리지 않는다).
//
// - 더미는 공간마다 20개(그 공간의 마지막 쓰기부터). 로그인한 사람이 바뀌면 비운다.
// - 되돌리기도 저장 도우미로 적는다 - 실패하면 안내하고, 그 하나를 더미 맨 위에 돌려놓아 다시 해 볼 수 있다.
// - 되돌리기는 고치기 전 칸 값으로 다시 쓰는 것이다. 그 사이 다른 기기에서 같은 칸을 고쳤으면 그것도 되돌아간다(V4와 같다).
// - 되돌리기를 되돌리지는 않는다(다시 하기 없음).
import { batch, type Undo } from './repo';
import { personalSpaceId } from './space';
import { useSession } from './session';
import { showErrorToastOnce, showToast } from '../app/toast';

/** 되돌리기 단추가 있는 안내는 조금 더 오래 둔다 (마우스를 올려 둔 동안은 사라지지 않는다 - app/toast) */
export const UNDO_TOAST_MS = 7000;
export const UNDO_LABEL = '되돌리기';
/** 공간마다 쌓아 두는 수 */
export const UNDO_LIMIT = 20;

interface UndoEntry {
  sid: string;
  undo: Undo;
  /** Ctrl+Z로 되돌렸을 때 무엇이었나 ('메모 지우기') - 안내 단추로 되돌릴 때는 방금 본 안내라 붙이지 않는다 */
  what?: string;
  used: boolean;
}

const stacks = new Map<string, UndoEntry[]>();

function push(entry: UndoEntry) {
  const stack = stacks.get(entry.sid) ?? [];
  stack.push(entry);
  if (stack.length > UNDO_LIMIT) stack.splice(0, stack.length - UNDO_LIMIT);
  stacks.set(entry.sid, stack);
}

function drop(entry: UndoEntry) {
  const stack = stacks.get(entry.sid);
  const i = stack?.indexOf(entry) ?? -1;
  if (stack && i >= 0) stack.splice(i, 1);
}

/**
 * 한 일을 알리고 되돌리기를 남긴다. sid = 그 쓰기를 한 공간(칸을 연 순간의 공간).
 * undo가 비었으면 단추 없이 알리기만 한다.
 */
export function recordUndo(sid: string, message: string, undo: Undo, opts: { what?: string } = {}): void {
  if (undo.length === 0) {
    showToast(message);
    return;
  }
  const entry: UndoEntry = { sid, undo, what: opts.what, used: false };
  push(entry);
  showToast(message, UNDO_TOAST_MS, 'info', { label: UNDO_LABEL, run: () => void runEntry(entry, false) });
}

async function runEntry(entry: UndoEntry, byKey: boolean): Promise<boolean> {
  if (entry.used) return false;
  entry.used = true;
  drop(entry);
  try {
    await batch(entry.undo, { fail: '되돌리지 못했습니다. 네트워크를 확인하고 다시 해 주세요.' });
  } catch (e) {
    showErrorToastOnce('되돌리지 못했습니다.', e);
    entry.used = false;
    push(entry);
    return false;
  }
  showToast(byKey && entry.what ? `↩️ 되돌렸습니다 - ${entry.what}` : '↩️ 되돌렸습니다.');
  return true;
}

/** 지금 공간 - 지금은 개인 공간 하나(공유 그룹을 고르는 것은 P8-4) */
function currentSpaceId(): string | null {
  const uid = useSession.getState().user?.uid;
  return uid ? personalSpaceId(uid) : null;
}

/** Ctrl+Z: 그 공간(주지 않으면 지금 공간)의 마지막 쓰기를 되돌린다. 되돌렸으면 true */
export function undoLast(sid: string | null = currentSpaceId()): Promise<boolean> {
  const entry = sid ? stacks.get(sid)?.at(-1) : undefined;
  if (!entry) {
    showToast('되돌릴 것이 없습니다.');
    return Promise.resolve(false);
  }
  return runEntry(entry, true);
}

/** 그 공간에 쌓인 수 (시험·화면 표시용) */
export function undoCount(sid: string): number {
  return stacks.get(sid)?.length ?? 0;
}

export function clearUndo() {
  stacks.clear();
}

/** 로그인한 사람이 바뀌면 더미를 비운다 (앞 사람의 쓰기를 되돌리지 않게). main에서 한 번 */
export function watchUndoOwner(): () => void {
  return useSession.subscribe((s, prev) => {
    if (s.user?.uid !== prev.user?.uid) clearUndo();
  });
}

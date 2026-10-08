// 자료 층 테스트 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`).
// 저장 도우미·되돌리기·Ctrl+Z가 실제 Firestore와 규칙(firestore.rules) 위에서 맞는지 본다.
// 점검 전용 계정(datatest@)의 개인 공간에만 쓰고, 끝에 영구로 지운다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, terminate, Timestamp } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { app, auth, db } from './firebase';
import { batch, create, newPath, patch, purge, remove, restore, writeOp } from './repo';
import { personalSpaceId } from './space';
import { useSession } from './session';
import { clearUndo, recordUndo, undoCount, undoLast } from './undo';
import { handleAppKeyDown, setShortcutAction } from '../app/keys';
import { ShownError } from '../app/toast';
import type { DocPath, Editable, Item, Label } from './types';

const EMAIL = 'datatest@example.com';
const PASSWORD = 'test1234';

let uid = '';
let sid = '';
const made: DocPath[] = [];

const note = (text: string): Editable<'items'> => ({ kind: 'note', date: null, text, labelIds: [], order: 'a0' });

async function read<T>(at: DocPath): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'spaces', at.sid, at.coll, at.id));
  return snap.exists() ? ({ ...(snap.data() as T), id: snap.id }) : null;
}

/** 서버에서 읽어 조건이 맞을 때까지 기다린다 (Ctrl+Z처럼 기다릴 약속이 없는 쓰기) */
async function readUntil<T>(at: DocPath, ok: (d: (T & { id: string }) | null) => boolean, ms = 5000) {
  const end = Date.now() + ms;
  for (;;) {
    const d = await read<T>(at);
    if (ok(d) || Date.now() > end) return d;
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function newItem(text: string): Promise<DocPath<'items'>> {
  const at = newPath(sid, 'items');
  made.push(at);
  await create(at, note(text));
  return at;
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
});

afterAll(async () => {
  // 만든 것을 영구로 지운다 (남은 것만)
  for (const at of made) {
    const d = await read<Item>(at);
    if (d) await purge(at, d);
  }
  await signOut(auth);
  await terminate(db);
  await deleteApp(app);
});

describe('저장 도우미 (에뮬레이터)', () => {
  it('만들기: 서버 시각·지운 표시 null·판·만든 사람이 붙는다', async () => {
    const at = await newItem('처음 메모');
    const d = await read<Item>(at);
    expect(d).toMatchObject({ kind: 'note', date: null, text: '처음 메모', deletedAt: null, v: 1, authorId: uid });
    expect(d!.updatedAt).toBeInstanceOf(Timestamp);
    expect(typeof d!.createdAt).toBe('number');
  });

  it('칸 바꾸기: 바꾼 칸만, undefined는 칸 지우기 - 서버 시각이 앞으로 간다', async () => {
    const at = await newItem('고칠 메모');
    await patch(at, { time: '09:00', props: { forward: true } }, note('고칠 메모'));
    const before = (await read<Item>(at))!;
    await new Promise((r) => setTimeout(r, 20));
    await patch(at, { text: '고친 메모', time: undefined, 'props.forward': false }, before);
    const after = (await read<Item>(at))!;
    expect(after.text).toBe('고친 메모');
    expect(after).not.toHaveProperty('time');
    expect(after.props).toEqual({ forward: false });
    expect(after.updatedAt.toMillis()).toBeGreaterThan(before.updatedAt.toMillis());
  });

  it('지우기 = 지운 표시, 되살리기 = 표시 떼기', async () => {
    const at = await newItem('지울 메모');
    await remove(at);
    const gone = (await read<Item>(at))!;
    expect(gone.deletedAt).toBeInstanceOf(Timestamp);
    expect(gone.deletedBy).toBe(uid);
    expect(gone.text).toBe('지울 메모');
    await restore(at);
    const back = (await read<Item>(at))!;
    expect(back.deletedAt).toBeNull();
    expect(back).not.toHaveProperty('deletedBy');
  });

  it('여럿을 한 묶음으로 (라벨과 항목)', async () => {
    const lab = newPath(sid, 'labels');
    const it1 = newPath(sid, 'items');
    made.push(lab, it1);
    const label: Editable<'labels'> = { kind: 'note', name: '점검', color: '#888', parentId: null, order: 'a0' };
    await batch([writeOp.create(lab, label), writeOp.create(it1, { ...note('라벨 붙은 메모'), labelIds: [lab.id] })]);
    expect((await read<Label>(lab))?.name).toBe('점검');
    expect((await read<Item>(it1))?.labelIds).toEqual([lab.id]);
  });

  it('영구 지우기와 그 되돌리기 (문서가 그대로 돌아온다)', async () => {
    const at = await newItem('영구로 지울 메모');
    await remove(at);
    const d = (await read<Item>(at))!;
    const undo = await purge(at, d);
    expect(await read(at)).toBeNull();
    await batch(undo);
    const back = (await read<Item>(at))!;
    expect(back).toMatchObject({ text: '영구로 지울 메모', authorId: uid, createdAt: d.createdAt });
    expect(back.deletedAt).toBeInstanceOf(Timestamp);
  });

  it('⚠️ 저장이 실패하면 안내하고 던진다 (남의 공간 - 규칙이 막는다)', async () => {
    const at = newPath('u_somebody_else', 'items');
    await expect(create(at, note('몰래'))).rejects.toBeInstanceOf(ShownError);
    expect(document.querySelector('[data-toast="error"]')?.textContent).toMatch(/저장하지 못했습니다/);
  });

  it('⚠️ 없는 문서의 칸 바꾸기는 실패한다 (지운 항목을 빈 껍데기로 되살리지 않는다)', async () => {
    const at = newPath(sid, 'items');
    await expect(patch(at, { text: 'x' }, {})).rejects.toBeInstanceOf(ShownError);
    expect(await read(at)).toBeNull();
  });
});

describe('되돌리기 (에뮬레이터)', () => {
  it('만들기를 되돌리면 지운 표시', async () => {
    const at = newPath(sid, 'items');
    made.push(at);
    const undo = await create(at, note('되돌릴 새 메모'));
    await batch(undo);
    expect((await read<Item>(at))!.deletedAt).toBeInstanceOf(Timestamp);
  });

  it('칸 바꾸기를 되돌리면 고치기 전 값 (없던 칸은 다시 없다)', async () => {
    const at = await newItem('옛 글');
    const before = (await read<Item>(at))!;
    const undo = await patch(at, { text: '새 글', due: '2026-10-09' }, before);
    await batch(undo);
    const d = (await read<Item>(at))!;
    expect(d.text).toBe('옛 글');
    expect(d).not.toHaveProperty('due');
  });

  it('안내의 되돌리기 단추', async () => {
    const at = await newItem('단추로 되살릴 메모');
    clearUndo();
    recordUndo(sid, '🗑️ 메모를 지웠습니다.', await remove(at));
    const btn = [...document.querySelectorAll<HTMLButtonElement>('[data-toast-action="되돌리기"]')].at(-1)!;
    btn.click();
    const d = await readUntil<Item>(at, (x) => x?.deletedAt === null);
    expect(d!.deletedAt).toBeNull();
    expect(undoCount(sid)).toBe(0);
  });

  it('Ctrl+Z (글 칸 밖) - 마지막 것부터, 글 칸 안에서는 듣지 않는다', async () => {
    const off = setShortcutAction('undo', () => void undoLast());
    clearUndo();
    const a = await newItem('첫째');
    const b = await newItem('둘째');
    recordUndo(sid, '첫째를 지웠습니다.', await remove(a), { what: '첫째 지우기' });
    recordUndo(sid, '둘째를 고쳤습니다.', await patch(b, { text: '둘째 고침' }, (await read<Item>(b))!), { what: '둘째 고치기' });

    // 글 칸 안: 글 되돌리기에 맡긴다
    window.addEventListener('keydown', handleAppKeyDown);
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
    expect(undoCount(sid)).toBe(2);

    // 글 칸 밖: 둘째 고치기부터
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
    expect((await readUntil<Item>(b, (x) => x?.text === '둘째'))!.text).toBe('둘째');
    expect((await read<Item>(a))!.deletedAt).toBeInstanceOf(Timestamp);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
    expect((await readUntil<Item>(a, (x) => x?.deletedAt === null))!.deletedAt).toBeNull();
    expect(undoCount(sid)).toBe(0);
    expect([...document.querySelectorAll('[data-toast]')].some((t) => t.textContent?.includes('둘째 고치기'))).toBe(true);

    window.removeEventListener('keydown', handleAppKeyDown);
    off();
  });
});

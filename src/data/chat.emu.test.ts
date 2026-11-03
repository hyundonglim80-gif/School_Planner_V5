// 대화 자료 시험 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`, P19-1 ■2).
// 앱 자료 층(data/chat)이 쓰는 모양을 규칙(firestore.rules v5Chat·v5Dm·v5ChatReads)이 받는지: A가 그룹을 만들고 B가 코드로 든 뒤
// A → 그룹 전체 방 · B 안 읽음 → 수 1 → 읽음 · B → A 1:1 · A 읽음 → B 글 '1' 사라짐 · 50개씩 받기 · 새 글 onNew · 🔕 · 그룹 밖 X는 막힘 ·
// 고른 사람 방(P19-4 - 첫 글이 만들기 · 이름 · 그룹 밖 사람 더하기 막힘 · 나가기) · 나간 B는 그룹 방이 빠진다.
// 점검 전용 계정(chattest-a@·chattest-b@ / chattest-x@)에만 쓰고 끝에 지운다(대화는 지우기 규칙이 없다 - 에뮬레이터 관리자 'Bearer owner').
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore, serverTimestamp, terminate, Timestamp, writeBatch } from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { chatExpireAt, chatSendDocs, dmPairId, myReadOf, roomKey, unreadRoomKeys, unseenByOther, type ChatRoom, type ChatRoomRef } from '../domain/chat';
import { app, auth, db } from './firebase';
import { useSession, type SessionUser } from './session';
import { useMySpaces } from './spaceChoice';
import { createGroup, deleteGroup, joinGroup, leaveGroup } from './spaces';
import {
  addRoomMembers,
  countUnread,
  leaveRoom,
  loadOlderMsgs,
  markChatJoined,
  markRoomRead,
  newRoomId,
  renameRoom,
  sendChat,
  setRoomMuted,
  watchChatRooms,
  watchRoomMsgs,
  type ChatPage,
} from './chat';
import { useChatStore } from './chatStore';
import { usePendingWrites } from './pendingWrites';

const PASSWORD = 'test1234';
const users: Record<'a' | 'b' | 'x', SessionUser> = {} as never;
let sid = '';
let code = '';
let pair = '';
const made: string[] = []; // 관리자가 끝에 지울 문서 경로

async function signInAs(key: 'a' | 'b' | 'x') {
  const email = `chattest-${key}@example.com`;
  try {
    await createUserWithEmailAndPassword(auth, email, PASSWORD);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/network-request-failed') {
      throw new Error('에뮬레이터가 꺼져 있다 - 다른 창에서 npm run emu', { cause: e });
    }
    await signInWithEmailAndPassword(auth, email, PASSWORD);
  }
  const u = auth.currentUser!;
  users[key] = { uid: u.uid, email, displayName: `${key.toUpperCase()}선생`, photoURL: '' };
  useSession.setState({ loading: false, user: users[key] });
  useMySpaces.setState({ groups: [], loaded: true });
  return users[key];
}

const all = (): ChatRoomRef => ({ kind: 'all', sid, roomId: 'all' });
const said = (key: 'a' | 'b', text: string) => ({ from: users[key].uid, fromName: `${key.toUpperCase()}선생`, text });
const adminRemove = (path: string) =>
  fetch(`http://127.0.0.1:8080/v1/projects/schoolplannerv3/databases/(default)/documents/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
const track = (ref: ChatRoomRef, id: string) => made.push(ref.kind === 'dm' ? `v5Dm/${ref.pairId}/chatMsgs/${id}` : `v5Chat/${ref.sid}/chatRooms/${ref.roomId}/chatMsgs/${id}`);

beforeAll(async () => {
  await signInAs('x');
  await signInAs('b');
  const a = await signInAs('a');
  pair = dmPairId(users.a.uid, users.b.uid);
  await adminRemove(`v5Dm/${pair}`); // 앞 실행이 도중에 멈춰 남긴 1:1 방
  sid = await createGroup(a, '대화 자료 시험');
  code = String((await getDoc(doc(db, 'spaces', sid))).data()?.inviteCode ?? '');
  const b = await signInAs('b');
  await joinGroup(b, code);
  await signInAs('a');
  made.push(`v5Chat/${sid}/chatRooms/all`, `v5Dm/${pair}`);
});

afterAll(async () => {
  for (const p of made) await adminRemove(p).catch(() => {});
  for (const key of ['b', 'a'] as const) {
    await signInAs(key).catch(() => {});
    await deleteDoc(doc(db, 'v5ChatReads', users[key].uid)).catch(() => {});
  }
  if (sid) {
    const members = { [users.a.uid]: 'owner' as const };
    await deleteGroup(users.a, { id: sid, name: '대화 자료 시험', ownerId: users.a.uid, members, inviteCode: code }).catch(() => {});
  }
  await signOut(auth);
  await terminate(db);
  await deleteApp(app);
});

/** 방 목록을 들으며 fn - 끝나면 끊는다 (store가 비는지도 본다) */
async function watching(uid: string, fn: () => Promise<void>, onNew?: (r: ChatRoom) => void) {
  const stop = watchChatRooms(uid, [sid], onNew);
  try {
    await vi.waitFor(() => expect(useChatStore.getState().ready).toBe(true), { timeout: 10_000 });
    await fn();
  } finally {
    stop();
  }
  expect(useChatStore.getState()).toEqual({ rooms: {}, reads: {}, ready: false });
}

const unread = (uid: string) => {
  const s = useChatStore.getState();
  return unreadRoomKeys(Object.values(s.rooms), uid, s.reads);
};

describe('대화 (에뮬레이터)', () => {
  it('A가 그룹 전체 방에 첫 글 - 방 문서 + 글 한 묶음, 기다리는 쓰기는 끝나면 0', async () => {
    const id = await sendChat({ kind: 'all', sid }, said('a', '안녕하세요'));
    track(all(), id);
    expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(usePendingWrites.getState().count).toBe(0);
    const room = (await getDoc(doc(db, 'v5Chat', sid, 'chatRooms', 'all'))).data();
    expect(room).toMatchObject({ kind: 'all', lastId: id, lastFrom: users.a.uid, lastFromName: 'A선생', lastText: '안녕하세요', v: 1 });
  });

  it('그룹 밖 X는 보내지 못한다 - 안내하고 던진다', async () => {
    await signInAs('x');
    await expect(sendChat({ kind: 'all', sid }, { from: users.x.uid, fromName: 'X', text: '끼어들기' })).rejects.toThrow(/그룹을 나갔거나/);
    expect(usePendingWrites.getState().count).toBe(0);
  });

  it('B - 그룹 방이 안 읽음 → 수 1 → 읽음 → 안 읽음 없음 · 🔕', async () => {
    const b = await signInAs('b');
    await watching(b.uid, async () => {
      const key = roomKey(all());
      await vi.waitFor(() => expect(useChatStore.getState().rooms[key]?.lastText).toBe('안녕하세요'), { timeout: 10_000 });
      expect(unread(b.uid)).toEqual([key]);
      expect(await countUnread(all(), null)).toBe(1);
      await markRoomRead(b.uid, all());
      await vi.waitFor(() => expect(unread(b.uid)).toEqual([]), { timeout: 10_000 });
      const s = useChatStore.getState();
      expect(await countUnread(all(), myReadOf(s.rooms[key], b.uid, s.reads))).toBe(0);
      await setRoomMuted(b.uid, all(), true);
      await vi.waitFor(() => expect(useChatStore.getState().rooms[key]?.muted).toEqual([b.uid]), { timeout: 10_000 });
      await setRoomMuted(b.uid, all(), false);
      await vi.waitFor(() => expect(useChatStore.getState().rooms[key]?.muted).toEqual([]), { timeout: 10_000 });
    });
  });

  it("B → A 1:1 - 방 만들기 · A 안 읽음 → A 읽음 → B 글 '1' 사라짐", async () => {
    await signInAs('b');
    const dm: ChatRoomRef = { kind: 'dm', pairId: pair };
    const id = await sendChat({ kind: 'dm', pairId: pair, other: users.a.uid, sid }, said('b', '1:1 안녕하세요'));
    track(dm, id);
    const a = await signInAs('a');
    await watching(a.uid, async () => {
      await vi.waitFor(() => expect(useChatStore.getState().rooms[pair]?.lastText).toBe('1:1 안녕하세요'), { timeout: 10_000 });
      const room = useChatStore.getState().rooms[pair];
      expect(room).toMatchObject({ kind: 'dm', sid, members: expect.arrayContaining([users.a.uid, users.b.uid]), names: { [users.b.uid]: 'B선생' } });
      expect(unread(a.uid)).toContain(pair);
      expect(await countUnread(dm, null)).toBe(1);
      const msg = { id, from: users.b.uid, fromName: 'B선생', text: '', attachments: [], at: room.lastAt, deleted: false };
      expect(unseenByOther(room, users.b.uid, msg)).toBe(true);
      await markRoomRead(a.uid, dm);
      await vi.waitFor(() => expect(unread(a.uid)).not.toContain(pair), { timeout: 10_000 });
      await vi.waitFor(() => expect(unseenByOther(useChatStore.getState().rooms[pair], users.b.uid, msg)).toBe(false), { timeout: 10_000 });
      // A 답장 - names에 A가 더해진다
      track(dm, await sendChat({ kind: 'dm', pairId: pair, other: users.b.uid, sid }, said('a', '네')));
      await vi.waitFor(() => expect(useChatStore.getState().rooms[pair]?.names).toEqual({ [users.a.uid]: 'A선생', [users.b.uid]: 'B선생' }), { timeout: 10_000 });
    });
  });

  it('방 글 - 최근 50개를 듣고(오래된 것부터) 위로 50개씩 더', async () => {
    await signInAs('a');
    for (let i = 0; i < 52; i++) track(all(), await sendChat({ kind: 'all', sid }, said('a', `글 ${i}`)));
    let page: ChatPage | null = null;
    const stop = watchRoomMsgs(all(), (p) => (page = p), (e) => { throw e; });
    try {
      await vi.waitFor(() => expect(page?.offline).toBe(false), { timeout: 10_000 });
      const first = page!;
      expect(first.msgs).toHaveLength(50);
      expect(first.msgs[49].text).toBe('글 51');
      expect(first.msgs.every((m, i) => i === 0 || m.at! >= first.msgs[i - 1].at!)).toBe(true);
      expect(first.cursor).not.toBeNull();
      const older = await loadOlderMsgs(all(), first.cursor!);
      expect(older.msgs.map((m) => m.text)).toEqual(['안녕하세요', '글 0', '글 1']);
      expect(older.cursor).toBeNull();
    } finally {
      stop();
    }
  });

  it('B가 듣는 동안 A가 보내면 onNew 한 번 - 처음 받은 것·내 글은 빼고', async () => {
    const b = await signInAs('b');
    // 보내는 A는 따로 띄운 앱으로 (앱 하나는 계정 하나 - 바꾸면 B의 듣기가 끊긴다). 모양은 data/chat sendChat과 같게
    const other = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, 'chatSender');
    const odb = getFirestore(other);
    connectFirestoreEmulator(odb, '127.0.0.1', 8080);
    const oauth = getAuth(other);
    connectAuthEmulator(oauth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await signInWithEmailAndPassword(oauth, 'chattest-a@example.com', PASSWORD);
    const seen: string[] = [];
    try {
      await watching(
        b.uid,
        async () => {
          await new Promise((r) => setTimeout(r, 500));
          expect(seen).toEqual([]);
          track(all(), await sendChat({ kind: 'all', sid }, said('b', '내 글')));
          await new Promise((r) => setTimeout(r, 500));
          expect(seen).toEqual([]);
          const id = 'chatEmuNew1';
          const { msg, room } = chatSendDocs({ kind: 'all', sid }, said('a', '새 글입니다'), id, serverTimestamp(), Timestamp.fromMillis(chatExpireAt(Date.now())));
          const w = writeBatch(odb);
          w.set(doc(odb, 'v5Chat', sid, 'chatRooms', 'all', 'chatMsgs', id), msg);
          w.set(doc(odb, 'v5Chat', sid, 'chatRooms', 'all'), room, { merge: true });
          await w.commit();
          track(all(), id);
          await vi.waitFor(() => expect(seen).toEqual(['A선생: 새 글입니다']), { timeout: 10_000 });
        },
        (r) => seen.push(`${r.lastFromName}: ${r.lastText}`),
      );
    } finally {
      await terminate(odb);
      await deleteApp(other);
    }
  });

  it('고른 사람 방 - 첫 글이 이름·사람으로 만든다 · B 이름 바꾸기 · 그룹 밖 X 더하기 막힘 · B 나가기 = 목록에서 빠짐', async () => {
    await signInAs('a');
    const roomId = newRoomId();
    const ref: ChatRoomRef = { kind: 'room', sid, roomId };
    made.push(`v5Chat/${sid}/chatRooms/${roomId}`);
    track(ref, await sendChat({ kind: 'room', sid, roomId, create: { name: '학년 부장', members: [users.a.uid, users.b.uid] } }, said('a', '방 첫 글')));
    expect((await getDoc(doc(db, 'v5Chat', sid, 'chatRooms', roomId))).data()).toMatchObject({ kind: 'room', name: '학년 부장', members: { [users.a.uid]: true, [users.b.uid]: true } });
    // 둘째 글은 last*만 (방을 다시 만들지 않는다)
    track(ref, await sendChat({ kind: 'room', sid, roomId }, said('a', '둘째')));
    const b = await signInAs('b');
    await watching(b.uid, async () => {
      await vi.waitFor(() => expect(useChatStore.getState().rooms[roomKey(ref)]?.lastText).toBe('둘째'), { timeout: 10_000 });
      await renameRoom(ref, '  학년 부장 모임  ');
      await vi.waitFor(() => expect(useChatStore.getState().rooms[roomKey(ref)]?.name).toBe('학년 부장 모임'), { timeout: 10_000 });
      await expect(addRoomMembers(ref, [users.x.uid])).rejects.toThrow(/더하지 못했습니다/);
      expect(usePendingWrites.getState().count).toBe(0);
      await leaveRoom(b.uid, ref);
      await vi.waitFor(() => expect(useChatStore.getState().rooms[roomKey(ref)]).toBeUndefined(), { timeout: 10_000 });
    });
    await expect(sendChat({ kind: 'room', sid, roomId }, said('b', '나간 뒤'))).rejects.toThrow(/빠졌습니다/);
    // A가 B를 다시 더한다 (그룹 사람 - 방 사람 누구나)
    await signInAs('a');
    await addRoomMembers(ref, [users.b.uid]);
    expect((await getDoc(doc(db, 'v5Chat', sid, 'chatRooms', roomId))).data()?.members).toEqual({ [users.a.uid]: true, [users.b.uid]: true });
  });

  it('그룹을 나간 B - 그룹 방은 빠지고 1:1 지난 글은 남는다 · 들 때 읽음 적기', async () => {
    const b = await signInAs('b');
    await leaveGroup(b, { id: sid, name: '대화 자료 시험', ownerId: users.a.uid, members: { [users.a.uid]: 'owner', [b.uid]: 'member' } });
    await expect(sendChat({ kind: 'all', sid }, said('b', '나간 뒤'))).rejects.toThrow(/그룹을 나갔거나/);
    await watching(b.uid, async () => {
      await vi.waitFor(() => expect(useChatStore.getState().rooms[pair]).toBeTruthy(), { timeout: 10_000 });
      await new Promise((r) => setTimeout(r, 500));
      expect(useChatStore.getState().rooms[roomKey(all())]).toBeUndefined();
    });
    // 다시 들면 그룹 전체 방 지난 글은 읽은 것으로 (data/spaces joinGroup 뒤에 부른다 - P19-2)
    await joinGroup(b, code);
    await markChatJoined(b.uid, sid);
    await watching(b.uid, async () => {
      await vi.waitFor(() => expect(useChatStore.getState().rooms[roomKey(all())]).toBeTruthy(), { timeout: 10_000 });
      expect(unread(b.uid)).not.toContain(roomKey(all()));
    });
  });
});

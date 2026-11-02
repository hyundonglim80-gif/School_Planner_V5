// 쪽지 자료 시험 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`, P15-1 ■2).
// 앱 자료 층(data/mail)이 쓰는 모양을 규칙(firestore.rules v5Mail)이 받는지: A가 그룹을 만들고 B가 코드로 든 뒤
// A → B 보내기 · B 안 읽음 1 · 받은 목록 · 읽음 → 0 · 지우기 · A 보낸 사본 · 그룹 밖 사람에게는 안내하고 던지기.
// 점검 전용 계정(mailtest-a@·mailtest-b@ / mailtest-x@)에만 쓰고 끝에 지운다.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, terminate, Timestamp, writeBatch } from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { mailDocs, mailExpireAt } from '../domain/mail';
import { app, auth, db } from './firebase';
import { useSession, type SessionUser } from './session';
import { useMySpaces } from './spaceChoice';
import { createGroup, deleteGroup, joinGroup } from './spaces';
import { deleteMail, loadInbox, loadSent, markRead, sendMail, watchUnread } from './mail';
import { useMailStore } from './mailStore';
import { usePendingWrites } from './pendingWrites';

const PASSWORD = 'test1234';
const users: Record<'a' | 'b' | 'x', SessionUser> = {} as never;
let sid = '';
let code = '';
let sentId = '';

async function signInAs(key: 'a' | 'b' | 'x') {
  const email = `mailtest-${key}@example.com`;
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

const mail = (to: string[], text = '내일 협의회는 3시입니다') => ({
  from: users.a.uid,
  fromName: 'A선생',
  sid,
  groupName: '쪽지 자료 시험',
  to,
  names: { [users.b.uid]: 'B선생' },
  text,
});

/** 지금 계정의 두 상자를 비운다 - 앞 실행이 도중에 멈춰 남긴 것 (주인만 지운다) */
async function emptyMyBoxes() {
  const uid = auth.currentUser!.uid;
  for (const box of ['mailIn', 'mailSent']) for (const d of (await getDocs(collection(db, 'v5Mail', uid, box))).docs) await deleteDoc(d.ref);
}

beforeAll(async () => {
  await signInAs('x');
  await signInAs('b');
  await emptyMyBoxes();
  const a = await signInAs('a');
  await emptyMyBoxes();
  sid = await createGroup(a, '쪽지 자료 시험');
  code = String((await getDoc(doc(db, 'spaces', sid))).data()?.inviteCode ?? '');
  const b = await signInAs('b');
  await joinGroup(b, code);
  await signInAs('a');
});

afterAll(async () => {
  // 남은 것: A의 보낸 사본·그룹 (B 상자는 시험이 지운다 - 도중에 멈췄으면 다음 실행의 beforeAll이)
  await signInAs('a').catch(() => {});
  await emptyMyBoxes().catch(() => {});
  if (sid) {
    const members = { [users.a.uid]: 'owner' as const, [users.b.uid]: 'member' as const };
    await deleteGroup(users.a, { id: sid, name: '쪽지 자료 시험', ownerId: users.a.uid, members, inviteCode: code }).catch(() => {});
  }
  await signOut(auth);
  await terminate(db);
  await deleteApp(app);
});

describe('쪽지 (에뮬레이터)', () => {
  it('A가 B에게 보낸다 - 받는 쪽 + 내 사본 한 묶음, 기다리는 쓰기는 끝나면 0', async () => {
    sentId = await sendMail(mail([users.b.uid]));
    expect(sentId).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(usePendingWrites.getState().count).toBe(0);
    const sent = await loadSent(users.a.uid);
    expect(sent.offline).toBe(false);
    expect(sent.items.find((m) => m.id === sentId)).toMatchObject({ to: [users.b.uid], toNames: 'B선생', groupName: '쪽지 자료 시험', replyTo: null });
    expect(sent.items[0].at).toBeGreaterThan(Date.now() - 60_000);
  });

  it('그룹 밖 사람에게는 보내지 못한다 - 안내하고 던진다', async () => {
    await expect(sendMail(mail([users.x.uid]))).rejects.toThrow(/그룹을 나간 사람/);
    await expect(sendMail(mail([]))).rejects.toThrow(/받는 사람/);
  });

  it('B - 안 읽음 1 → 목록 → 읽음 → 0 → 지우기', async () => {
    const b = await signInAs('b');
    const stop = watchUnread(b.uid);
    try {
      await vi.waitFor(() => expect(useMailStore.getState()).toEqual({ unread: 1, ready: true }), { timeout: 10_000 });
      const inbox = await loadInbox(b.uid);
      const got = inbox.items.find((m) => m.id === sentId);
      expect(got).toMatchObject({ from: users.a.uid, fromName: 'A선생', text: '내일 협의회는 3시입니다', readAt: null, to: [b.uid] });
      expect(inbox.cursor).toBeNull();
      await markRead(b.uid, sentId);
      await vi.waitFor(() => expect(useMailStore.getState().unread).toBe(0), { timeout: 10_000 });
      expect((await loadInbox(b.uid)).items.find((m) => m.id === sentId)?.readAt).toBeGreaterThan(0);
      expect(await deleteMail(b.uid, 'in', sentId)).toBe(true);
      expect((await loadInbox(b.uid)).items.some((m) => m.id === sentId)).toBe(false);
    } finally {
      stop();
    }
    expect(useMailStore.getState()).toEqual({ unread: 0, ready: false });
  });

  it('B가 듣는 동안 A가 보내면 onNew 한 번 - 처음 받은 것은 빼고', async () => {
    const b = await signInAs('b');
    // 보내는 A는 따로 띄운 앱으로 (앱 하나는 계정 하나 - 바꾸면 B의 듣기가 끊긴다). 모양은 data/mail sendMail과 같게
    const other = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, 'mailSender');
    const odb = getFirestore(other);
    connectFirestoreEmulator(odb, '127.0.0.1', 8080);
    const oauth = getAuth(other);
    connectAuthEmulator(oauth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await signInWithEmailAndPassword(oauth, 'mailtest-a@example.com', PASSWORD);
    const seen: string[] = [];
    const stop = watchUnread(b.uid, (m) => seen.push(`${m.fromName}: ${m.text}`));
    const id = 'mailEmuNew1';
    try {
      await vi.waitFor(() => expect(useMailStore.getState().ready).toBe(true), { timeout: 10_000 });
      expect(seen).toEqual([]);
      const { inbox, sent } = mailDocs(mail([b.uid], '새 쪽지입니다'), serverTimestamp(), Timestamp.fromMillis(mailExpireAt(Date.now())));
      const w = writeBatch(odb);
      w.set(doc(odb, 'v5Mail', b.uid, 'mailIn', id), inbox);
      w.set(doc(odb, 'v5Mail', users.a.uid, 'mailSent', id), sent);
      await w.commit();
      await vi.waitFor(() => expect(seen).toEqual(['A선생: 새 쪽지입니다']), { timeout: 10_000 });
      expect(useMailStore.getState().unread).toBe(1);
    } finally {
      stop();
      await deleteDoc(doc(db, 'v5Mail', b.uid, 'mailIn', id)).catch(() => {});
      await deleteDoc(doc(odb, 'v5Mail', users.a.uid, 'mailSent', id)).catch(() => {});
      await terminate(odb);
      await deleteApp(other);
    }
  });
});

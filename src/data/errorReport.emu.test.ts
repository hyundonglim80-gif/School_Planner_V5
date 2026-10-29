// 오류 알림 자료 시험 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`, P14-2).
// 앱이 보내는 문서를 규칙(firestore.rules v5Errors)이 받는지, 보낸 사람은 못 읽고 개발자만 읽고 지우는지 본다.
// 점검 전용 계정(errtest@)이 보내고, 개발자 계정(hyundonglim80@ - 에뮬레이터 안에서만)이 끝에 지운다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, getDocs, query, terminate, where } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { app, auth, db } from './firebase';
import { useSession } from './session';
import { enableErrorReports, reportError, resetErrorReportsForTest } from './errorReport';

const PASSWORD = 'test1234';
const DEV = 'hyundonglim80@gmail.com';
let uid = '';

async function signInAs(email: string) {
  try {
    await createUserWithEmailAndPassword(auth, email, PASSWORD);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/network-request-failed') {
      throw new Error('에뮬레이터가 꺼져 있다 - 다른 창에서 npm run emu', { cause: e });
    }
    await signInWithEmailAndPassword(auth, email, PASSWORD);
  }
  const u = auth.currentUser!;
  useSession.setState({ loading: false, user: { uid: u.uid, email, displayName: '', photoURL: '' } });
  return u.uid;
}

const mine = () => getDocs(query(collection(db, 'v5Errors'), where('uid', '==', uid)));

beforeAll(async () => {
  uid = await signInAs('errtest@example.com');
  resetErrorReportsForTest();
  enableErrorReports(true);
});

afterAll(async () => {
  enableErrorReports(false);
  // 개발자로 남은 것을 지운다
  await signInAs(DEV).catch(() => {});
  for (const d of (await mine().catch(() => null))?.docs ?? []) await deleteDoc(d.ref);
  await signOut(auth);
  await terminate(db);
  await deleteApp(app);
});

describe('오류 알림 (에뮬레이터)', () => {
  it('보내면 규칙이 받는다 - 같은 오류는 한 번', async () => {
    // 같은 자리에서 난 같은 오류 (새로 만들면 스택 줄이 달라 다른 오류다)
    const same = new TypeError('emu x is undefined');
    expect(await reportError('error', same)).toBe(true);
    expect(await reportError('error', same)).toBe(false);
    expect(await reportError('toast', Object.assign(new Error('q'), { code: 'resource-exhausted' }), { toastText: '메모를 저장하지 못했습니다.' })).toBe(true);
  });

  it('보낸 사람은 읽지 못한다', async () => {
    await expect(mine()).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('개발자는 읽고 지운다 - 글 없이 오류 문장·판·기기만', async () => {
    await signInAs(DEV);
    const snap = await mine();
    expect(snap.docs.map((d) => d.data().kind).sort()).toEqual(['error', 'toast']);
    const err = snap.docs.find((d) => d.data().kind === 'error')!.data();
    expect(err).toMatchObject({ message: 'TypeError: emu x is undefined', build: 'test', uid });
    expect(err.at.toMillis()).toBeGreaterThan(Date.now() - 60_000);
    for (const d of snap.docs) await deleteDoc(d.ref);
    expect((await mine()).size).toBe(0);
  });
});

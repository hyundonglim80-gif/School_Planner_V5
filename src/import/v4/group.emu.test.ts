// V4 공유 그룹 가져오기 자료 층 테스트 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`). P8-4 ■2.
// V4 groups/{gid}(주인 = 나, 구성원 = 나 + 다른 사람)와 그 밑 자료를 심고 가져와, g_{gid} 공간이 V4 주인·구성원 그대로 생기고
// 그룹 자료·라벨(쓰는 것만)·만든 사람·초대 코드가 규칙을 지나 적히는지, 두 번째 가져오기가 아무것도 쓰지 않는지 본다.
// 점검 전용 계정(importgroup@)에만 쓰고 끝에 지운다. 주인이 아닌 구성원이 가져오는 길은 check-rules·inspect-share-groups가 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, terminate } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { app, auth, db } from '../../data/firebase';
import { useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { GROUP_COLLECTIONS, importedGroupSid } from '../../data/spaces';
import { changedTotal } from './plan';
import { readV4Groups } from './read';
import { runGroupImport, totalCounts, useGroupImportRun } from './run';

const EMAIL = 'importgroup@example.com';
const PASSWORD = 'test1234';
const GID = 'v4GroupEmuTest';
const SID = importedGroupSid(GID);
const OTHER = 'someOtherTeacherUid';
let uid = '';

const V4_SUB = ['events', 'journals', 'tasks', 'schedules', 'notices', 'evaluations', 'settings'];

async function clean() {
  // V5 그룹 공간 (주인이라 지운다 - 없으면 읽기부터 막힌다)
  for (const coll of GROUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, 'spaces', SID, coll));
      for (const d of snap.docs) await deleteDoc(d.ref);
    } catch {
      /* 공간이 없다 */
    }
  }
  try {
    const space = await getDoc(doc(db, 'spaces', SID));
    const code = space.data()?.inviteCode;
    if (code) await deleteDoc(doc(db, 'spaceInvites', code));
    await deleteDoc(doc(db, 'spaces', SID));
  } catch {
    /* 없다 */
  }
  try {
    for (const coll of V4_SUB) {
      const snap = await getDocs(collection(db, 'groups', GID, coll));
      for (const d of snap.docs) await deleteDoc(d.ref);
    }
    await deleteDoc(doc(db, 'groups', GID));
  } catch {
    /* 없다 */
  }
  for (const id of ['labels']) await deleteDoc(doc(db, 'users', uid, 'settings', id));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: string };
const rows = async (coll: string): Promise<Row[]> => {
  const snap = await getDocs(collection(db, 'spaces', SID, coll));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

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
  useSession.setState({ loading: false, user: { uid, email: EMAIL, displayName: '그룹장', photoURL: '' } });
  useMySpaces.setState({ groups: [], loaded: true });
  await clean();
});

afterAll(async () => {
  await clean();
  await signOut(auth);
  await terminate(db);
  await deleteApp(app);
});

describe('V4 그룹 가져오기 (에뮬레이터)', () => {
  it('내가 든 V4 그룹을 읽는다 (array-contains)', async () => {
    await setDoc(doc(db, 'users', uid, 'settings', 'labels'), {
      eventLabels: [
        { id: 'ev_1', name: '협의', color: 'blue' },
        { id: 'ev_2', name: '개인용', color: 'red' },
      ],
      journalLabels: [{ id: 'j_1', name: '회의록', color: 'green' }],
      memoLabels: ['개인 메모'],
    });
    await setDoc(doc(db, 'groups', GID), {
      name: '4학년 협의회', ownerId: uid, ownerName: '그룹장', inviteCode: 'V4GEMU', members: [uid, OTHER],
      memberDetails: { [OTHER]: { name: '동료 선생님', joinedAt: 1 } }, createdAt: 1,
    });
    await setDoc(doc(db, 'groups', GID, 'events', '2026-10-05'), {
      eventList: [
        { id: 'e1', content: '학년 협의', label: '협의', authorId: OTHER, linkedItems: [{ targetType: 'memo', targetId: 'm1', targetFId: GID }] },
        { id: 'e2', content: '내 일정', authorId: uid },
      ],
    });
    await setDoc(doc(db, 'groups', GID, 'journals', '2026-10-05'), { entries: [{ id: 'j1', content: '협의 기록', labelIds: ['j_1'], authorId: OTHER }] });
    await setDoc(doc(db, 'groups', GID, 'tasks', 'm1'), { text: '협의 준비물', labels: [], order: 1, authorId: uid });
    await setDoc(doc(db, 'groups', GID, 'schedules', '2026-10-05'), { periods: { 3: { subject: '과학', memo: '실험' } } });
    await setDoc(doc(db, 'groups', GID, 'notices', '2026-10-05'), { date: '2026-10-05', lines: ['체험학습 동의서'] });
    await setDoc(doc(db, 'groups', GID, 'evaluations', '2026-10-05'), {
      evalList: [{ id: 'ev_a', title: '실험 보고서', type: 'check', authorId: OTHER, rosterMeta: { year: 2026, grade: 4, classNum: 1 }, studentsSnapshot: [{ num: 1, name: '김하나' }], records: { 1: { checked: true } } }],
    });
    const list = await readV4Groups(uid);
    expect(list).toEqual([expect.objectContaining({ id: GID, name: '4학년 협의회', ownerId: uid, members: [uid, OTHER], memberNames: { [OTHER]: '동료 선생님' }, inviteCode: 'V4GEMU' })]);
  });

  it('가져오기: V4 주인·구성원 그대로 공간·초대 코드·그룹 자료·쓰는 라벨만·만든 사람', async () => {
    const [g] = await readV4Groups(uid);
    expect(await runGroupImport(useSession.getState().user!, g)).toBe(SID);
    expect(useGroupImportRun.getState()).toMatchObject({ state: 'done', gid: GID });

    const space = (await getDoc(doc(db, 'spaces', SID))).data()!;
    expect(space).toMatchObject({ kind: 'group', name: '4학년 협의회', ownerId: uid, members: { [uid]: 'owner', [OTHER]: 'member' }, inviteCode: 'V4GEMU' });
    expect((await getDoc(doc(db, 'spaceInvites', 'V4GEMU'))).data()).toMatchObject({ sid: SID, ownerId: uid });
    const people = Object.fromEntries((await rows('people')).map((p) => [p.id, p.name]));
    expect(people).toEqual({ [uid]: '그룹장', [OTHER]: '동료 선생님' });

    const labels = await rows('labels');
    expect(labels.map((l) => l.name).sort()).toEqual(['협의', '회의록']);
    const items = await rows('items');
    const byText = (t: string) => items.find((i) => i.text === t)!;
    expect(byText('학년 협의')).toMatchObject({ kind: 'event', date: '2026-10-05', authorId: OTHER, labelIds: [labels.find((l) => l.name === '협의')!.id], linkIds: [byText('협의 준비물').id] });
    expect(byText('내 일정').authorId).toBe(uid);
    expect(byText('협의 기록')).toMatchObject({ kind: 'note', authorId: OTHER });
    expect(byText('협의 준비물')).toMatchObject({ kind: 'note', date: null });

    expect((await getDoc(doc(db, 'spaces', SID, 'lessonDays', '2026-10-05'))).data()).toMatchObject({ periods: { 3: { subject: '과학', memo: '실험' } } });
    expect((await getDoc(doc(db, 'spaces', SID, 'notices', '2026-10-05'))).data()).toMatchObject({ lines: ['체험학습 동의서'] });
    const [ev] = await rows('evaluations');
    expect(ev).toMatchObject({ title: '실험 보고서', classId: '2026-4-1', authorId: OTHER });
    expect(typeof (await getDoc(doc(db, 'spaces', SID, 'settings', 'import'))).data()?.at).toBe('number');
  });

  it('두 번째 가져오기는 바뀐 것 0', async () => {
    useMySpaces.setState({ groups: [{ id: SID, name: '4학년 협의회', ownerId: uid, members: { [uid]: 'owner', [OTHER]: 'member' }, inviteCode: 'V4GEMU' }], loaded: true });
    const [g] = await readV4Groups(uid);
    expect(await runGroupImport(useSession.getState().user!, g)).toBe(SID);
    expect(changedTotal(totalCounts(useGroupImportRun.getState().results[GID].counts))).toBe(0);
  });
});

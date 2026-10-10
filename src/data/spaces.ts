// 공유 그룹 공간 (P8-4 - V4 hooks/useGroups.ts, DESIGN 4-1). 목록 구독·만들기·초대 코드로 참여·나가기·지우기.
//
// - 그룹 = `spaces/g_{id}` { kind: 'group', name, ownerId, members: { uid: 'owner'|'member' }, inviteCode } - V4는 groups/{id}의 배열이었다.
// - 초대 코드 → 그룹은 `spaceInvites/{code}` { sid, ownerId } 한 건만 읽는다(목록으로 훑지 못한다 - V4 inviteCodes와 같은 까닭).
// - 참여하는 사람은 아직 그룹 문서를 읽지 못한다 - 코드 문서로 sid를 알고 members.{나}만 넣는다(규칙이 그것만 허락한다).
// - 구성원 이름은 `people/{uid}`(그룹 공간 아래 - 참여할 때 내가 적는다). 공간 문서는 주인만 고치므로 거기 두지 않는다.
// - 그룹 지우기는 주인만: 아래 자료를 먼저 비우고(Firestore는 하위 컬렉션을 함께 지우지 않는다 - V4 교훈) 공간 문서와 초대 코드를 지운다.
import { useEffect } from 'react';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { newId } from './id';
import { batch } from './repo';
import { defaultLabelOps } from './labels';
import { cleanInviteCode, inviteCodeOf, rememberGroups, useMySpaces, type GroupSpace, type SpaceRole } from './spaceChoice';
import type { SessionUser } from './session';

/** 그룹 공간 아래에 둘 수 있는 컬렉션 (지울 때 비운다) - 개인 공간에만 있는 것은 그룹에 없다 */
export const GROUP_COLLECTIONS = ['items', 'labels', 'series', 'timetables', 'lessonDays', 'notices', 'evaluations', 'people', 'settings'] as const;


function readGroup(id: string, d: Record<string, unknown>): GroupSpace | null {
  if (d.kind !== 'group') return null;
  const members: Record<string, SpaceRole> = {};
  for (const [uid, role] of Object.entries((d.members as Record<string, unknown>) ?? {})) if (role === 'owner' || role === 'member') members[uid] = role;
  return { id, name: typeof d.name === 'string' && d.name ? d.name : '공유 그룹', ownerId: String(d.ownerId ?? ''), members, ...(typeof d.inviteCode === 'string' && d.inviteCode ? { inviteCode: d.inviteCode } : {}) };
}

/** 내가 든 그룹 목록을 지켜본다 (App - 기기 사본도 이 목록으로 그룹 공간을 받는다) */
export function watchMySpaces(uid: string): () => void {
  useMySpaces.setState({ groups: [], loaded: false });
  const q = query(collection(db, 'spaces'), where(`members.${uid}`, 'in', ['owner', 'member']));
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs
        .map((d) => readGroup(d.id, d.data()))
        .filter((g): g is GroupSpace => !!g)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      useMySpaces.setState({ groups, loaded: true });
      rememberGroups(uid, groups.map((g) => g.id));
    },
    (e) => {
      console.warn('[spaces] 공유 그룹 목록을 받지 못했습니다.', e);
      useMySpaces.setState({ loaded: true });
    },
  );
}

/** 구성원 이름 적기 (참여·만들기 때, 그리고 그룹 관리 창을 열 때 빠졌으면) */
export async function writeMyName(sid: string, user: SessionUser): Promise<void> {
  await setDoc(doc(db, 'spaces', sid, 'people', user.uid), { name: user.displayName || user.email || '선생님', photoURL: user.photoURL || '', joinedAt: Date.now(), updatedAt: serverTimestamp(), v: 1 }, { merge: true });
}

/** 그룹 만들기 - 공간 문서와 초대 코드를 한 묶음으로(규칙이 getAfter로 본다), 그다음 기본 라벨·내 이름 */
export async function createGroup(user: SessionUser, name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error('그룹 이름을 적어 주세요.');
  // 이미 쓰는 코드면 다시 뽑는다
  let code = inviteCodeOf();
  for (let i = 0; i < 5 && (await getDoc(doc(db, 'spaceInvites', code))).exists(); i++) code = inviteCodeOf();
  const sid = `g_${newId()}`;
  const b = writeBatch(db);
  b.set(doc(db, 'spaces', sid), { kind: 'group', name: clean, ownerId: user.uid, members: { [user.uid]: 'owner' }, inviteCode: code, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), v: 1 });
  b.set(doc(db, 'spaceInvites', code), { sid, ownerId: user.uid, createdAt: serverTimestamp() });
  await b.commit();
  // 그룹 라벨은 공간 것 - 처음에 기본 라벨을 둔다(구성원이 같은 목록을 본다). 실패해도 그룹은 만들어졌다
  try {
    await batch([...defaultLabelOps(sid, 'event'), ...defaultLabelOps(sid, 'note')], { fail: '그룹 기본 라벨을 적지 못했습니다.' });
    await writeMyName(sid, user);
  } catch (e) {
    console.warn('[spaces] 그룹 기본 라벨·이름을 적지 못했습니다(그룹은 만들어졌다).', e);
  }
  return sid;
}

/** 초대 코드로 참여 - 코드 문서 한 건 → members.{나} = 'member'. 이미 들었으면 그 sid */
export async function joinGroup(user: SessionUser, rawCode: string): Promise<string> {
  const code = cleanInviteCode(rawCode);
  if (!code) throw new Error('초대 코드를 적어 주세요.');
  const inv = await getDoc(doc(db, 'spaceInvites', code));
  const sid = inv.exists() ? String(inv.data().sid ?? '') : '';
  if (!sid.startsWith('g_')) throw new Error('그 초대 코드의 그룹을 찾지 못했습니다. 코드를 다시 확인해 주세요.');
  if (useMySpaces.getState().groups.some((g) => g.id === sid)) return sid;
  try {
    await updateDoc(doc(db, 'spaces', sid), { [`members.${user.uid}`]: 'member', updatedAt: serverTimestamp() });
  } catch (e) {
    console.error('[spaces] 그룹 참여 실패:', e);
    throw new Error('그룹에 참여하지 못했습니다. 초대가 닫혔거나 코드가 바뀌었을 수 있습니다.');
  }
  await writeMyName(sid, user).catch((e: unknown) => console.warn('[spaces] 이름을 적지 못했습니다.', e));
  return sid;
}

/** 나가기 (구성원만 - 주인은 그룹을 지운다) */
export async function leaveGroup(user: SessionUser, group: GroupSpace): Promise<void> {
  if (group.ownerId === user.uid) throw new Error('그룹장은 나갈 수 없습니다. 그룹 지우기를 써 주세요.');
  await deleteDoc(doc(db, 'spaces', group.id, 'people', user.uid)).catch(() => {});
  await updateDoc(doc(db, 'spaces', group.id), { [`members.${user.uid}`]: deleteField(), updatedAt: serverTimestamp() });
}

/** 그룹 지우기 (주인만) - 아래 자료를 먼저 비운다. 비우다 실패하면 공간 문서는 남겨 다시 할 수 있게 */
export async function deleteGroup(user: SessionUser, group: GroupSpace, onStep?: (msg: string) => void): Promise<void> {
  if (group.ownerId !== user.uid) throw new Error('그룹을 지울 권한이 없습니다(그룹장만).');
  for (const coll of GROUP_COLLECTIONS) {
    onStep?.(`${coll} 비우는 중…`);
    const snap = await getDocs(collection(db, 'spaces', group.id, coll));
    for (let i = 0; i < snap.docs.length; i += 450) {
      const b = writeBatch(db);
      for (const d of snap.docs.slice(i, i + 450)) b.delete(d.ref);
      await b.commit();
    }
  }
  if (group.inviteCode) await deleteDoc(doc(db, 'spaceInvites', group.inviteCode)).catch((e: unknown) => console.warn('[spaces] 초대 코드를 지우지 못했습니다.', e));
  await deleteDoc(doc(db, 'spaces', group.id));
}

/** 구성원 이름 (그룹 관리 창 - 읽기만) */
export async function readPeople(sid: string): Promise<Record<string, { name: string; photoURL: string }>> {
  const snap = await getDocs(collection(db, 'spaces', sid, 'people'));
  return Object.fromEntries(snap.docs.map((d) => [d.id, { name: String(d.data().name ?? ''), photoURL: String(d.data().photoURL ?? '') }]));
}

/** App이 한 번 - 로그인한 동안 내 그룹 목록을 지켜본다 */
export function useMySpacesWatch(uid: string | undefined): void {
  useEffect(() => {
    if (!uid) return;
    return watchMySpaces(uid);
  }, [uid]);
}

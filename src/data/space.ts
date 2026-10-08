// 공간(DESIGN 4-1). 개인 공간 id는 u_{uid} - 찾지 않고 바로 안다.
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const personalSpaceId = (uid: string) => `u_${uid}`;

/**
 * 로그인하면 한 번 부른다. 내 개인 공간 문서가 없으면 만들고, 있으면 아무것도 쓰지 않는다.
 *
 * 개인 공간 아래 자료는 이 문서가 없어도 읽고 쓸 수 있다(규칙이 id만 본다). 그래서 실패해도
 * 앱을 막지 않고 다음 로그인에 다시 한다. 두 탭이 함께 만들어도 같은 모양이라 괜찮다.
 */
export async function ensurePersonalSpace(uid: string): Promise<'created' | 'exists'> {
  const ref = doc(db, 'spaces', personalSpaceId(uid));
  if ((await getDoc(ref)).exists()) return 'exists';
  await setDoc(ref, {
    kind: 'personal',
    name: '',
    ownerId: uid,
    members: { [uid]: 'owner' },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    v: 1,
  });
  return 'created';
}

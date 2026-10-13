// 로그인 상태. 구독은 앱 전체에 하나(main.tsx의 watchSession) - V4는 useAuth를 부르는 곳마다 구독했다.
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import { ensurePersonalSpace, personalSpaceId } from './space';
import { chooseSpace, useMySpaces, useSpaceChoice } from './spaceChoice';
import { showErrorToast } from '../app/toast';

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

interface SessionState {
  /** 새로고침 직후 로그인 상태를 아직 모른다 */
  loading: boolean;
  user: SessionUser | null;
}

export const useSession = create<SessionState>(() => ({ loading: true, user: null }));

const toSessionUser = (u: User): SessionUser => ({
  uid: u.uid,
  email: u.email ?? '',
  displayName: u.displayName ?? '',
  photoURL: u.photoURL ?? '',
});

/** 지금 공간 - 개인 공간 또는 이 기기에서 고른 공유 그룹(P8-4 `spaceChoice`). 로그인하지 않았으면 null */
export function currentSpaceId(): string | null {
  const uid = useSession.getState().user?.uid;
  return uid ? chooseSpace(uid, useSpaceChoice.getState(), useMySpaces.getState()) : null;
}

export function useCurrentSpaceId(): string | null {
  const uid = useSession((s) => s.user?.uid);
  const choice = useSpaceChoice();
  const mine = useMySpaces();
  return uid ? chooseSpace(uid, choice, mine) : null;
}

/** 개인 공간 (진도·학급처럼 개인 공간에만 있는 것 - 그룹 공간을 보고 있어도 여기) */
export function usePersonalSpaceId(): string | null {
  const uid = useSession((s) => s.user?.uid);
  return uid ? personalSpaceId(uid) : null;
}

/** 로그인 상태를 store에 옮기고, 들어오면 개인 공간을 챙긴다. 끊는 함수를 돌려준다. */
export function watchSession(): () => void {
  let lastUid: string | null = null;
  return onAuthStateChanged(auth, (u) => {
    useSession.setState({ loading: false, user: u ? toSessionUser(u) : null });
    if (u && u.uid !== lastUid) {
      ensurePersonalSpace(u.uid).catch((err: unknown) => {
        // 인터넷이 없으면 다음 로그인에 다시 한다. 그 밖(권한 거부 등)은 알린다.
        if ((err as { code?: string })?.code === 'unavailable') {
          console.warn('[space] 개인 공간 확인을 미룹니다(연결 없음).', err);
          return;
        }
        showErrorToast('개인 공간을 준비하지 못했습니다. 잠시 뒤 다시 들어와 주세요.', err);
      });
    }
    lastUid = u?.uid ?? null;
  });
}

// 로그인 상태. 구독은 앱 전체에 하나(main.tsx의 watchSession) - V4는 useAuth를 부르는 곳마다 구독했다.
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import { ensurePersonalSpace } from './space';
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

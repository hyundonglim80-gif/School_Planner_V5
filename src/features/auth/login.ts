// 구글 로그인·로그아웃(V4 features/auth/useAuth.ts에서 옮김). 로그인 상태 자체는 data/session.ts.
import { useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';
import { auth, googleProvider } from '../../data/firebase';
import { showErrorToast } from '../../app/toast';
import { stopPrefsSync } from '../../app/prefs';
import { wipeClipboard } from '../../data/clipboard';
import { wipeDrafts } from '../../data/drafts';
import { keepGoogleToken } from '../../data/google/token';
import { wipeMirror } from '../../data/mirror/sync';
import { forgetPushOnLogout } from '../../data/push';

/** 구글 액세스 토큰을 챙겨 둔다(드라이브·캘린더·시트 - data/google/token이 쓴다) */
function keepAccessToken(result: UserCredential | null) {
  const token = result ? GoogleAuthProvider.credentialFromResult(result)?.accessToken : undefined;
  if (token) keepGoogleToken(token);
}

/** 팝업이 막혀 리디렉션으로 돌아온 로그인을 마무리한다. 앱이 뜰 때 한 번(main.tsx). */
export function finishRedirectLogin() {
  getRedirectResult(auth)
    .then(keepAccessToken)
    .catch((e: unknown) => console.error('리디렉션 로그인 마무리 실패:', e));
}

const errorCode = (e: unknown) => String((e as { code?: string })?.code ?? '');

/** 팝업으로는 안 되는 상황인가 (막혔거나, 창은 떴는데 끝을 못 잡는 경우) */
function popupUnusable(code: string): boolean {
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported'
  );
}

export function useGoogleLogin() {
  // 두 번 누르면 앞의 요청이 취소되며 auth/cancelled-popup-request가 나고 둘 다 실패한다(V4).
  // 팝업이 반응 없어 보이면 누구나 한 번 더 누르므로, 진행 중에는 막고 그것을 보여 준다.
  const signingInRef = useRef(false);
  const [signingIn, setSigningIn] = useState(false);

  const loginWithGoogle = async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setSigningIn(true);
    try {
      // try 안에 둔다 - 밖에서 실패하면 finally를 못 타 단추가 영영 잠긴다(V4).
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      keepAccessToken(await signInWithPopup(auth, googleProvider));
    } catch (error) {
      const code = errorCode(error);
      // 사용자가 스스로 창을 닫은 것은 오류가 아니다.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      if (popupUnusable(code)) {
        // 팝업을 못 쓰는 브라우저·설정이면 리디렉션으로. 페이지를 통째로 옮기므로 여기서 끝난다.
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (e) {
          showErrorToast('로그인 창을 열지 못했습니다. 팝업 차단을 풀고 다시 시도해 주세요.', e);
        }
        return;
      }
      showErrorToast(`로그인하지 못했습니다. (${code || '알 수 없는 오류'})`, error);
    } finally {
      signingInRef.current = false;
      setSigningIn(false);
    }
  };

  return { signingIn, loginWithGoogle };
}

/** 지우기 한 단계가 기다리는 만큼 - 넘으면 그 단계만 두고 넘어간다 */
const WIPE_LIMIT_MS = 5000;

/** 이 기기 저장소 하나를 지운다. 막히거나 실패해도 다른 단계를 막지 않는다 */
async function wipeStep(what: string, wipe: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('시간 초과')), WIPE_LIMIT_MS);
  });
  await Promise.race([wipe(), limit])
    .catch((e: unknown) => console.warn(`[logout] ${what}을(를) 지우지 못했습니다.`, e))
    .finally(() => clearTimeout(timer));
}

/**
 * 로그아웃. 이 기기의 사본·쓰던 글·클립보드·사진을 지운다(다음 사람이 쓰지 않게 - 공용 PC). 다음에 들어오면 사본은 서버에서 다시 받는다.
 * 구글 토큰·명렬표 임시본·창 목록은 다른 탭도 함께 비워야 해서 세션을 듣는 쪽에서 비운다(accountChange).
 */
export async function logout() {
  const uid = auth.currentUser?.uid;
  // 방금 바꿔 1초 뒤 올리려던 설정은 로그아웃 전에 올린다(뒤에 가면 권한이 없다). 연결이 없으면 오래 기다리지 않는다.
  await Promise.race([stopPrefsSync(), new Promise((r) => setTimeout(r, 3000))]);
  // 이 기기 알림 토큰 문서를 지운다 - 다른 계정의 일정 알림이 이 기기로 오지 않게 (P8-2, 나간 뒤에는 권한이 없다)
  await Promise.race([forgetPushOnLogout(), new Promise((r) => setTimeout(r, 3000))]);
  try {
    await signOut(auth);
  } catch (error) {
    showErrorToast('로그아웃하지 못했습니다.', error);
    return;
  }
  await Promise.all([
    ...(uid
      ? [
          wipeStep('기기 사본', () => wipeMirror(uid)),
          wipeStep('쓰던 글 보관', () => wipeDrafts(uid)),
          wipeStep('클립보드 목록', () => wipeClipboard(uid)),
        ]
      : []),
    // 학생 사진은 얼굴 사진이다. 사진을 쓰는 화면에서만 읽는 모듈이라 그때 불러온다
    wipeStep('학생 사진', () => import('../../data/google/studentPhotos').then((m) => m.wipePhotoCache())),
  ]);
}

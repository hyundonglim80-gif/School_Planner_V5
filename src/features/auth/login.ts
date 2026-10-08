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
import { forgetGoogleToken, keepGoogleToken } from '../../data/google/token';
import { wipeMirror } from '../../data/mirror/sync';

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

/** 로그아웃. 이 기기에 챙겨 둔 구글 토큰과 기기 사본도 지운다(다음 사람이 쓰지 않게 - 공용 PC). */
export async function logout() {
  const uid = auth.currentUser?.uid;
  // 방금 바꿔 1초 뒤 올리려던 설정은 로그아웃 전에 올린다(뒤에 가면 권한이 없다). 연결이 없으면 오래 기다리지 않는다.
  await Promise.race([stopPrefsSync(), new Promise((r) => setTimeout(r, 3000))]);
  try {
    await signOut(auth);
  } catch (error) {
    showErrorToast('로그아웃하지 못했습니다.', error);
    return;
  }
  forgetGoogleToken();
  // 기기 사본(학생 자료가 든다)은 다음에 들어오면 서버에서 다시 받는다
  if (uid) await wipeMirror(uid).catch((e: unknown) => console.warn('[mirror] 로그아웃 때 기기 사본을 지우지 못했습니다.', e));
  // 쓰던 글 보관도 같은 까닭으로 (공용 PC)
  if (uid) await wipeDrafts(uid).catch((e: unknown) => console.warn('[drafts] 로그아웃 때 쓰던 글 보관을 지우지 못했습니다.', e));
  // 클립보드 칸 목록도 (비밀번호·캡처가 지나간다)
  if (uid) await wipeClipboard(uid).catch((e: unknown) => console.warn('[clipboard] 로그아웃 때 클립보드 목록을 지우지 못했습니다.', e));
}

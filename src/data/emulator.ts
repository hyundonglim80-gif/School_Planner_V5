// 점검용 에뮬레이터 연결(V4 lib/emulator.ts에서 옮김). 운영 빌드에는 들어가면 안 된다.
//
// __USE_EMULATOR__는 빌드할 때 상수로 바뀐다(vite.config.ts - `--mode emu` 또는 VITE_USE_EMULATOR=1).
// false면 아래 코드는 통째로 번들에서 빠진다. 그래서 운영 빌드에는 에뮬레이터 주소도 자동 로그인도 남지 않는다.
import { connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export const USING_EMULATOR: boolean = __USE_EMULATOR__;

/**
 * 점검용 계정. V4 seed(tools/seed.mjs)가 같은 값으로 만든다.
 * 주소에 ?as=2 를 붙이면 두 번째 계정(공유 그룹을 둘이서), ?as=3 은 교과 전담 계정.
 */
export function emulatorEmail(search: string = window.location.search): string {
  const who = new URLSearchParams(search).get('as');
  if (who === '2') return 'teacher2@example.com';
  if (who === '3') return 'teacher3@example.com';
  return 'teacher@example.com';
}

export const EMULATOR_PASSWORD = 'test1234';

export function connectEmulators(auth: Auth, db: Firestore) {
  if (!USING_EMULATOR) return;
  const host = '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

/**
 * 구글 로그인 창은 사람이 눌러야 하므로 자동 점검을 할 수 없다.
 * 에뮬레이터에서는 seed가 만들어 둔 계정으로 그냥 들어간다.
 */
export async function autoSignIn(auth: Auth) {
  if (!USING_EMULATOR) return;
  // 지난번 계정이 남아 있어도 ?as= 로 고른 계정이 다르면 바꿔 들어간다.
  await auth.authStateReady();
  const email = emulatorEmail();
  if (auth.currentUser?.email === email) return;
  try {
    await signInWithEmailAndPassword(auth, email, EMULATOR_PASSWORD);
  } catch (err) {
    console.error('[emulator] 자동 로그인 실패. V4 seed를 먼저 돌렸는지 확인하세요.', err);
  }
}

// 구글 API 토큰 (V4 lib/googleApi.ts의 토큰 부분). 드라이브 첨부·캡처·학생 사진·백업·캘린더·시트가 여기서 토큰을 받는다.
//
// 구글 액세스 토큰은 한 시간쯤 지나면 만료되고, 새 탭에는 없다(sessionStorage). 그래서 쓰기 전에 확인하고,
// 필요하면 로그인 창을 다시 띄워 받는다.
//
// ⚠️ 브라우저는 사용자가 방금 누른 때가 아니면 로그인 창을 막는다. 파일 고르기 창에서 파일을 고른 뒤나 드라이브에
//    물어본 뒤에는 이미 늦다(V4 2026-10-02 - 첨부가 '실패'로만 끝났다). 그때는 '구글 로그인이 필요합니다' 창(prompt.ts)을
//    띄워 그 단추를 누를 때 로그인 창을 연다.
// ⚠️ 시키지 않은 일(화면을 그리려고 사진을 찾는 일 등)에서는 getGoogleTokenQuietly만 쓴다 - 로그인 창을 띄우지 않는다(V4 명렬표).
import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth';
import { auth, GOOGLE_SCOPES } from '../firebase';
import { askGoogleLogin } from './prompt';

/** 이 기기 탭에 챙겨 둔 토큰 (로그인할 때 features/auth/login이 넣는다) */
export const GOOGLE_TOKEN_KEY = 'sp5-google-token';

/** sessionStorage를 못 쓰는 곳(시크릿 모드 등)에서도 이 탭이 살아 있는 동안은 쓴다 */
let memoryToken: string | null = null;

/** 받은 토큰을 챙겨 둔다 */
export function keepGoogleToken(token: string) {
  memoryToken = token;
  try {
    sessionStorage.setItem(GOOGLE_TOKEN_KEY, token);
  } catch {
    /* 시크릿 모드 등 - 메모리에만 */
  }
}

/** 못 쓰는 토큰을 잊는다. 다음 getValidGoogleToken이 새로 받는다 (드라이브가 401로 거절했을 때·로그아웃). */
export function forgetGoogleToken() {
  memoryToken = null;
  try {
    sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
  } catch {
    /* 무시 */
  }
}

function storedToken(): string {
  if (memoryToken) return memoryToken;
  try {
    return sessionStorage.getItem(GOOGLE_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 구글 로그인을 받지 못했다 (닫았거나 창이 열리지 못했다). 메시지를 그대로 사용자에게 보여 줘도 된다. */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

/** 사용자가 로그인 창을 닫았다 - 다시 묻지 않는다 */
export class GoogleLoginClosedError extends GoogleAuthError {
  constructor() {
    super('구글 로그인 창이 닫혀 로그인하지 못했습니다.');
    this.name = 'GoogleLoginClosedError';
  }
}

/** 브라우저가 로그인 창을 막았다 */
export class GooglePopupBlockedError extends GoogleAuthError {
  constructor() {
    super("팝업이 차단되었습니다. 주소창 오른쪽에서 '팝업 허용'을 눌러 주세요.");
    this.name = 'GooglePopupBlockedError';
  }
}

/**
 * 구글 API가 거절했다. needsLogin(401 토큰 만료, 403 권한 칸을 빼고 허용한 토큰)이면 토큰을 잊고 다시 받으면 된다(withGoogleToken).
 */
export class GoogleApiError extends Error {
  readonly status: number;
  readonly needsLogin: boolean;
  constructor(status: number, message: string, needsLogin = status === 401) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.needsLogin = needsLogin;
  }
}

/** 구글 API 부르기 (JSON). 204면 null. */
export async function googleFetch<T = unknown>(url: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', token: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = '알 수 없는 오류';
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      message = err?.error?.message || message;
    } catch {
      /* 본문이 JSON이 아닐 수 있다 */
    }
    throw new GoogleApiError(res.status, `구글 API 오류 (${res.status}): ${message}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

/**
 * 지금 창을 띄워도 브라우저가 막지 않을지. 사용자가 방금 누른(키를 친) 직후에만 창을 띄울 수 있다.
 * userActivation을 모르는 브라우저는 띄워 보고, 막히면 묻는 창으로 넘어간다.
 */
function canOpenPopupNow(): boolean {
  const act = typeof navigator !== 'undefined' ? (navigator as { userActivation?: { isActive?: boolean } }).userActivation : undefined;
  return !act || act.isActive !== false;
}

/**
 * 쓸 수 있는 토큰이 이미 있으면 준다. 없으면 null - 창을 띄우지 않는다.
 * 화면에 그리려고 부르는 자리(사진 찾기 등)에서는 이쪽만 쓴다.
 */
export async function getGoogleTokenQuietly(): Promise<string | null> {
  const stored = storedToken();
  if (!stored) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(stored)}`);
    return res.ok ? stored : null;
  } catch {
    // 물어보지 못했으면 있는 것으로 치고 써 본다. 정말 못 쓰는 토큰이면 그다음 호출이 401로 떨어진다.
    return stored;
  }
}

/** 다시 받는 로그인 창은 늘 지금 계정으로 (V5 - 다른 계정을 고르면 앱 계정이 바뀌던 것을 막는다, PLAN 5장) */
function reauthProvider(email: string | null | undefined): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  for (const scope of GOOGLE_SCOPES) p.addScope(scope);
  if (email) p.setCustomParameters({ login_hint: email });
  return p;
}

/** 로그인 창을 띄워 토큰을 받는다. ⚠️ 누른 자리에서 곧바로 부른다(앞에 await를 두면 브라우저가 막는다). */
export async function renewGoogleToken(): Promise<string | null> {
  const user = auth.currentUser;
  try {
    const provider = reauthProvider(user?.email);
    const result = user ? await reauthenticateWithPopup(user, provider) : await signInWithPopup(auth, provider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken ?? null;
    if (token) keepGoogleToken(token);
    return token;
  } catch (e) {
    const code = String((e as { code?: string })?.code ?? '');
    if (code === 'auth/popup-blocked') throw new GooglePopupBlockedError();
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') throw new GoogleLoginClosedError();
    if (code === 'auth/user-mismatch') throw new GoogleAuthError(`지금 쓰는 계정${user?.email ? `(${user.email})` : ''}을 골라 주세요.`);
    console.error('구글 권한 받기 실패:', e);
    throw new GoogleAuthError('구글 권한을 받지 못했습니다. 다시 해 보고, 계속 안 되면 로그아웃 후 다시 로그인해 주세요.');
  }
}

/**
 * 쓸 수 있는 토큰을 돌려준다 - 사용자가 단추를 눌러 시킨 일에서만.
 * 조용한 토큰 → (방금 누른 때면) 로그인 창 → '구글 로그인이 필요합니다' 창. 로그인하지 않고 닫으면 GoogleAuthError.
 */
export async function getValidGoogleToken(reason?: string): Promise<string> {
  const quiet = await getGoogleTokenQuietly();
  if (quiet) return quiet;
  if (canOpenPopupNow()) {
    try {
      const token = await renewGoogleToken();
      if (token) return token;
    } catch (e) {
      // 사용자가 닫은 것만 그대로 끝낸다. 막혔거나 다른 까닭이면 묻는 창으로 - 거기 단추는 '방금 누른 것'이다.
      if (e instanceof GoogleLoginClosedError) throw e;
    }
  }
  const token = await askGoogleLogin(reason);
  if (!token) throw new GoogleAuthError('구글 로그인을 하지 않아 진행하지 못했습니다.');
  return token;
}

/**
 * 토큰으로 일을 한다. 토큰이 겉보기엔 살아 있었는데 구글이 거절하면(needsLogin) 잊고 다시 받아(로그인을 묻고) 한 번 더.
 * (V4 driveApi.uploadToDrive의 다시 하기를 한 곳으로)
 */
export async function withGoogleToken<T>(reason: string | undefined, run: (token: string) => Promise<T>): Promise<T> {
  try {
    return await run(await getValidGoogleToken(reason));
  } catch (e) {
    if (!(e instanceof GoogleApiError) || !e.needsLogin) throw e;
    forgetGoogleToken();
    return run(await getValidGoogleToken(reason));
  }
}

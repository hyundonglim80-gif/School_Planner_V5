// 구글 토큰 - 조용한 토큰(창 없음)·방금 누른 때만 로그인 창·막히면 '구글 로그인이 필요합니다'·닫으면 실패·401이면 잊고 한 번 더
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finishGoogleLogin, registerGoogleLoginHost, useGoogleLoginPrompt } from './prompt';
import { forgetGoogleToken, GoogleApiError, GoogleAuthError, GoogleLoginClosedError, getGoogleTokenQuietly, getValidGoogleToken, keepGoogleToken, renewGoogleToken, withGoogleToken } from './token';

vi.mock('../firebase', () => ({ auth: { currentUser: { email: 'me@example.com' } }, GOOGLE_SCOPES: ['drive.file'] }));
const popup = vi.hoisted(() => ({ next: null as null | (() => Promise<unknown>), calls: 0 }));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    scopes: string[] = [];
    params: Record<string, string> = {};
    addScope(s: string) {
      this.scopes.push(s);
    }
    setCustomParameters(p: Record<string, string>) {
      this.params = p;
    }
    static credentialFromResult(r: { token?: string }) {
      return r.token ? { accessToken: r.token } : null;
    }
  }
  const run = () => {
    popup.calls += 1;
    return popup.next ? popup.next() : Promise.resolve({ token: 'fresh' });
  };
  return { GoogleAuthProvider, reauthenticateWithPopup: vi.fn(run), signInWithPopup: vi.fn(run) };
});

const fetchMock = vi.fn();
let active = true;
beforeEach(() => {
  forgetGoogleToken();
  popup.next = null;
  popup.calls = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  active = true;
  Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive: active }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  finishGoogleLogin(null);
});

const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => ({ ok: false, status, json: async () => ({ error: { message: 'no' } }) });

describe('조용한 토큰', () => {
  it('챙겨 둔 것이 없으면 null (창을 띄우지 않는다)', async () => {
    expect(await getGoogleTokenQuietly()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(popup.calls).toBe(0);
  });

  it('tokeninfo가 받으면 그 토큰, 거절하면 null, 묻지 못하면 있는 것으로 친다', async () => {
    keepGoogleToken('t1');
    expect(sessionStorage.getItem('sp5-google-token')).toBe('t1');
    fetchMock.mockResolvedValueOnce(ok());
    expect(await getGoogleTokenQuietly()).toBe('t1');
    fetchMock.mockResolvedValueOnce(fail(400));
    expect(await getGoogleTokenQuietly()).toBeNull();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await getGoogleTokenQuietly()).toBe('t1');
  });
});

describe('쓸 수 있는 토큰', () => {
  it('조용한 토큰이 있으면 그대로', async () => {
    keepGoogleToken('t1');
    fetchMock.mockResolvedValue(ok());
    expect(await getValidGoogleToken()).toBe('t1');
    expect(popup.calls).toBe(0);
  });

  it('방금 누른 때면 로그인 창 → 새 토큰을 챙긴다', async () => {
    expect(await getValidGoogleToken()).toBe('fresh');
    expect(popup.calls).toBe(1);
    expect(sessionStorage.getItem('sp5-google-token')).toBe('fresh');
  });

  it("방금 누른 때가 아니면 '구글 로그인이 필요합니다' 창 - 단추로 받은 토큰을 이어서 쓴다", async () => {
    active = false;
    const off = registerGoogleLoginHost();
    const p = getValidGoogleToken('캘린더 때문에');
    await vi.waitFor(() => expect(useGoogleLoginPrompt.getState()).toEqual({ open: true, reason: '캘린더 때문에' }));
    expect(popup.calls).toBe(0);
    finishGoogleLogin('from-prompt');
    expect(await p).toBe('from-prompt');
    expect(useGoogleLoginPrompt.getState().open).toBe(false);
    off();
  });

  it('창이 막히면 묻는 창으로, 묻는 창을 닫으면 GoogleAuthError', async () => {
    popup.next = () => Promise.reject({ code: 'auth/popup-blocked' });
    const off = registerGoogleLoginHost();
    const p = getValidGoogleToken();
    await vi.waitFor(() => expect(useGoogleLoginPrompt.getState().open).toBe(true));
    finishGoogleLogin(null);
    await expect(p).rejects.toBeInstanceOf(GoogleAuthError);
    off();
  });

  it('사용자가 로그인 창을 닫으면 다시 묻지 않는다', async () => {
    popup.next = () => Promise.reject({ code: 'auth/popup-closed-by-user' });
    const off = registerGoogleLoginHost();
    await expect(getValidGoogleToken()).rejects.toBeInstanceOf(GoogleLoginClosedError);
    expect(useGoogleLoginPrompt.getState().open).toBe(false);
    off();
  });

  it('창을 그릴 곳이 없으면 기다리지 않고 실패', async () => {
    active = false;
    await expect(getValidGoogleToken()).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('다른 계정을 고르면 지금 계정을 고르라고', async () => {
    popup.next = () => Promise.reject({ code: 'auth/user-mismatch' });
    await expect(renewGoogleToken()).rejects.toThrow('me@example.com');
  });
});

describe('withGoogleToken', () => {
  it('구글이 401로 거절하면 토큰을 잊고 다시 받아 한 번 더', async () => {
    keepGoogleToken('old');
    fetchMock.mockResolvedValue(ok());
    const seen: string[] = [];
    const out = await withGoogleToken(undefined, async (t) => {
      seen.push(t);
      if (t === 'old') throw new GoogleApiError(401, '만료');
      return 'done';
    });
    expect(out).toBe('done');
    expect(seen).toEqual(['old', 'fresh']);
  });

  it('다른 거절은 그대로 던진다', async () => {
    keepGoogleToken('t1');
    fetchMock.mockResolvedValue(ok());
    await expect(
      withGoogleToken(undefined, async () => {
        throw new GoogleApiError(500, '서버');
      }),
    ).rejects.toThrow('서버');
  });
});

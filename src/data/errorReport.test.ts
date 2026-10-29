import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { showErrorToast, ShownError } from '../app/toast';
import { useSession } from './session';
import { enableErrorReports, reportError, reportReactError, resetErrorReportsForTest, startErrorReports } from './errorReport';

vi.mock('./firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const sent = vi.hoisted(() => ({ docs: [] as Record<string, unknown>[], fail: null as Error | null }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  serverTimestamp: () => 'SERVER_TIME',
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  addDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
    if (sent.fail) throw sent.fail;
    sent.docs.push({ ...data, _path: ref.path });
    return { id: `e${sent.docs.length}` };
  }),
}));

const signIn = () => useSession.setState({ loading: false, user: { uid: 'u1', email: 'teacher@example.com', displayName: '김선생', photoURL: '' } });

beforeEach(() => {
  sent.docs = [];
  sent.fail = null;
  resetErrorReportsForTest();
  enableErrorReports(true);
  signIn();
});

afterAll(() => {
  enableErrorReports(false);
  useSession.setState({ loading: true, user: null });
});

describe('reportError', () => {
  it('문서 하나 - 칸 열둘, 내 uid, 서버 시각, 30일 뒤 expireAt', async () => {
    const before = Date.now();
    expect(await reportError('error', new TypeError('x is undefined'))).toBe(true);
    expect(sent.docs).toHaveLength(1);
    const d = sent.docs[0];
    expect(d._path).toBe('v5Errors');
    expect(Object.keys(d).filter((k) => k !== '_path').sort()).toEqual(
      ['at', 'build', 'device', 'expireAt', 'kind', 'message', 'note', 'scope', 'stack', 'standalone', 'ua', 'uid'].sort(),
    );
    expect(d).toMatchObject({ kind: 'error', message: 'TypeError: x is undefined', uid: 'u1', at: 'SERVER_TIME', build: 'test' });
    const ms = (d.expireAt as { ms: number }).ms;
    expect(ms - before).toBeGreaterThanOrEqual(30 * 86400000 - 1000);
    expect(ms - before).toBeLessThan(31 * 86400000);
  });

  it('같은 오류를 다시 내도 늘지 않는다', async () => {
    const err = new Error('같은 것');
    await reportError('error', err);
    expect(await reportError('error', err)).toBe(false);
    expect(sent.docs).toHaveLength(1);
  });

  it('로그인하지 않았거나 꺼져 있으면(개발 서버·에뮬레이터 빌드) 보내지 않는다', async () => {
    useSession.setState({ loading: false, user: null });
    expect(await reportError('error', new Error('a'))).toBe(false);
    signIn();
    enableErrorReports(false);
    expect(await reportError('error', new Error('b'))).toBe(false);
    expect(sent.docs).toHaveLength(0);
  });

  it('소음은 버린다 · 보내기가 막혀도 던지지 않는다', async () => {
    expect(await reportError('error', new Error('ResizeObserver loop limit exceeded'))).toBe(false);
    expect(await reportError('rejection', new ShownError('이미 안내함'))).toBe(false);
    sent.fail = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    await expect(reportError('error', new Error('규칙 배포 전'))).resolves.toBe(false);
  });

  it('문서에 메모 글·이메일이 없다', async () => {
    await reportError('rejection', new Error("'김철수 상담 기록' 저장 실패 - teacher@example.com spaces/u_u1/items/abc"));
    const json = JSON.stringify(sent.docs[0]);
    expect(json).not.toContain('김철수');
    expect(json).not.toContain('teacher@example.com');
    expect(json).not.toContain('u_u1');
  });

  it('React 그리기 오류는 컴포넌트 스택을 note에', async () => {
    reportReactError(new Error('render'), { componentStack: '\n    at DayView\n    at Shell' });
    await vi.waitFor(() => expect(sent.docs).toHaveLength(1));
    expect(sent.docs[0]).toMatchObject({ kind: 'react', message: 'render', note: 'at DayView\nat Shell' });
  });
});

describe('startErrorReports', () => {
  startErrorReports();

  it('잡지 못한 오류·약속 거절', async () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new RangeError('bad'), message: 'bad', filename: 'http://x/assets/a.js' }));
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('거절');
    window.dispatchEvent(rejection);
    await vi.waitFor(() => expect(sent.docs).toHaveLength(2));
    expect(sent.docs.map((d) => [d.kind, d.message])).toEqual([
      ['error', 'RangeError: bad'],
      ['rejection', '거절'],
    ]);
  });

  it('확장 프로그램 오류는 버린다', async () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('ext'), message: 'ext', filename: 'chrome-extension://abc/c.js' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(sent.docs).toHaveLength(0);
  });

  it("오류를 넘긴 안내만 'toast'로 - 안내 글 + 오류 이름·코드, 입력 확인 안내는 보내지 않는다", async () => {
    showErrorToast("'우리반.csv'에서 차시를 찾지 못했습니다.");
    showErrorToast('메모를 저장하지 못했습니다.', Object.assign(new Error('Quota 김철수'), { name: 'FirebaseError', code: 'resource-exhausted' }));
    await vi.waitFor(() => expect(sent.docs).toHaveLength(1));
    expect(sent.docs[0]).toMatchObject({ kind: 'toast', message: '❌ 메모를 저장하지 못했습니다.'.slice(2), note: 'FirebaseError resource-exhausted' });
    expect(JSON.stringify(sent.docs[0])).not.toContain('김철수');
  });
});

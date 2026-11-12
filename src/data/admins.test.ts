import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// 서버 흉내: admin/admins 문서 하나 (denied = 규칙이 막음)
const server = vi.hoisted(() => ({ doc: null as Record<string, unknown> | null, denied: false, reads: 0, written: null as Record<string, unknown> | null }));
vi.mock('./firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: vi.fn(async () => {
    server.reads++;
    if (server.denied) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    return { exists: () => server.doc !== null, data: () => server.doc };
  }),
  runTransaction: vi.fn(async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      get: async () => ({ exists: () => server.doc !== null, data: () => server.doc }),
      set: (_ref: unknown, data: Record<string, unknown>) => {
        server.written = data;
        server.doc = data;
      },
    }),
  ),
}));

import { forgetAdminCheck, updateAdmins, useIsAdmin } from './admins';
import { useSession } from './session';

const signIn = (email: string) => useSession.setState({ loading: false, user: { uid: 'u1', email, displayName: '', photoURL: '' } });

beforeEach(() => {
  forgetAdminCheck();
  Object.assign(server, { doc: null, denied: false, reads: 0, written: null });
});

describe('관리자인가 (P33-1 useIsAdmin)', () => {
  it('기본 셋은 서버를 읽지 않고 곧바로', () => {
    signIn('hyundonglim.work@gmail.com');
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
    expect(server.reads).toBe(0);
  });

  it('더한 관리자 = 목록을 한 번 읽은 뒤 (대소문자는 보지 않는다)', async () => {
    server.doc = { emails: ['extra@example.com'] };
    signIn('Extra@Example.com');
    const { result, rerender } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
    rerender();
    renderHook(() => useIsAdmin());
    expect(server.reads).toBe(1);
  });

  it('규칙이 막으면 (관리자가 아님) 그냥 아니다', async () => {
    server.denied = true;
    signIn('teacher@example.com');
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(server.reads).toBe(1));
    expect(result.current).toBe(false);
  });

  it('다른 계정으로 바뀌면 다시 본다', async () => {
    server.doc = { emails: ['a@example.com'] };
    signIn('a@example.com');
    const { result, rerender } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current).toBe(true));
    signIn('b@example.com');
    rerender();
    await waitFor(() => expect(server.reads).toBe(2));
    expect(result.current).toBe(false);
  });
});

describe('관리자 목록 고치기 (updateAdmins)', () => {
  it('서버의 지금 목록 위에 고치고, 적은 사람·때를 함께', async () => {
    server.doc = { emails: ['other@example.com'] };
    signIn('hyundonglim80@gmail.com');
    const next = await updateAdmins((cur) => [...cur, 'new@example.com']);
    expect(next).toEqual(['other@example.com', 'new@example.com']);
    expect(server.written).toMatchObject({ emails: ['other@example.com', 'new@example.com'], updatedBy: 'hyundonglim80@gmail.com' });
    expect(typeof server.written!.updatedAt).toBe('number');
  });

  it('나를 빼면 이 창에서도 곧바로 관리자가 아니다', async () => {
    server.doc = { emails: ['me@example.com'] };
    signIn('me@example.com');
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current).toBe(true));
    await updateAdmins((cur) => cur.filter((e) => e !== 'me@example.com'));
    await waitFor(() => expect(result.current).toBe(false));
  });
});

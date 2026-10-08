import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDoc, setDoc } from 'firebase/firestore';
import { ensurePersonalSpace, personalSpaceId } from './space';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'SERVER_TIME'),
}));

beforeEach(() => vi.clearAllMocks());

describe('개인 공간', () => {
  it('id는 u_{uid}', () => {
    expect(personalSpaceId('abc')).toBe('u_abc');
  });

  it('없으면 나 혼자 owner인 개인 공간을 만든다', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    expect(await ensurePersonalSpace('abc')).toBe('created');
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = vi.mocked(setDoc).mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe('spaces/u_abc');
    expect(data).toEqual({
      kind: 'personal',
      name: '',
      ownerId: 'abc',
      members: { abc: 'owner' },
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
      v: 1,
    });
  });

  it('있으면 아무것도 쓰지 않는다', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as never);
    expect(await ensurePersonalSpace('abc')).toBe('exists');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('읽기가 실패하면 던진다 (부르는 쪽이 안내)', async () => {
    vi.mocked(getDoc).mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await expect(ensurePersonalSpace('abc')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(setDoc).not.toHaveBeenCalled();
  });
});

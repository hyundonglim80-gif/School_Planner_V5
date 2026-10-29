import { beforeEach, describe, expect, it } from 'vitest';
import { beginPendingWrite, hasPendingWrites, resetPendingWritesForTest, usePendingWrites } from './pendingWrites';

beforeEach(() => resetPendingWritesForTest());

describe('서버가 아직 받지 않은 쓰기 (P14-6 ■1)', () => {
  it('센 수와 가장 오래 기다린 시작 시각', () => {
    const a = beginPendingWrite(1000);
    const b = beginPendingWrite(2000);
    expect(usePendingWrites.getState()).toEqual({ count: 2, since: 1000 });
    expect(hasPendingWrites()).toBe(true);
    a();
    expect(usePendingWrites.getState()).toEqual({ count: 1, since: 2000 });
    b();
    expect(usePendingWrites.getState()).toEqual({ count: 0, since: null });
    expect(hasPendingWrites()).toBe(false);
  });

  it('끝을 두 번 불러도 한 번만 뺀다 (같은 시각에 시작한 다른 쓰기는 남는다)', () => {
    const a = beginPendingWrite(500);
    beginPendingWrite(500);
    a();
    a();
    expect(usePendingWrites.getState()).toEqual({ count: 1, since: 500 });
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../../data/repo', () => ({
  create: vi.fn(async () => []),
  patch: vi.fn(async () => []),
  remove: vi.fn(async () => []),
}));
vi.mock('../../data/undo', () => ({ recordUndo: vi.fn() }));

import { patch } from '../../data/repo';
import type { Stored } from '../../data/types';
import { saveProgressPlan } from './actions';

// P14-6 ■4 두 기기: 진도 창은 이 기기가 바꾼 묶음만 넘긴다 - 그 밖의 칸은 지금 서버 판 그대로

const lesson = (content: string) => ({ unit: '', no: '', content, page: '', supplies: '' });
const before = {
  id: 'p1',
  key: '국어',
  startDate: '2026-09-08',
  lessons: [lesson('남의 행')],
  bumps: [],
  noCount: true,
} as unknown as Stored<'progress'>;
const next = { id: 'p1', key: '국어', startDate: '2026-09-01', lessons: [lesson('내 행')], noCount: true };

describe('saveProgressPlan - 바꾼 묶음만 (P14-6 ■4)', () => {
  it('only가 차시 목록이면 시작일은 지금 판 그대로 (다른 기기가 고친 시작일을 되돌리지 않는다)', async () => {
    vi.mocked(patch).mockClear();
    expect(await saveProgressPlan('u_me', next, before, new Set(['lessons']))).toBe(true);
    expect(vi.mocked(patch).mock.calls[0][1]).toEqual({ lessons: [lesson('내 행')] });
  });

  it('only가 없으면 전처럼 다른 칸 모두', async () => {
    vi.mocked(patch).mockClear();
    await saveProgressPlan('u_me', next, before);
    expect(vi.mocked(patch).mock.calls[0][1]).toEqual({ startDate: '2026-09-01', lessons: [lesson('내 행')] });
  });

  it('바꾼 묶음이 서버와 같으면 적지 않는다', async () => {
    vi.mocked(patch).mockClear();
    expect(await saveProgressPlan('u_me', next, before, new Set(['target']))).toBe(false);
    expect(patch).not.toHaveBeenCalled();
  });
});

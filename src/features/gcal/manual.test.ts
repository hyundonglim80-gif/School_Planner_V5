import { describe, expect, it, vi } from 'vitest';

// 진짜 Firebase 앱이 뜨지 않게 (CLAUDE.md 2장)
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, GOOGLE_SCOPES: [], googleProvider: { addScope: () => {} } }));

import { rangeForScope } from './manual';

describe('지금 보는 화면의 기간 (⋮ 구글 캘린더·백업 \'이 화면\')', () => {
  it('하루는 그날, 주간·한눈에는 그 주(월 ~ 일), 월간은 그 달', () => {
    expect(rangeForScope('day', '2026-11-06')).toEqual({ start: '2026-11-06', end: '2026-11-06' });
    expect(rangeForScope('week', '2026-11-06')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(rangeForScope('board', '2026-11-06')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(rangeForScope('month', '2026-11-06')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });
});

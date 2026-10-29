import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftPlace, draftPlaceLabel, draftSummary } from './draftList';

afterEach(() => vi.useRealTimers());

describe('남은 쓰던 글 줄 (P14-6 ■1b)', () => {
  it('열쇠 → 칸 자리: NotePanel·EventPanel의 useDraft 열쇠 그대로 다시 연다', () => {
    expect(draftPlace('note:u_me:new:2026-10-30', { text: 'a' })).toEqual({ kind: 'note', sid: 'u_me', date: '2026-10-30' });
    expect(draftPlace('note:u_me:new:memo', { text: 'a' })).toEqual({ kind: 'note', sid: 'u_me', date: null });
    expect(draftPlace('note:g_x:abc', { text: 'a', dates: ['2026-10-01', '2026-10-05'] })).toEqual({ kind: 'note', sid: 'g_x', id: 'abc', date: '2026-10-01' });
    expect(draftPlace('note:u_me:abc', { text: 'a', dates: [] })).toEqual({ kind: 'note', sid: 'u_me', id: 'abc', date: null });
    expect(draftPlace('event:u_me:new:2026-10-30', { date: '2026-10-30' })).toEqual({ kind: 'event', sid: 'u_me', date: '2026-10-30' });
    expect(draftPlace('event:u_me:ev1', { date: '2026-11-02' })).toEqual({ kind: 'event', sid: 'u_me', id: 'ev1', date: '2026-11-02' });
  });

  it('날 없는 일정 글은 오늘로 열고, 모르는 열쇠는 뺀다', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 30, 9));
    expect(draftPlace('event:u_me:ev1', {})).toEqual({ kind: 'event', sid: 'u_me', id: 'ev1', date: '2026-10-30' });
    expect(draftPlace('event:u_me:new:', {})).toBeNull();
    expect(draftPlace('lesson:u_me:x', {})).toBeNull();
    expect(draftPlace('note:x', {})).toBeNull();
    expect(draftPlace('note', {})).toBeNull();
  });

  it('자리 글', () => {
    expect(draftPlaceLabel({ kind: 'note', sid: 'u_me', date: '2026-10-30' })).toBe('새 메모 · 10/30(금)');
    expect(draftPlaceLabel({ kind: 'note', sid: 'u_me', date: null })).toBe('새 메모');
    expect(draftPlaceLabel({ kind: 'event', sid: 'g_x', id: 'e', date: '2026-10-30' })).toBe('고치던 일정 · 그룹');
  });

  it('줄 글 = 제목 또는 글의 첫 줄(빈 줄 건너뜀), 40자까지', () => {
    expect(draftSummary({ title: ' 회의 ', text: '본문' })).toBe('회의');
    expect(draftSummary({ title: '', text: '\n\n  오프라인 시험 1\n둘째 줄' })).toBe('오프라인 시험 1');
    expect(draftSummary({ text: '가'.repeat(50) })).toBe(`${'가'.repeat(40)}…`);
    expect(draftSummary({ text: '', attachments: [{}] })).toBe('(글 없음 - 첨부·표·날짜만)');
    expect(draftSummary(null)).toBe('(글 없음 - 첨부·표·날짜만)');
  });
});

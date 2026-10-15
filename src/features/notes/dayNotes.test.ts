import { describe, expect, it } from 'vitest';
import type { ItemDoc } from '../events/eventOps';
import { dayNoteSources, noteFromLabel } from './dayNotes';

const doc = (id: string, more: Partial<ItemDoc> = {}): ItemDoc =>
  ({ id, order: 'a0', kind: 'note', date: null, text: id, labelIds: [], ...more }) as unknown as ItemDoc;

describe('그날 메모 칸에 모이는 메모 (P10-4)', () => {
  const notes: Record<string, ItemDoc> = {
    d1: doc('d1', { date: '2026-10-15' }),
    m1: doc('m1'),
    m2: doc('m2'),
    m3: doc('m3'),
    gone: doc('gone', { deletedAt: 1 } as unknown as Partial<ItemDoc>),
    ev2: doc('ev2', { kind: 'event' }),
  };
  const byId = (id: string) => notes[id];

  it('날짜 링크 → 일정에 이은 것 → 수업에 이은 것 → 진도, 겹치지 않게', () => {
    const rows = dayNoteSources({
      dated: [notes.d1],
      events: [doc('ev1', { kind: 'event', text: '현장체험학습 안내', linkIds: ['m1', 'd1', 'ev2', 'lesson:2026-10-15:2'] })],
      lessons: [
        { n: 2, subject: '과학', linkIds: ['m2', 'm1'] },
        { n: 3, subject: '', linkIds: [] },
      ],
      progress: [{ n: 2, planId: 'p1', title: '과학 5차시', linkIds: ['m3', 'm2'] }],
      byId,
    });
    expect(rows.map((r) => [r.item.id, r.dated, r.from.map((f) => f.kind)])).toEqual([
      ['d1', true, ['event']],
      ['m1', false, ['event', 'lesson']],
      ['m2', false, ['lesson', 'progress']],
      ['m3', false, ['progress']],
    ]);
  });

  it('지운 메모·일정 아닌 것·없는 id는 빼고, 같은 일정이 두 번 와도 한 번', () => {
    const ev = doc('ev1', { kind: 'event', linkIds: ['gone', 'ev2', 'nope', 'm1'] });
    const rows = dayNoteSources({ dated: [], events: [ev, ev], byId });
    expect(rows.map((r) => r.item.id)).toEqual(['m1']);
    expect(rows[0].from).toHaveLength(1);
  });

  it('지운 일정에 이은 메모는 오지 않는다', () => {
    const rows = dayNoteSources({ dated: [], events: [doc('ev1', { kind: 'event', linkIds: ['m1'], deletedAt: 1 } as unknown as Partial<ItemDoc>)], byId });
    expect(rows).toEqual([]);
  });

  it('카드 표시 글: 일정 첫 글자 8자 · n교시 · 진도', () => {
    expect(noteFromLabel({ kind: 'event', id: 'e', text: '\n현장체험학습 안내문 보내기\n둘째 줄' }).text).toBe('📌 현장체험학습 안…');
    expect(noteFromLabel({ kind: 'event', id: 'e', text: '' }).text).toBe('📌 일정');
    expect(noteFromLabel({ kind: 'lesson', n: 3, subject: '과학' })).toEqual({ key: 'lesson:3', text: '🏫 3교시', title: '이은 수업: 3교시 과학' });
    expect(noteFromLabel({ kind: 'progress', n: 2, planId: 'p', title: '과학 5차시' }).text).toBe('📘 과학 5차시');
  });
});

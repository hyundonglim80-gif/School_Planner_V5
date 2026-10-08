// 링크 쓰기 - 잇기 = 양쪽 linkIds(이미 이은 것은 그대로·자기 자신은 빼고), 끊기 = 양쪽에서(빈 목록이면 칸을 지운다), 수업 링크는 항목 쪽만
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { ItemDoc } from '../events/eventOps';
import { lessonLinkId, linkKindOf, linkOps, parseLessonLink, unlinkOps } from './linkOps';

const t = new Timestamp(1, 0);
const item = (id: string, more: Partial<ItemDoc> = {}) =>
  ({ id, kind: 'note', date: '2026-10-08', text: id, labelIds: [], order: 'a0', deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', ...more }) as ItemDoc;
const SID = 'u_me';

describe('링크 쓰기', () => {
  it('잇기 = 양쪽에 서로의 id (이미 이은 것·자기 자신은 건드리지 않는다)', () => {
    const src = item('s', { linkIds: ['b'] });
    const ops = linkOps(SID, src, [item('a'), item('b', { linkIds: ['s'] }), src]);
    expect(ops).toEqual([
      { type: 'patch', at: { sid: SID, coll: 'items', id: 's' }, changes: { linkIds: ['b', 'a'] }, before: src },
      { type: 'patch', at: { sid: SID, coll: 'items', id: 'a' }, changes: { linkIds: ['s'] }, before: expect.objectContaining({ id: 'a' }) },
    ]);
  });

  it('바뀐 것이 없으면 쓰지 않는다', () => {
    expect(linkOps(SID, item('s', { linkIds: ['a'] }), [item('a', { linkIds: ['s'] })])).toEqual([]);
  });

  it('수업 링크는 항목 쪽에만', () => {
    const ops = linkOps(SID, item('s'), [], [lessonLinkId('2026-10-08', 3)]);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ changes: { linkIds: ['lesson:2026-10-08:3'] } });
    expect(parseLessonLink('lesson:2026-10-08:3')).toEqual({ date: '2026-10-08', period: 3 });
    expect(parseLessonLink('abc')).toBeNull();
  });

  it('끊기 = 양쪽에서, 마지막 하나면 칸을 지운다(undefined), 상대가 없으면 내 쪽만', () => {
    const src = item('s', { linkIds: ['a', 'b'] });
    const a = item('a', { linkIds: ['s'] });
    expect(unlinkOps(SID, src, 'a', a)).toEqual([
      { type: 'patch', at: { sid: SID, coll: 'items', id: 's' }, changes: { linkIds: ['b'] }, before: src },
      { type: 'patch', at: { sid: SID, coll: 'items', id: 'a' }, changes: { linkIds: undefined }, before: a },
    ]);
    expect(unlinkOps(SID, src, 'gone')).toEqual([]);
    expect(unlinkOps(SID, src, 'b')).toHaveLength(1);
  });

  it('종류: 일정 · 기록(날짜) · 메모(날짜 없음)', () => {
    expect(linkKindOf({ kind: 'event', date: '2026-10-08' })).toBe('event');
    expect(linkKindOf({ kind: 'note', date: '2026-10-08' })).toBe('journal');
    expect(linkKindOf({ kind: 'note', date: null })).toBe('memo');
  });
});

// 작년 이맘때 가져오기 - 일정은 글·라벨·속성만(완료·알림·링크·첨부·기한·묶음 빼고), 기록은 글·라벨·표, 첨부만 있는 기록은 못 고른다,
// 올해 같은 글은 건너뛴다(고른 것끼리도), 그날 맨 뒤 차례
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Docs } from '../../data/select';
import { existsThisYear, importedMessage, isImportableNote, lastYearImportPlan } from './lastYear';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', labelIds: [] as string[] };
const items = {
  ly1: { id: 'ly1', ...base, kind: 'event', date: '2025-10-08', text: '학부모 상담', labelIds: ['E1'], order: 'a0', done: true, time: '09:00', due: '2025-10-10', linkIds: ['x'], attachments: [{ name: 'a', url: 'u', type: 'file' }], seriesId: 's1', props: { forward: true } },
  ly2: { id: 'ly2', ...base, kind: 'event', date: '2025-10-08', text: '운동회', order: 'a1' },
  ly3: { id: 'ly3', ...base, kind: 'note', date: '2025-10-08', text: '상담 기록', labelIds: ['N1'], order: 'a0', tables: [{ id: 't', rows: [{ cells: [{ v: '가' }] }], createdAt: 0 }], attachments: [{ name: 'b', url: 'v', type: 'file' }] },
  ly4: { id: 'ly4', ...base, kind: 'note', date: '2025-10-08', text: '', order: 'a1', attachments: [{ name: 'c', url: 'w', type: 'image/png' }] },
  ty1: { id: 'ty1', ...base, kind: 'event', date: '2026-10-07', text: ' 운동회 ', order: 'a5' },
} as unknown as Docs<'items'>;
const TO = '2026-10-07';
let n = 0;
const makeId = () => `new${++n}`;

describe('작년 이맘때 가져오기', () => {
  it('일정은 글·라벨·속성만, 기록은 글·라벨·표만 - 그날 맨 뒤', () => {
    n = 0;
    const plan = lastYearImportPlan('u_me', items, [{ item: items.ly1, toDate: TO }, { item: items.ly3, toDate: TO }], makeId);
    expect(plan.ops).toEqual([
      { type: 'create', at: { sid: 'u_me', coll: 'items', id: 'new1' }, data: { kind: 'event', date: TO, text: '학부모 상담', labelIds: ['E1'], order: expect.any(String), props: { forward: true } } },
      { type: 'create', at: { sid: 'u_me', coll: 'items', id: 'new2' }, data: { kind: 'note', date: TO, text: '상담 기록', labelIds: ['N1'], order: expect.any(String), tables: items.ly3.tables } },
    ]);
    expect((plan.ops[0] as unknown as { data: { order: string } }).data.order > 'a5').toBe(true);
    expect(importedMessage(plan)).toBe('📥 작년 일정 1개 · 기록 1개를 올해로 가져왔습니다.');
  });

  it('올해 같은 글(앞뒤 공백 무시)·고른 것끼리 같은 글은 건너뛴다, 첨부만 있는 기록은 못 고른다', () => {
    expect(existsThisYear(items, items.ly2, TO)).toBe(true);
    expect(isImportableNote(items.ly4)).toBe(false);
    const plan = lastYearImportPlan('u_me', items, [{ item: items.ly2, toDate: TO }, { item: items.ly1, toDate: '2026-10-09' }, { item: items.ly1, toDate: '2026-10-09' }, { item: items.ly4, toDate: TO }], makeId);
    expect(plan.ops).toHaveLength(1);
    expect(plan.skipped).toBe(2);
    expect(importedMessage(plan)).toBe('📥 작년 일정 1개를 올해로 가져왔습니다. 그날 같은 글이 있어 2개는 건너뛰었습니다.');
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Stored } from '../../data/types';
import { rosterOps } from './classes';
import { draftsOf, isDirty } from './rosterDraft';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const SID = 'u_me';
const st = (sid: string, num: number, name: string) => ({ sid, num, name, status: 'active' as const });
const doc = (id: string, year: number, grade: number, num: number, students = [st('a', 1, '김')]) =>
  ({ id, year, grade, num, students, deletedAt: null, createdAt: 1, authorId: 'me', updatedAt: null, v: 1 }) as unknown as Stored<'classes'>;

describe('명렬표 저장 = 바뀐 학급만', () => {
  const docs = { '2026-5-2': doc('2026-5-2', 2026, 5, 2), '2026-5-3': doc('2026-5-3', 2026, 5, 3) };
  const items = Object.values(docs).map((d) => ({ id: d.id, year: d.year, grade: d.grade, num: d.num, students: d.students }));

  it('그대로면 쓰기 없음', () => {
    expect(rosterOps(SID, draftsOf(items), docs)).toEqual([]);
  });

  it('학생을 고치면 그 학급의 students만, 새 학급은 만들기, 빠진 학급은 지운 표시', () => {
    const drafts = draftsOf(items);
    drafts[0] = { ...drafts[0], students: [st('a', 1, '김하늘'), st('b', 2, '이')] };
    drafts.splice(1, 1);
    drafts.push({ year: 2026, grade: 6, num: 1, students: [] });
    const ops = rosterOps(SID, drafts, docs);
    expect(ops.map((o) => [o.type, o.at.id])).toEqual([
      ['patch', '2026-5-2'],
      ['create', '2026-6-1'],
      ['remove', '2026-5-3'],
    ]);
    expect(ops[0].type === 'patch' && ops[0].changes).toEqual({ students: [st('a', 1, '김하늘'), st('b', 2, '이')] });
  });

  it('학년도·학년·반을 고치면 새 id로 옮기고(학생 sid 그대로) 옛 것은 지운 표시', () => {
    const drafts = draftsOf(items).slice(0, 1).map((d) => ({ ...d, num: 4 }));
    const ops = rosterOps(SID, [...drafts, draftsOf(items)[1]], docs);
    expect(ops.map((o) => [o.type, o.at.id])).toEqual([
      ['create', '2026-5-4'],
      ['remove', '2026-5-2'],
    ]);
    expect(ops[0].type === 'create' && (ops[0].data as { students: unknown[] }).students).toEqual([st('a', 1, '김')]);
  });

  it('고친 것이 있나 - 학급이 없을 때 처음 보이는 빈 학급은 고친 것이 아니다', () => {
    expect(isDirty(null, items)).toBe(false);
    expect(isDirty(draftsOf(items), items)).toBe(false);
    expect(isDirty(draftsOf([]), [])).toBe(false);
    const d = draftsOf(items);
    d[0] = { ...d[0], students: [...d[0].students, st('c', 2, '박')] };
    expect(isDirty(d, items)).toBe(true);
  });
});

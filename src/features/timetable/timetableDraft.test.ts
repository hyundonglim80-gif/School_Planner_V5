import { describe, expect, it } from 'vitest';
import type { Stored } from '../../data/types';
import { cleanGrid, draftProblem, firstTimetable, timetableOps } from './timetableDraft';

const doc = (id: string, over: Partial<Stored<'timetables'>> = {}) =>
  ({ id, name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어' } }, deletedAt: null, ...over }) as Stored<'timetables'>;

describe('시간표 표 다듬기', () => {
  it('빈 칸·요일 밖·교시 밖을 빼고 글자를 다듬는다', () => {
    expect(cleanGrid({ '1': { '1': ' 국어 ', '2': '', '9': '보충' }, '6': { '1': '토' }, '3': { '2': '  ' } }, 6)).toEqual({ '1': { '1': '국어' } });
  });
});

describe('고친 것 → 쓰기', () => {
  const docs = { a: doc('a'), b: doc('b', { name: '2학기', from: '2026-08-17' }), gone: doc('gone', { deletedAt: 1 as never }) };

  it('바뀐 칸만 고치고, 새것은 만들고, 지운 것은 지운 표시', () => {
    const ops = timetableOps(
      'u_me',
      docs,
      {
        a: { id: 'a', name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' } } },
        b: { id: 'b', name: ' 2학기 ', from: '2026-08-17', to: '2027-02-28', grid: { '1': { '1': ' 국어' } } },
        n: { id: 'n', name: '', from: '2026-10-14', to: '2027-02-28', grid: { '3': { '1': '음악' } } },
      },
      ['b'],
      6,
    );
    expect(ops).toEqual([
      { type: 'patch', at: { sid: 'u_me', coll: 'timetables', id: 'a' }, changes: { grid: { '1': { '1': '국어', '2': '수학' } } }, before: docs.a },
      { type: 'create', at: { sid: 'u_me', coll: 'timetables', id: 'n' }, data: { name: '시간표', from: '2026-10-14', to: '2027-02-28', grid: { '3': { '1': '음악' } } } },
      { type: 'remove', at: { sid: 'u_me', coll: 'timetables', id: 'b' } },
    ]);
  });

  it('아무것도 적지 않은 새 시간표는 만들지 않는다, 바뀐 것이 없으면 쓰지 않는다', () => {
    expect(timetableOps('u_me', docs, { x: firstTimetable('x', 2026), a: { ...docs.a } }, [], 6)).toEqual([]);
  });

  it('기간이 틀리면 저장 전에 알린다', () => {
    expect(draftProblem([{ id: 'a', name: '2학기', from: '2026-09-01', to: '2026-08-31', grid: {} }])).toMatch(/늦습니다/);
    expect(draftProblem([{ id: 'a', name: '', from: '', to: '2026-08-31', grid: {} }])).toMatch(/기간/);
    expect(draftProblem([firstTimetable('x', 2026)])).toBeNull();
  });
});

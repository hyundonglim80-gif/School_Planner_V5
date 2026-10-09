// D-Day - 남은 날 글, 머리줄에는 고른 것 하나(지우면 내린다), 처음 더한 것은 곧바로 고른다, 지운 표시·되살리기
import { describe, expect, it } from 'vitest';
import { addDDay, ddayText, liveDDays, primaryDDay, purgeDDay, readDDayList, removeDDay, restoreDDay } from './dday';

describe('D-Day', () => {
  it('남은 날: D-n · D-Day · D+n', () => {
    expect(ddayText('2026-10-20', '2026-10-08')).toEqual({ text: 'D-12', diff: 12 });
    expect(ddayText('2026-10-08', '2026-10-08').text).toBe('D-Day');
    expect(ddayText('2026-10-05', '2026-10-08').text).toBe('D+3');
  });

  it('처음 더한 것은 고른다, 고른 것을 지우면 내린다, 되살리면 다시', () => {
    let s = addDDay({ list: [], pick: null }, { id: 'a', title: '수능', date: '2026-11-19' });
    expect(s.pick).toBe('a');
    s = addDDay(s, { id: 'b', title: '방학', date: '2026-12-24' });
    expect(s.pick).toBe('a');
    s = removeDDay(s, 'a', 5);
    expect(s.pick).toBeNull();
    expect(primaryDDay(s)).toBeNull();
    expect(liveDDays(s.list).map((d) => d.id)).toEqual(['b']);
    s = restoreDDay(s, 'a', 'a');
    expect(primaryDDay(s)?.title).toBe('수능');
    expect(s.list[0]).toEqual({ id: 'a', title: '수능', date: '2026-11-19' });
    expect(purgeDDay(s, 'b').list.map((d) => d.id)).toEqual(['a']);
  });

  it('고른 것이 지워져 있으면 새로 더한 것을 고른다', () => {
    const s = addDDay({ list: [{ id: 'a', title: 'x', date: '2026-01-01', deletedAt: 1 }], pick: 'a' }, { id: 'b', title: 'y', date: '2026-02-01' });
    expect(s.pick).toBe('b');
  });

  it('설정 칸 읽기: 모양이 틀린 것은 뺀다', () => {
    expect(readDDayList('x')).toBeUndefined();
    expect(readDDayList([{ id: 'a', title: '수능', date: '2026-11-19' }, { id: 'b', title: 1, date: '2026-01-01' }, { id: 'c', title: 'z', date: '2026/01/01' }, null])).toEqual([
      { id: 'a', title: '수능', date: '2026-11-19' },
    ]);
  });
});

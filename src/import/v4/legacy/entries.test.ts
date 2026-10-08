import { describe, expect, it } from 'vitest';
import { dueOf, isHolidayEvent, journalLabelNames, periodPieceOf, readJournalEntries, sanitizeDueMap } from './entries';

describe('V4 기록·일정 옛 모양 읽기', () => {
  it('readJournalEntries - id 없는 기록에 jr_차례', () => {
    const list = readJournalEntries({ entries: [{ id: 'a', content: 'x' }, { content: 'y' }] });
    expect(list.map((e) => e.id)).toEqual(['a', 'jr_1']);
    expect(list[1].__idless).toBe(true);
    expect(readJournalEntries(null)).toEqual([]);
  });
  it('journalLabelNames - id·이름 둘 다 (V4 moveEntry 시험 그대로)', () => {
    const LABELS = [
      { id: 'j_1', name: '학급활동' },
      { id: 'jm_긴급', name: '긴급' },
    ];
    expect(journalLabelNames({ labelIds: ['j_1', 'j_없음'], label: '긴급' }, LABELS)).toEqual(['학급활동', '긴급']);
  });
  it('isHolidayEvent - 공휴일·휴일 라벨', () => {
    expect(isHolidayEvent({ label: '공휴일' })).toBe(true);
    expect(isHolidayEvent({ labelIds: ['휴일'] })).toBe(true);
    expect(isHolidayEvent({ label: '달력' })).toBe(false);
  });
  it('dueOf - 일정 기한 → 뗀 것 → 사슬 기한', () => {
    const map = sanitizeDueMap({ c1: '2026-10-10', bad: 'x' });
    expect(map).toEqual({ c1: '2026-10-10' });
    expect(dueOf({ due: '2026-10-09', forwardChainId: 'c1' }, map)).toBe('2026-10-09');
    expect(dueOf({ due: '', forwardChainId: 'c1' }, map)).toBe('');
    expect(dueOf({ forwardChainId: 'c1' }, map)).toBe('2026-10-10');
  });
  it('periodPieceOf - groupId + (i/n)', () => {
    expect(periodPieceOf({ groupId: 'g' }, '기말고사 (2/5)')).toEqual({ key: 'g|기말고사|5', base: '기말고사', index: 2, total: 5 });
    expect(periodPieceOf({}, '기말고사 (2/5)')).toBeNull();
    expect(periodPieceOf({ groupId: 'g' }, '협의회')).toBeNull();
    expect(periodPieceOf({ groupId: 'g' }, '이상 (6/5)')).toBeNull();
  });
});

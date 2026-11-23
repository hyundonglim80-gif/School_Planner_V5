import { describe, it, expect } from 'vitest';
import {
  isLongEntry,
  previewLine,
  COLLAPSE_CHAR_LIMIT,
  COLLAPSE_LINE_LIMIT,
  ENTRY_OPEN_LIMIT,
  isCardCollapsed,
  isRowExpanded,
  rememberEntryOpen,
} from './entryCollapse';

describe('접은 채로 시작할 기준', () => {
  it('짧은 글은 펼친 채로 둔다', () => {
    expect(isLongEntry('오늘 급식 지도')).toBe(false);
  });

  it('빈 글은 길지 않다', () => {
    expect(isLongEntry('')).toBe(false);
    expect(isLongEntry('   \n  ')).toBe(false);
    expect(isLongEntry(undefined)).toBe(false);
  });

  it('글자 수가 기준을 넘으면 접는다', () => {
    expect(isLongEntry('가'.repeat(COLLAPSE_CHAR_LIMIT))).toBe(false);
    expect(isLongEntry('가'.repeat(COLLAPSE_CHAR_LIMIT + 1))).toBe(true);
  });

  it('짧은 줄이라도 줄 수가 많으면 접는다', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `- 항목 ${i}`).join('\n');
    expect(isLongEntry(lines(COLLAPSE_LINE_LIMIT))).toBe(false);
    expect(isLongEntry(lines(COLLAPSE_LINE_LIMIT + 1))).toBe(true);
  });
});

describe('접혔을 때 보여 줄 한 줄', () => {
  it('첫 줄을 쓴다', () => {
    expect(previewLine('학부모 상담\n둘째 줄은 안 보인다')).toBe('학부모 상담');
  });

  it('앞의 빈 줄은 건너뛴다', () => {
    expect(previewLine('\n\n  실제 첫 줄')).toBe('실제 첫 줄');
  });

  it('너무 길면 말줄임한다', () => {
    const out = previewLine('나'.repeat(100));
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThan(100);
  });

  it('내용이 없으면 빈 문자열', () => {
    expect(previewLine('')).toBe('');
    expect(previewLine(null)).toBe('');
  });
});

describe('펼침·접힘 기억 (11-23)', () => {
  it('누른 적 없는 카드는 길이로, 누른 것은 그 값으로', () => {
    const long = '가'.repeat(COLLAPSE_CHAR_LIMIT + 1);
    expect(isCardCollapsed({}, 'a', long)).toBe(true);
    expect(isCardCollapsed({}, 'a', '짧은 글')).toBe(false);
    expect(isCardCollapsed({ a: true }, 'a', long)).toBe(false);
    expect(isCardCollapsed({ a: false }, 'a', '짧은 글')).toBe(true);
  });

  it('목록 줄은 펼친 것만 펼친다 (처음은 접힘)', () => {
    expect(isRowExpanded({}, 'a')).toBe(false);
    expect(isRowExpanded({ a: false }, 'a')).toBe(false);
    expect(isRowExpanded({ a: true }, 'a')).toBe(true);
  });

  it('방금 누른 것을 맨 뒤로 옮기고, 한도를 넘으면 오래된 것부터 잊는다', () => {
    let map = rememberEntryOpen({}, 'a', true, 3);
    map = rememberEntryOpen(map, 'b', false, 3);
    map = rememberEntryOpen(map, 'c', true, 3);
    map = rememberEntryOpen(map, 'a', false, 3);
    expect(Object.entries(map)).toEqual([
      ['b', false],
      ['c', true],
      ['a', false],
    ]);
    map = rememberEntryOpen(map, 'd', true, 3);
    expect(Object.keys(map)).toEqual(['c', 'a', 'd']);
  });

  it('기본 한도는 1000개', () => {
    let map: Record<string, boolean> = {};
    for (let i = 0; i < ENTRY_OPEN_LIMIT + 5; i++) map = rememberEntryOpen(map, `id${i}`, true);
    expect(Object.keys(map)).toHaveLength(ENTRY_OPEN_LIMIT);
    expect(map.id0).toBeUndefined();
    expect(map[`id${ENTRY_OPEN_LIMIT + 4}`]).toBe(true);
  });
});

// 한눈에 첫 칸 목록 - 그 달 '달력' 일정을 날짜 차례로 (기간은 그 달 안 첫날, 같은 날이면 기간 먼저)
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { labelTreeOf, type Docs } from '../../data/select';
import { spaceTone } from '../../domain/spaceColor';
import { calendarEvents } from '../month/calendarEvents';
import { monthCalendarList, rowDateLabel, shiftMonth } from './monthList';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', labelIds: [] as string[] };
const labels = {
  off: { id: 'off', ...base, kind: 'event', name: '개인', color: 'red', parentId: null, order: 'a1', props: { calendar: false } },
} as unknown as Docs<'labels'>;
const items = {
  a: { id: 'a', ...base, kind: 'event', date: '2026-11-12', text: '현장체험', order: 'a1' },
  b: { id: 'b', ...base, kind: 'event', date: '2026-11-12', text: '같은 날 둘째', order: 'a2' },
  c: { id: 'c', ...base, kind: 'event', date: '2026-11-03', text: '개인 - 달력 끔', labelIds: ['off'], order: 'a0' },
  d: { id: 'd', ...base, kind: 'event', date: '2026-10-28', endDate: '2026-11-02', text: '앞 달에서 걸친 기간', order: 'a0' },
  e: { id: 'e', ...base, kind: 'event', date: '2026-11-12', endDate: '2026-11-13', text: '같은 날 시작한 기간', order: 'a9' },
  f: { id: 'f', ...base, kind: 'event', date: '2026-10-27', text: '달력 칸에는 보이는 앞 달 날', order: 'a0' },
  g: { id: 'g', ...base, kind: 'event', date: '2026-11-30', endDate: '2026-12-02', text: '다음 달로 걸친 기간', order: 'a0' },
  h: { id: 'h', ...base, kind: 'event', date: '2026-12-01', text: '다음 달', order: 'a0' },
} as unknown as Docs<'items'>;

// 월요일부터 달력 칸 = 2026-10-26 ~ 12-06
const tree = labelTreeOf(labels, 'event');

describe('그 달 달력 일정 목록', () => {
  it('그 달만 날짜 차례 - 기간은 그 달 안 첫날, 같은 날이면 기간 먼저, 달력을 끈 것은 없다', () => {
    const cal = calendarEvents(items, '2026-10-26', '2026-12-06', tree);
    const rows = monthCalendarList(cal, '2026-11-01', '2026-11-30');
    expect(rows.map((r) => [r.ev.id, r.day])).toEqual([
      ['d', '2026-11-01'],
      ['e', '2026-11-12'],
      ['a', '2026-11-12'],
      ['b', '2026-11-12'],
      ['g', '2026-11-30'],
    ]);
    expect(rows.map(rowDateLabel)).toEqual(['10/28~11/2', '11/12~11/13', '11/12', '11/12', '11/30~12/2']);
  });

  it('겹친 공간 것은 같은 날 주 공간 것 뒤에', () => {
    const gItems = { g1: { id: 'g1', ...base, kind: 'event', date: '2026-11-12', text: '그룹 하루', order: 'a0' } } as unknown as Docs<'items'>;
    const space = { sid: 'g_a', name: '3학년', tone: spaceTone('g_a'), items: gItems, tree: labelTreeOf({} as Docs<'labels'>, 'event') };
    const cal = calendarEvents(items, '2026-10-26', '2026-12-06', tree, [space]);
    const ids = monthCalendarList(cal, '2026-11-01', '2026-11-30').map((r) => r.ev.id);
    expect(ids).toEqual(['d', 'e', 'a', 'b', 'g1', 'g']);
    expect(cal.spaceOf.get(monthCalendarList(cal, '2026-11-01', '2026-11-30')[4].ev)).toBe(space);
  });
});

describe('달 옮기기 (한눈에 위 칸 = 이번 달, 아래 칸 = 다음 달 - 11-09)', () => {
  it('해를 넘는다', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2027-02', 0)).toBe('2027-02');
    expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  });
});

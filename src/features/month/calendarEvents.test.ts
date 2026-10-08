// 달력 일정 - '달력' 속성(이 일정만 정한 값 → 라벨, 라벨이 없으면 켬), 하루짜리는 그날 칸에, 범위에 걸친 기간은 막대로
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { labelTreeOf, type Docs } from '../../data/select';
import { calendarEvents } from './calendarEvents';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', labelIds: [] as string[] };
const labels = {
  on: { id: 'on', ...base, kind: 'event', name: '학사', color: 'blue', parentId: null, order: 'a0', props: { calendar: true } },
  off: { id: 'off', ...base, kind: 'event', name: '개인', color: 'red', parentId: null, order: 'a1', props: { calendar: false } },
} as unknown as Docs<'labels'>;
const items = {
  a: { id: 'a', ...base, kind: 'event', date: '2026-10-06', text: '라벨 없음', order: 'a0' },
  b: { id: 'b', ...base, kind: 'event', date: '2026-10-06', text: '개인 라벨', labelIds: ['off'], order: 'a1' },
  c: { id: 'c', ...base, kind: 'event', date: '2026-10-06', text: '개인이지만 이 일정만 켬', labelIds: ['off'], order: 'a2', props: { calendar: true } },
  d: { id: 'd', ...base, kind: 'event', date: '2026-09-28', endDate: '2026-10-02', text: '앞 달에서 걸친 기간', labelIds: ['on'], order: 'a0' },
  e: { id: 'e', ...base, kind: 'event', date: '2026-10-07', text: '학사 라벨이지만 이 일정만 끔', labelIds: ['on'], order: 'a0', props: { calendar: false } },
  f: { id: 'f', ...base, kind: 'note', date: '2026-10-06', text: '기록은 올리지 않는다', order: 'a0' },
  g: { id: 'g', ...base, kind: 'event', date: '2026-11-20', text: '범위 밖', order: 'a0' },
} as unknown as Docs<'items'>;

describe('달력 일정', () => {
  it('달력 속성을 켠 일정만 - 하루짜리는 날짜별, 기간은 따로', () => {
    const cal = calendarEvents(items, '2026-09-27', '2026-10-31', labelTreeOf(labels, 'event'));
    expect([...cal.byDate.keys()]).toEqual(['2026-10-06']);
    expect(cal.byDate.get('2026-10-06')!.map((d) => d.id)).toEqual(['a', 'c']);
    expect(cal.periods.map((d) => d.id)).toEqual(['d']);
  });

  it('범위 첫날 앞에서 시작한 기간도 걸친다', () => {
    const cal = calendarEvents(items, '2026-10-01', '2026-10-31', labelTreeOf(labels, 'event'));
    expect(cal.periods.map((d) => d.id)).toEqual(['d']);
    expect(calendarEvents(items, '2026-10-03', '2026-10-31', labelTreeOf(labels, 'event')).periods).toEqual([]);
  });
});

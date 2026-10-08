// 링크 연결 창 목록 - 범위(±1주일·학기·학년도·기간 설정)·종류·라벨·키워드·최근 것부터·지운 것/자기 자신은 빼고
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Docs } from '../../data/select';
import { candidatesOf, rangeOf } from './linkerList';

const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, authorId: 'me', labelIds: [], order: 'a0' };
const items = {
  e1: { id: 'e1', ...base, createdAt: 0, kind: 'event', date: '2026-10-08', text: '학부모 상담' },
  e2: { id: 'e2', ...base, createdAt: 0, kind: 'event', date: '2026-09-01', endDate: '2026-10-05', text: '긴 기간' },
  e3: { id: 'e3', ...base, createdAt: 0, kind: 'event', date: '2026-12-01', text: '먼 일정' },
  j1: { id: 'j1', ...base, createdAt: 0, kind: 'note', date: '2026-10-07', text: '상담 기록', labelIds: ['L1'] },
  j2: { id: 'j2', ...base, createdAt: 0, kind: 'note', date: '2026-10-09', text: '다른 기록', deletedAt: t },
  m1: { id: 'm1', ...base, createdAt: new Date(2026, 9, 1).getTime(), kind: 'note', date: null, text: '준비 메모' },
  m2: { id: 'm2', ...base, createdAt: 0, kind: 'note', date: null, text: '' },
} as unknown as Docs<'items'>;

describe('링크 연결 창 목록', () => {
  it('범위: ±1주일·±1개월·학기·학년도(잇는 쪽 학년도 - 2월에 열어도)·기간 설정', () => {
    const custom = { start: '2026-01-01', end: '2026-01-31' };
    expect(rangeOf('1week', '2026-10-08', custom)).toEqual({ start: '2026-10-01', end: '2026-10-15' });
    expect(rangeOf('1month', '2026-10-08', custom)).toEqual({ start: '2026-09-08', end: '2026-11-07' });
    expect(rangeOf('sem2', '2027-02-10', custom)).toEqual({ start: '2026-09-01', end: '2027-02-28' });
    expect(rangeOf('year', '2027-02-10', custom)).toEqual({ start: '2026-03-01', end: '2027-02-28' });
    expect(rangeOf('custom', '2026-10-08', custom)).toEqual(custom);
  });

  it('종류·범위(기간 일정은 걸치면)·최근 것부터, 지운 것·자기 자신은 빼고', () => {
    const r = rangeOf('1week', '2026-10-08', { start: '', end: '' });
    expect(candidatesOf(items, 'event', r).map((c) => c.id)).toEqual(['e1', 'e2']);
    expect(candidatesOf(items, 'event', r, { exclude: 'e1' }).map((c) => c.id)).toEqual(['e2']);
    expect(candidatesOf(items, 'journal', r).map((c) => c.id)).toEqual(['j1']);
  });

  it('메모는 만든 날로 범위, 빈 글은 뺀다', () => {
    expect(candidatesOf(items, 'memo', rangeOf('1week', '2026-10-08', { start: '', end: '' })).map((c) => [c.id, c.date])).toEqual([['m1', '2026-10-01']]);
    expect(candidatesOf(items, 'memo', { start: '2026-11-01', end: '2026-11-30' })).toEqual([]);
  });

  it('라벨(하나라도)·키워드', () => {
    const r = { start: '2026-01-01', end: '2026-12-31' };
    expect(candidatesOf(items, 'journal', r, { labelIds: ['L1'] }).map((c) => c.id)).toEqual(['j1']);
    expect(candidatesOf(items, 'journal', r, { labelIds: ['L9'] })).toEqual([]);
    expect(candidatesOf(items, 'event', r, { keyword: '상담' }).map((c) => c.id)).toEqual(['e1']);
  });
});

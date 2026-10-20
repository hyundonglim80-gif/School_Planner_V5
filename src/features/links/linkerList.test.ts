// 링크 연결 창 목록 - 범위(±1주일·학기·학년도·기간 설정)·종류·라벨·키워드·최근 것부터·지운 것/자기 자신은 빼고
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Docs } from '../../data/select';
import { candidatesOf, lessonCandidatesOf, progressCandidatesOf, rangeOf } from './linkerList';
import type { ProgressMark } from '../../domain/progress';
import type { Stored } from '../../data/types';
import type { LessonSource } from '../../domain/lessons';

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
    expect(candidatesOf(items, 'note', r).map((c) => c.id)).toEqual(['j1', 'm1']);
  });

  it('메모 하나 (P10-4): 날짜 링크 하나라도 범위 안이면 - 그 가운데 가장 늦은 날, 날짜 링크가 없으면 만든 날, 빈 글은 뺀다', () => {
    const r = rangeOf('1week', '2026-10-08', { start: '', end: '' });
    expect(candidatesOf(items, 'note', r).map((c) => [c.id, c.date])).toEqual([
      ['j1', '2026-10-07'],
      ['m1', '2026-10-01'],
    ]);
    expect(candidatesOf(items, 'note', { start: '2026-11-01', end: '2026-11-30' })).toEqual([]);
    const linked = {
      ...items,
      d2: { id: 'd2', ...base, createdAt: 0, kind: 'note', date: '2026-09-01', dates: ['2026-09-01', '2026-10-05', '2026-10-30'], text: '여러 날 메모' },
    } as unknown as Docs<'items'>;
    expect(candidatesOf(linked, 'note', r).find((c) => c.id === 'd2')?.date).toBe('2026-10-05');
    expect(candidatesOf(linked, 'note', { start: '2026-09-10', end: '2026-09-30' }).map((c) => c.id)).toEqual([]);
  });

  it('라벨(하나라도)·키워드', () => {
    const r = { start: '2026-01-01', end: '2026-12-31' };
    expect(candidatesOf(items, 'note', r, { labelIds: ['L1'] }).map((c) => c.id)).toEqual(['j1']);
    expect(candidatesOf(items, 'note', r, { labelIds: ['L9'] })).toEqual([]);
    expect(candidatesOf(items, 'event', r, { keyword: '상담' }).map((c) => c.id)).toEqual(['e1']);
  });
});

describe('🏫 수업 탭 (계산한 수업 칸)', () => {
  it('범위 안의 과목·비고(준비물)가 있는 칸 - 최근 날짜부터, 같은 날은 교시 차례, 키워드', () => {
    const src: LessonSource = {
      timetables: [{ id: 't', from: '2026-03-01', to: '2027-02-28', grid: { '4': { '1': '국어', '2': '수학' } } }],
      days: { '2026-10-08': { periods: { '3': { memo: '실험 준비' } } } },
      count: 3,
    };
    const list = lessonCandidatesOf(src, { start: '2026-10-01', end: '2026-10-08' });
    expect(list.map((c) => [c.id, c.text])).toEqual([
      ['lesson:2026-10-08:1', '1교시 국어'],
      ['lesson:2026-10-08:2', '2교시 수학'],
      ['lesson:2026-10-08:3', '3교시 (과목 없음) · 실험 준비'],
      ['lesson:2026-10-01:1', '1교시 국어'],
      ['lesson:2026-10-01:2', '2교시 수학'],
    ]);
    expect(lessonCandidatesOf(src, { start: '2026-10-01', end: '2026-10-08' }, '실험').map((c) => c.id)).toEqual(['lesson:2026-10-08:3']);
  });
});

describe('📘 진도표 탭 (P11-1 - 그 차시를 하는 날로)', () => {
  const row = (content: string) => ({ unit: '', no: '', content, page: '', supplies: '' });
  const plan = (id: string, key: string, lessons: ReturnType<typeof row>[], more: Record<string, unknown> = {}) =>
    ({ id, key, startDate: '2026-09-01', bumps: [], lessons, deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', ...more }) as unknown as Stored<'progress'>;
  const docs = { p1: plan('p1', '과학', [row('불'), row('물'), row('흙')]), p2: plan('p2', '국어', [row('시')]), p3: plan('p3', '사회', [row('땅')], { deletedAt: t }) };
  const mark = (planId: string, index: number | null, more: Partial<ProgressMark> = {}): ProgressMark => ({ planId, key: '', index, total: 3, run: { k: 1, n: 1 }, lesson: null, bumped: index === null, ...more });
  const marks: Record<string, ProgressMark> = {
    '2026-10-06#2': mark('p1', 0),
    '2026-10-08#3': mark('p1', 1),
    '2026-10-08#1': mark('p1', 1, { cls: '5-1' }), // 과정 - 다른 반이 같은 날 먼저
    '2026-10-12#4': mark('p1', null), // 민 교시
    '2026-10-20#2': mark('p1', 2), // 범위 밖
    '2026-10-07#5': mark('p2', 0),
    '2026-10-07#6': mark('p3', 0), // 지운 진도
  };
  const range = { start: '2026-10-01', end: '2026-10-15' };

  it('범위 안에 하는 행만 - 행 하나에 한 줄(범위 안 첫 교시), 최근 날부터 · 민 교시·지운 진도는 빼고', () => {
    expect(progressCandidatesOf(docs, marks, range).map((c) => [c.id, c.date, c.text])).toEqual([
      ['progress:p1:1', '2026-10-08', '1교시 · 과학 2차시 · 물'],
      ['progress:p2:0', '2026-10-07', '5교시 · 국어 1차시 · 시'],
      ['progress:p1:0', '2026-10-06', '2교시 · 과학 1차시 · 불'],
    ]);
  });

  it('진도 고르기·키워드', () => {
    expect(progressCandidatesOf(docs, marks, range, { planIds: ['p2'] }).map((c) => c.id)).toEqual(['progress:p2:0']);
    expect(progressCandidatesOf(docs, marks, range, { keyword: '불' }).map((c) => c.id)).toEqual(['progress:p1:0']);
    expect(progressCandidatesOf(docs, marks, { start: '2026-10-16', end: '2026-10-31' }).map((c) => c.id)).toEqual(['progress:p1:2']);
  });
});

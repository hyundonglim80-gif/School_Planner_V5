// 검색 셈 - 갈래·기간(메모는 만든 날)·빈 검색어 = 모두·표 칸 글·첨부는 파일마다·날짜 내림차순
import { describe, expect, it } from 'vitest';
import { lessonSpan, scopeRange, searchItems, searchLessons, type SearchKind, type Searchable } from './search';
import type { LessonSource } from './lessons';

const ts = (d: string) => new Date(`${d}T09:00:00`).getTime();
const items: Searchable[] = [
  { id: 'e1', kind: 'event', date: '2026-10-08', text: '현장체험학습 안내' },
  { id: 'e2', kind: 'event', date: '2026-09-28', endDate: '2026-10-02', text: '중간고사 기간' },
  { id: 'j1', kind: 'note', date: '2026-10-07', text: '상담 기록', tables: [{ rows: [{ cells: [{ v: '현장체험' }, { v: '버스' }] }] }] },
  { id: 'm1', kind: 'note', date: null, text: '현장체험 준비물', createdAt: ts('2026-10-01'), attachments: [{ name: '안내문.pdf', url: 'u1' }, { name: '사진.png' }] },
  { id: 'm2', kind: 'note', date: null, text: '날짜 모르는 메모' },
  { id: 'x', kind: 'other', date: '2026-10-08', text: '현장체험' },
];
const q = (term: string, kinds: SearchKind[] = [], range: { start: string; end: string } | null = null) => searchItems(items, { term, kinds: new Set(kinds), range });

describe('검색', () => {
  it('글·표 칸 글에서 (대소문자 무시), 날짜 내림차순, 메모는 만든 날', () => {
    expect(q('현장체험').map((h) => `${h.kind}:${h.key}:${h.date}`)).toEqual(['event:e1:2026-10-08', 'journal:j1:2026-10-07', 'memo:m1:2026-10-01', 'attachment:m1#0:2026-10-01', 'attachment:m1#1:2026-10-01']);
  });

  it('갈래 고르기 - 첨부만이면 파일마다 (붙은 곳)', () => {
    const hits = q('', ['attachment']);
    expect(hits.map((h) => [h.key, h.file?.name, h.where])).toEqual([
      ['m1#0', '안내문.pdf', 'memo'],
      ['m1#1', '사진.png', 'memo'],
    ]);
    expect(q('안내문', ['attachment']).map((h) => h.key)).toEqual(['m1#0']);
  });

  it('빈 검색어 = 그 기간의 모든 것, 기간 일정은 걸치면, 만든 날 모르는 메모는 남긴다', () => {
    const hits = q('', ['event', 'journal', 'memo'], { start: '2026-10-01', end: '2026-10-31' });
    expect(hits.map((h) => h.key)).toEqual(['e1', 'j1', 'm1', 'e2', 'm2']);
    expect(q('', ['event'], { start: '2026-10-03', end: '2026-10-31' }).map((h) => h.key)).toEqual(['e1']);
  });

  it('기간: 학년도(1~2월은 지난해)·해당 주(월~금)·해당 월', () => {
    expect(scopeRange('all', '2026-10-08', { start: '', end: '' })).toBeNull();
    expect(scopeRange('year', '2027-01-10', { start: '', end: '' })).toEqual({ start: '2026-03-01', end: '2027-02-28' });
    expect(scopeRange('week', '2026-10-08', { start: '', end: '' })).toEqual({ start: '2026-10-05', end: '2026-10-09' });
    expect(scopeRange('month', '2026-02-10', { start: '', end: '' })).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(scopeRange('custom', '2026-10-08', { start: '2026-01-01', end: '2026-01-31' })).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });
});

describe('수업 찾기 (계산한 수업 칸 - P6-1)', () => {
  const src: LessonSource = {
    timetables: [{ id: 't', from: '2026-10-05', to: '2026-10-09', grid: { '1': { '1': '과학' }, '2': { '1': '국어' } } }],
    days: { '2026-10-06': { periods: { '2': { memo: '과학실 실험', supplies: '비커' } } } },
    count: 2,
  };
  const q = (term: string, kinds: SearchKind[] = [], range: { start: string; end: string } | null = null) => ({ term, kinds: new Set(kinds), range });

  it('과목·수업 메모·비고를 따로, 날짜 내림차순', () => {
    expect(searchLessons(src, q('과학')).map((h) => [h.kind, h.date, h.n, h.text])).toEqual([
      ['lessonMemo', '2026-10-06', 2, '과학실 실험'],
      ['lesson', '2026-10-05', 1, '과학'],
    ]);
    expect(searchLessons(src, q('비커')).map((h) => h.key)).toEqual(['lesson:2026-10-06:2:lessonSupplies']);
  });

  it('갈래·기간으로 거르고, 전체 기간은 시간표·수업 칸이 있는 범위', () => {
    expect(searchLessons(src, q('과학', ['event']))).toEqual([]);
    expect(searchLessons(src, q('과학', ['lesson'])).map((h) => h.kind)).toEqual(['lesson']);
    expect(searchLessons(src, q('', [], { start: '2026-10-06', end: '2026-10-06' })).map((h) => h.text)).toEqual(['국어', '과학실 실험', '비커']);
    expect(lessonSpan(src)).toEqual({ start: '2026-10-05', end: '2026-10-09' });
    expect(lessonSpan({ timetables: [], days: {}, count: 6 })).toBeNull();
  });
});

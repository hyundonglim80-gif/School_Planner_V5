// 링크 연결 창의 목록 셈 (V4 LinkerModal의 조회 범위·라벨·키워드 거르기를 순수 함수로). 자료는 기기 사본에서 - 서버에 묻지 않는다.
import { academicYearOf, addDays, formatDate } from '../../domain/dateUtils';
import { lessonsOn, type LessonSource } from '../../domain/lessons';
import { schoolYearSpan, semesterSpan, type SemesterConfig } from '../../domain/semester';
import type { Docs } from '../../data/select';
import type { YMD } from '../../data/types';
import { lessonLinkId, linkKindOf, type LinkKind } from './linkOps';

export type RangeKey = '1week' | '1month' | 'sem1' | 'sem2' | 'year' | 'custom';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1week', label: '±1주일' },
  { key: '1month', label: '±1개월' },
  { key: 'sem1', label: '1학기 전체' },
  { key: 'sem2', label: '2학기 전체' },
  { key: 'year', label: '학년도 전체' },
  { key: 'custom', label: '기간 설정' },
];

/** 조회 범위 - 학기·학년도는 잇는 쪽 날짜의 학년도로 (domain/semester - 1~2월에 열어도 그 학년도, 윤년 2월 29일까지) */
export function rangeOf(key: RangeKey, center: YMD, custom: { start: YMD; end: YMD }, cfg?: SemesterConfig | null): { start: YMD; end: YMD } {
  const year = academicYearOf(center);
  if (key === '1week') return { start: addDays(center, -7), end: addDays(center, 7) };
  if (key === '1month') return { start: addDays(center, -30), end: addDays(center, 30) };
  if (key === 'sem1' || key === 'sem2') return semesterSpan(year, key === 'sem1' ? 1 : 2, cfg ?? null);
  if (key === 'year') return schoolYearSpan(year);
  return custom;
}

export interface Candidate {
  id: string;
  kind: LinkKind | 'lesson';
  /** 일정·기록은 그 날, 메모는 만든 날(모르면 '') */
  date: string;
  text: string;
  labelIds: string[];
}

/**
 * 고를 수 있는 항목: 그 종류 · 범위 안(일정은 기간이 걸치면) · 고른 라벨 중 하나라도 · 키워드 - 최근 날짜부터.
 * 지운 항목·자기 자신·글이 빈 것은 뺀다. 메모는 만든 날이 없으면 범위와 상관없이 보인다(V4).
 */
export function candidatesOf(
  items: Docs<'items'>,
  kind: LinkKind,
  range: { start: YMD; end: YMD },
  opts: { labelIds?: readonly string[]; keyword?: string; exclude?: string } = {},
): Candidate[] {
  const keyword = (opts.keyword ?? '').trim().toLowerCase();
  const labels = opts.labelIds ?? [];
  const out: Candidate[] = [];
  for (const it of Object.values(items)) {
    if (it.deletedAt || it.id === opts.exclude || linkKindOf(it) !== kind) continue;
    const text = it.text ?? '';
    if (!text.trim() && !(it.tables?.length || it.attachments?.length)) continue;
    const date = kind === 'memo' ? (it.createdAt ? formatDate(new Date(it.createdAt)) : '') : (it.date ?? '');
    if (date) {
      const last = it.endDate && it.endDate > date ? it.endDate : date;
      if (last < range.start || date > range.end) continue;
    }
    if (labels.length > 0 && !(it.labelIds ?? []).some((l) => labels.includes(l))) continue;
    if (keyword && !text.toLowerCase().includes(keyword)) continue;
    out.push({ id: it.id, kind, date, text, labelIds: it.labelIds ?? [] });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** 한 번에 훑는 날 수의 끝 (기간 설정을 몇 해로 잡아도 창이 멈추지 않게) */
const LESSON_SCAN_DAYS = 400;

/** 🏫 수업 탭: 범위 안의 수업 칸 가운데 과목이나 메모가 있는 것 - 최근 날짜부터, 같은 날은 교시 차례 (계산 - domain/lessons) */
export function lessonCandidatesOf(src: LessonSource, range: { start: YMD; end: YMD }, keyword = ''): Candidate[] {
  const kw = keyword.trim().toLowerCase();
  const out: Candidate[] = [];
  let d = range.end;
  for (let i = 0; i < LESSON_SCAN_DAYS && d >= range.start; i++, d = addDays(d, -1)) {
    for (const c of lessonsOn(d, src).cells) {
      if (!c.subject && !c.memo.trim()) continue;
      const memo = c.memo.split('\n')[0].trim();
      const text = `${c.n}교시 ${c.subject || '(과목 없음)'}${memo ? ` · ${memo}` : ''}`;
      if (kw && !text.toLowerCase().includes(kw)) continue;
      out.push({ id: lessonLinkId(d, c.n), kind: 'lesson', date: d, text, labelIds: [] });
    }
  }
  return out;
}

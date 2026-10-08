// 검색 (V4 components/SearchModal.tsx의 셈). V5는 서버를 기간마다 읽지 않고 기기 사본에서 치는 대로 찾는다(원칙 6) - 그리는 것은 features/search.
//   - 갈래: 메모·일정·기록·첨부파일 (수업·수업 메모·비고는 P6-1, 조사표명은 P7-4가 더한다). '전체'는 모두.
//   - 기간: 전체 기간(처음 값 - 날짜 제한 없음)·학년도·1학기·2학기·해당 월·해당 주(월~금)·해당 일·직접 지정 - 보고 있는 날 기준.
//     메모는 날짜 대신 만든 날로 거른다(만든 날을 모르면 남긴다 - V4). 기간 일정은 범위가 걸치면.
//   - 검색어가 비면(또는 '*') 고른 기간의 모든 것(V4). 글·붙인 표의 칸 글을 본다(대소문자 무시).
//   - 첨부파일: 파일 이름이나 붙어 있는 글이 걸리면 파일마다 한 건.
//   - 차례: 날짜 내림차순, 날짜를 모르는 메모는 맨 뒤.
import { academicYearOf, addDays, formatDate, monthEnd, weekMonday } from './dateUtils';
import { schoolYearSpan, semesterSpan, type SemesterConfig } from './semester';

export type SearchKind = 'memo' | 'event' | 'journal' | 'attachment';
export type SearchScope = 'all' | 'year' | 'sem1' | 'sem2' | 'month' | 'week' | 'day' | 'custom';

export const SEARCH_KINDS: ReadonlyArray<{ id: SearchKind; label: string }> = [
  { id: 'memo', label: '메모' },
  { id: 'event', label: '일정' },
  { id: 'journal', label: '기록' },
  // 첨부는 갈래가 아니라 '붙은 파일만 모아 보기' - 검색어를 비우고 이것만 고르면 그 기간의 파일이 한눈에 (V4)
  { id: 'attachment', label: '첨부파일' },
];

export const SEARCH_SCOPES: ReadonlyArray<{ id: SearchScope; label: string }> = [
  { id: 'all', label: '전체 기간' },
  { id: 'year', label: '학년도 전체' },
  { id: 'sem1', label: '1학기' },
  { id: 'sem2', label: '2학기' },
  { id: 'month', label: '해당 월' },
  { id: 'week', label: '해당 주' },
  { id: 'day', label: '해당 일' },
  { id: 'custom', label: '직접 지정' },
];

export interface DateRange {
  start: string;
  end: string;
}

/** 고른 기간의 날짜 (전체 기간 = null). 학년도·학기는 보고 있는 날의 학년도(1~2월이면 지난해 3월부터 - V4) */
export function scopeRange(scope: SearchScope, date: string, custom: DateRange, sem?: SemesterConfig | null): DateRange | null {
  const year = academicYearOf(date);
  switch (scope) {
    case 'all':
      return null;
    case 'year':
      return schoolYearSpan(year);
    case 'sem1':
    case 'sem2':
      return semesterSpan(year, scope === 'sem1' ? 1 : 2, sem);
    case 'month': {
      const [y, m] = date.split('-').map(Number);
      return { start: `${date.slice(0, 7)}-01`, end: monthEnd(y, m) };
    }
    case 'week': {
      const mon = weekMonday(date);
      return { start: mon, end: addDays(mon, 4) };
    }
    case 'day':
      return { start: date, end: date };
    case 'custom':
      return custom;
  }
}

/** 찾을 수 있는 항목의 모양 (V5 items 문서에서 쓰는 칸만) */
export interface Searchable {
  id: string;
  kind: string;
  date?: string | null;
  endDate?: string;
  text?: string;
  createdAt?: number;
  tables?: ReadonlyArray<{ rows: ReadonlyArray<{ cells: ReadonlyArray<{ v?: string }> }> }>;
  attachments?: ReadonlyArray<{ name: string; url?: string }>;
}

export interface SearchQuery {
  term: string;
  /** 빈 = 전체 */
  kinds: ReadonlySet<SearchKind>;
  range: DateRange | null;
}

export interface SearchHit<T> {
  /** 결과 하나의 key (첨부는 파일마다) */
  key: string;
  kind: SearchKind;
  item: T;
  /** 그 항목의 날 (메모는 만든 날 - 모르면 undefined) */
  date?: string;
  /** 첨부파일 결과의 파일 */
  file?: { name: string; url?: string };
  /** 첨부가 붙은 곳 (메모·일정·기록) */
  where?: Exclude<SearchKind, 'attachment'>;
}

const tableText = (t: Searchable['tables']) => (t ?? []).flatMap((tb) => tb.rows.flatMap((r) => r.cells.map((c) => c.v ?? ''))).join(' ');

/** 그 항목이 메모·일정·기록 가운데 무엇인가 */
export function kindOf(item: Pick<Searchable, 'kind' | 'date'>): Exclude<SearchKind, 'attachment'> | null {
  if (item.kind === 'event') return 'event';
  if (item.kind === 'note') return item.date ? 'journal' : 'memo';
  return null;
}

/** 메모의 날 = 만든 날 */
const memoDate = (it: Searchable) => (it.createdAt ? formatDate(new Date(it.createdAt)) : undefined);

function inRange(it: Searchable, date: string | undefined, range: DateRange | null): boolean {
  if (!range || !range.start || !range.end) return true;
  // 만든 때를 알 수 없는 메모는 기간 때문에 사라지지 않게 남긴다 (V4)
  if (!date) return true;
  const end = it.endDate && it.endDate > date ? it.endDate : date;
  return date <= range.end && end >= range.start;
}

/** 찾기 - 날짜 내림차순 */
export function searchItems<T extends Searchable>(items: readonly T[], q: SearchQuery): SearchHit<T>[] {
  const raw = q.term.trim().toLowerCase();
  const all = raw === '' || raw === '*';
  const match = (s: string | undefined) => all || (!!s && s.toLowerCase().includes(raw));
  const want = (k: SearchKind) => q.kinds.size === 0 || q.kinds.has(k);
  const out: SearchHit<T>[] = [];
  for (const it of items) {
    const kind = kindOf(it);
    if (!kind) continue;
    const date = kind === 'memo' ? memoDate(it) : (it.date ?? undefined);
    if (!inRange(it, date, q.range)) continue;
    const body = `${it.text ?? ''}\n${tableText(it.tables)}`;
    if (want(kind) && match(body)) out.push({ key: it.id, kind, item: it, date });
    if (want('attachment'))
      (it.attachments ?? []).forEach((file, i) => {
        const name = String(file.name || '').trim() || '이름 없는 파일';
        if (match(name) || match(it.text)) out.push({ key: `${it.id}#${i}`, kind: 'attachment', item: it, date, file: { name, url: file.url }, where: kind });
      });
  }
  return out.sort((a, b) => (a.date && b.date ? b.date.localeCompare(a.date) : a.date ? -1 : b.date ? 1 : 0));
}

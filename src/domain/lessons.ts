// 수업 칸 계산 (DESIGN 5-2 - 저장하지 않는다). V4 lib/classDays.ts(수업 없는 날)를 옮기고 '시간표 적용'을 계산으로 바꿨다.
//
//   그날 n교시 = lessonDays[date].periods[n].subject (있으면 - ''이면 그 교시 수업 없음)
//             → 없으면 수업 없는 날(방학·공휴일·수업X 일정·'휴업')이면 없음
//             → 아니면 그 날짜가 든 시간표(기간이 겹치면 늦게 시작한 것)의 grid[요일][n]
//   준비물·메모·첨부·링크는 lessonDays에만 있다.
//
// V4는 '⚡ 이 기간에 시간표 일괄 덮어쓰기'로 날마다 과목을 적어 두었다 - 시간표를 고치면 다시 덮어써야 했고, 그날 고친 과목도 덮였다.
// V5는 시간표를 고치면 그 기간의 날이 저절로 따라가고, 그날 바꾼 칸(lessonDays)은 그대로 남는다.
// 주말은 시간표에 칸이 없어 비지만, 그날 적은 과목은 보인다(토요 보강도 수업이다 - V4 진도 세기와 같다).
import { addDays, weekdayOf } from './dateUtils';
import { isVacation, type SchoolTerms } from './semester';

/** 시간표 한 장 (timetables 문서) */
export interface TimetableLike {
  id: string;
  name?: string;
  from: string;
  to: string;
  /** 요일 '1'(월)~'5'(금) → 교시 → 칸 글자 */
  grid: Record<string, Record<string, string> | undefined>;
  createdAt?: number;
}

/** 그날 바꾼 칸 하나 (lessonDays 문서의 periods[n]) */
export interface LessonCellDoc {
  subject?: string;
  memo?: string;
  supplies?: string;
  attachments?: readonly unknown[];
  linkIds?: readonly string[];
}

export interface LessonDayLike {
  periods?: Record<string, LessonCellDoc | undefined>;
}

export type ClassOffReason = 'vacation' | 'holiday' | 'skip';

export const OFF_REASON_LABEL: Record<ClassOffReason, string> = {
  vacation: '방학',
  holiday: '공휴일',
  skip: '수업X 일정',
};

/** 수업X를 보는 데 쓰는 일정 칸 */
export interface SkipItem {
  kind: string;
  text?: string;
  labelIds?: readonly string[];
  props?: { skip?: boolean };
}

/** 일정 라벨 id → 수업X를 켰나 (살아 있는 라벨만) */
export type LabelSkip = ReadonlyMap<string, boolean>;

/**
 * 이 일정이 그날 수업을 비우는가 (V4 eventSkipsClass).
 * 글에 '휴업'이 들어 있으면 비운다(예전부터의 규칙) → 이 일정만 정한 값(props.skip) → 붙은 라벨 가운데 수업X를 켠 것이 있나.
 */
export function eventSkipsClass(item: SkipItem, labels: LabelSkip = new Map()): boolean {
  if (item.kind !== 'event') return false;
  if ((item.text ?? '').includes('휴업')) return true;
  if (typeof item.props?.skip === 'boolean') return item.props.skip;
  return (item.labelIds ?? []).some((id) => labels.get(id) === true);
}

/** 수업 칸을 셈하는 데 드는 것 (화면은 features/lessons/useLessons가 사본에서 짓는다) */
export interface LessonSource {
  timetables: readonly TimetableLike[];
  /** 날짜 → lessonDays 문서 */
  days: Readonly<Record<string, LessonDayLike | undefined>>;
  /** 교시 수 (settings/common.periods 길이) */
  count: number;
  terms?: SchoolTerms;
  isHoliday?: (date: string) => boolean;
  /** 그날 보이는 일정 (기간 일정 포함) */
  eventsOn?: (date: string) => readonly SkipItem[];
  labels?: LabelSkip;
}

/** 그날 수업이 없는 까닭. 수업하는 날이면 null (주말은 보지 않는다 - 시간표에 칸이 없다) */
export function classOffReason(date: string, src: Pick<LessonSource, 'terms' | 'isHoliday' | 'eventsOn' | 'labels'>): ClassOffReason | null {
  if (isVacation(date, src.terms)) return 'vacation';
  if (src.isHoliday?.(date)) return 'holiday';
  if (src.eventsOn?.(date).some((it) => eventSkipsClass(it, src.labels))) return 'skip';
  return null;
}

/** 그 날짜가 든 시간표. 겹치면 늦게 시작한 것 → 나중에 만든 것 → id 차례 */
export function timetableOn(date: string, timetables: readonly TimetableLike[]): TimetableLike | null {
  let best: TimetableLike | null = null;
  for (const t of timetables) {
    if (!t.from || t.from > date || (t.to && t.to < date)) continue;
    if (
      !best ||
      t.from > best.from ||
      (t.from === best.from && ((t.createdAt ?? 0) > (best.createdAt ?? 0) || ((t.createdAt ?? 0) === (best.createdAt ?? 0) && t.id > best.id)))
    ) {
      best = t;
    }
  }
  return best;
}

/** 시간표 칸 글자 (월~금만) */
export function gridSubject(t: TimetableLike | null, date: string, n: number): string {
  if (!t) return '';
  const wd = weekdayOf(date);
  if (wd < 1 || wd > 5) return '';
  return (t.grid[String(wd)]?.[String(n)] ?? '').trim();
}

/** 그날 한 교시 */
export interface LessonCell {
  n: number;
  /** 보이는 과목 */
  subject: string;
  /** 그날 바꾸지 않았으면 보일 과목 (수업 없는 날이면 '') - 고친 과목이 이것과 같으면 lessonDays에서 뺀다 */
  base: string;
  /** 그날 과목을 바꿨나 (lessonDays에 subject가 있다) */
  changed: boolean;
  memo: string;
  supplies: string;
  attachments: readonly unknown[];
  linkIds: readonly string[];
  /** lessonDays의 그 칸 (없으면 undefined) */
  doc?: LessonCellDoc;
}

export interface LessonDayView {
  date: string;
  off: ClassOffReason | null;
  timetable: TimetableLike | null;
  cells: LessonCell[];
}

const EMPTY: readonly never[] = [];

/** 칸에 적은 것이 있나 (과목을 바꿨거나 메모·준비물·첨부·링크) */
export function cellHasContent(doc: LessonCellDoc | undefined): boolean {
  if (!doc) return false;
  return (
    typeof doc.subject === 'string' ||
    !!doc.memo?.trim() ||
    !!doc.supplies?.trim() ||
    (doc.attachments?.length ?? 0) > 0 ||
    (doc.linkIds?.length ?? 0) > 0
  );
}

/**
 * 그날 수업 칸 전부. 교시 수 = 설정의 교시 수, 그보다 뒤 교시에 적어 둔 것이 있으면(7교시 보충) 그만큼 늘린다(V4 weekPeriodCount).
 */
export function lessonsOn(date: string, src: LessonSource): LessonDayView {
  const day = src.days[date];
  const off = classOffReason(date, src);
  const timetable = timetableOn(date, src.timetables);
  let count = src.count;
  for (const [key, doc] of Object.entries(day?.periods ?? {})) {
    const n = Number(key);
    if (Number.isInteger(n) && n > count && n <= 20 && cellHasContent(doc)) count = n;
  }
  const cells: LessonCell[] = [];
  for (let n = 1; n <= count; n++) {
    const doc = day?.periods?.[String(n)];
    const base = off ? '' : gridSubject(timetable, date, n);
    const changed = typeof doc?.subject === 'string';
    cells.push({
      n,
      subject: changed ? doc!.subject!.trim() : base,
      base,
      changed,
      memo: doc?.memo ?? '',
      supplies: doc?.supplies ?? '',
      attachments: doc?.attachments ?? EMPTY,
      linkIds: doc?.linkIds ?? EMPTY,
      doc,
    });
  }
  return { date, off, timetable, cells };
}

/** 날짜 → (교시 → 과목) - 과목이 있는 칸만 (지난 시간·진도 세기가 받는다 - V4 progress scheduleSubjects) */
export function subjectsBetween(from: string, to: string, src: LessonSource): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const row: Record<string, string> = {};
    for (const c of lessonsOn(d, src).cells) if (c.subject) row[String(c.n)] = c.subject;
    if (Object.keys(row).length) out[d] = row;
  }
  return out;
}

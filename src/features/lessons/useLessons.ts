// 수업 칸 읽기 (DESIGN 5-2) - 기기 사본(시간표·lessonDays·일정·라벨)과 설정(교시·방학)·공휴일로 domain/lessons를 셈한다.
// 하루·주간·링크·검색·진도가 함께 쓴다. 공간은 지금 공간(시간표·수업 칸은 공간마다), 교시·방학은 계정에 하나.
// 같은 재료면 **같은 LessonSource 객체**를 돌려준다(공간마다 하나) - 그 위에 얹는 셈(학년도 과목 표·수업 없는 날)을 화면끼리 함께 쓴다.
import { useMemo } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { labelProps } from '../../domain/labels';
import { classOffReason, lessonsOn, subjectsBetween, type LessonDayView, type LessonSource, type TimetableLike } from '../../domain/lessons';
import type { PeriodDef } from '../../domain/periodTimes';
import type { SchoolTerms } from '../../domain/semester';
import { isHoliday, useHolidayStore } from '../../data/holidays';
import { isLive, itemsOn, useDocs, useHasLive, useLabelTree, type Docs, type LabelTree } from '../../data/select';

interface Inputs {
  timetableDocs: Docs<'timetables'>;
  days: Docs<'lessonDays'>;
  items: Docs<'items'>;
  tree: LabelTree;
  periods: PeriodDef[];
  terms: SchoolTerms;
  holidays: number;
}

/** 공간마다 마지막 재료와 그 셈 - 재료가 모두 같으면(참조) 같은 객체 */
const lastBySpace = new Map<string, { inputs: Inputs; src: LessonSource }>();

function sourceOf(key: string, inputs: Inputs): LessonSource {
  const last = lastBySpace.get(key);
  if (last && (Object.keys(inputs) as Array<keyof Inputs>).every((k) => last.inputs[k] === inputs[k])) return last.src;
  const timetables: TimetableLike[] = Object.values(inputs.timetableDocs)
    .filter(isLive)
    .map((t) => ({ id: t.id, name: t.name, from: t.from, to: t.to, grid: t.grid ?? {}, createdAt: t.createdAt }));
  const src: LessonSource = {
    timetables,
    days: inputs.days,
    count: inputs.periods.length,
    terms: inputs.terms,
    isHoliday,
    eventsOn: (date: string) => itemsOn(inputs.items, date, 'event'),
    labels: new Map(inputs.tree.list.map((l) => [l.id, labelProps(l.props).skip])),
  };
  lastBySpace.set(key, { inputs, src });
  return src;
}

export function useLessonSource(sid?: string | null): LessonSource {
  const timetableDocs = useDocs('timetables', sid);
  const days = useDocs('lessonDays', sid);
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const periods = useCommonSettings((s) => s.periods);
  const terms = useCommonSettings((s) => s.terms);
  // 공휴일 표가 들어오면 다시 셈한다
  const holidays = useHolidayStore((s) => s.version);
  return useMemo(
    () => sourceOf(sid ?? '', { timetableDocs, days, items, tree, periods, terms, holidays }),
    [sid, timetableDocs, days, items, tree, periods, terms, holidays],
  );
}

/**
 * 수업 칸을 아직 믿을 수 없나 (P32-2) - 시간표·그날 바꾼 칸이 사본에도 없고 서버에서도 다 받지 못했다(새 기기·사본을 비운 뒤).
 * 그동안 셈하면 모든 교시가 '과목 미등록'·빈 줄로 보인다 → 화면은 '수업을 받는 중…'. 하나라도 오면(사본 포함) 곧바로 그린다.
 * 끊긴 채 사본이 비었으면 이어질 때까지 받는 중이다(빈 시간표로 보이지 않게 - P22-7 처음 띠와 같은 useHasLive).
 */
export function useLessonsLoading(sid?: string | null): boolean {
  return useHasLive(['timetables', 'lessonDays'], sid) === null;
}

/** 그날 수업 칸 */
export function useLessonsOn(date: string, sid?: string | null): LessonDayView {
  const src = useLessonSource(sid);
  return useMemo(() => lessonsOn(date, src), [date, src]);
}

/** 여러 날 (주간) - 날짜 → 그날 수업 칸 */
export function useLessonsFor(dates: readonly string[], sid?: string | null): Record<string, LessonDayView> {
  const src = useLessonSource(sid);
  const key = dates.join(',');
  return useMemo(() => {
    const out: Record<string, LessonDayView> = {};
    for (const d of key ? key.split(',') : []) out[d] = lessonsOn(d, src);
    return out;
  }, [key, src]);
}

// ── 같은 재료 위의 셈 (진도·지난 시간이 여러 화면에서 같은 범위를 센다) ──

const subjectsCache = new WeakMap<LessonSource, Map<string, Record<string, Record<string, string>>>>();

/** from~to 날짜 → (교시 → 과목) - 같은 재료·범위면 한 번만 센다 */
export function cachedSubjects(src: LessonSource, from: string, to: string): Record<string, Record<string, string>> {
  let byRange = subjectsCache.get(src);
  if (!byRange) subjectsCache.set(src, (byRange = new Map()));
  const key = `${from}~${to}`;
  let hit = byRange.get(key);
  if (!hit) {
    hit = from && to && from <= to ? subjectsBetween(from, to, src) : {};
    byRange.set(key, hit);
  }
  return hit;
}

const offCache = new WeakMap<LessonSource, (date: string) => boolean>();

/** 수업 없는 날인가 (방학·공휴일·수업X 일정·'휴업') - 같은 재료면 같은 함수(날마다 기억) */
export function offDayOf(src: LessonSource): (date: string) => boolean {
  let fn = offCache.get(src);
  if (!fn) {
    const memo = new Map<string, boolean>();
    fn = (date: string) => {
      let v = memo.get(date);
      if (v === undefined) memo.set(date, (v = classOffReason(date, src) !== null));
      return v;
    };
    offCache.set(src, fn);
  }
  return fn;
}

// 진도 관리 창(ProgressWindow)이 고치는 모양과 저장할 모양 (V4 lib/progressDraft.ts - V4 테스트째). 순수 함수만.
//   - 행마다 임시 key(_k): 행을 가운데 넣어도 React가 입력 중인 칸을 엉키게 하지 않게. 저장할 때 뺀다(cleanLessons).
//   - 교과 모드는 늘 '과목 + 반 칩'으로 고친다. 옛 '칸 글자 하나' 진도('5-2 과학')는 과목 + 반 하나로 보이되,
//     반을 하나 이하로 두면 그 모양 그대로 저장한다(draftTarget) - 과정으로 바꾸면 칸 견주기가 progressKey →
//     normalizeSlotText로 바뀌어 옛 결과가 달라질 수 있다.
import { formatDate } from '../../domain/dateUtils';
import { isCourse, isOrderNumbered, lessonRepeat, progressKey, type ProgressLesson, type ProgressPlan } from '../../domain/progress';
import { formatSlot, parseSlot } from '../../domain/teachingSlot';
import { newId } from '../../data/id';

/**
 * 고치는 중인 행 - _k는 React key (행을 가운데 넣어도 입력 중인 칸이 엉키지 않게). 저장할 때 뺀다.
 * _from = 저장한 진도에서 몇 번째 행이었나 - 이은 메모(linkIds)는 저장할 때 **지금 문서의 그 행**에서 가져온다
 * (창을 연 채 수업 칸에서 메모를 이어도 덮지 않게, P10-4). 새로 넣거나 붙여 넣은 행은 없다.
 * _grow = 이 창에서 차시 칸을 고친 행 - 내용이 있으면 행을 벗어날 때·저장할 때 그 숫자만큼 늘린다(growRow).
 * 차시 칸을 내용보다 먼저 적어도 늘어나게(10-21 - 차시 칸을 벗어날 때만 늘려 왼쪽부터 적은 새 행은 늘지 않았다).
 */
export type DraftLesson = ProgressLesson & { _k: string; _from?: number; _grow?: boolean };

export interface Draft {
  id: string;
  key: string;
  startDate: string;
  lessons: DraftLesson[];
  /** 과정(교과 모드)의 과목 */
  subject: string;
  /** 과목 + 반 칩으로 고치면 고른 반들(고르는 중이면 빈 배열), 초등 담임의 과목 하나 진도면 null */
  classes: string[] | null;
  /** 교과 모드에서 연 옛 '칸 글자 하나' 진도(또는 반 없이 과목만 저장한 진도)의 그 글자. 반을 하나 이하로 두면 이 모양 그대로 저장 */
  legacyKey: string | null;
  /** 열 때 차시 칸의 숫자만큼 더 넣은 행 수 (저장하면 0) - '저장하면 수업 칸에 반영' 안내 */
  grown?: number;
}

let lessonSeq = 0;
export const withKey = (l: ProgressLesson): DraftLesson => ({ ...l, _k: `r${++lessonSeq}` });
export const emptyLesson = (): DraftLesson => withKey({ unit: '', no: '', content: '', page: '', supplies: '' });
export const hasText = (l: ProgressLesson) =>
  !!(l.unit.trim() || l.no.trim() || l.content.trim() || l.page.trim() || l.supplies.trim());
export const trimLesson = (l: ProgressLesson): ProgressLesson => ({
  unit: l.unit.trim(),
  no: l.no.trim(),
  content: l.content.trim(),
  page: l.page.trim(),
  supplies: l.supplies.trim(),
});
/** 견줄 모양: 앞뒤 공백을 떼고 빈 행은 뺀다 (_k·이은 메모는 빠진다) */
export const cleanLessons = (lessons: ProgressLesson[]): ProgressLesson[] => lessons.map(trimLesson).filter(hasText);

/** 저장할 행: cleanLessons + 이은 메모는 지금 문서의 그 행(_from)에서 (행을 지우면 링크도 함께 사라진다) */
export function lessonsToSave(lessons: readonly DraftLesson[], docLessons: readonly ProgressLesson[] | undefined): ProgressLesson[] {
  return lessons.filter(hasText).map((l) => {
    const links = l._from === undefined ? undefined : docLessons?.[l._from]?.linkIds;
    return { ...trimLesson(l), ...(links?.length ? { linkIds: [...links] } : {}) };
  });
}
export const squeeze = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * 저장한 진도 → 고치는 모양. 교과 모드면 옛 칸 글자 진도도 과목 + 반 칩으로('5-2 과학' → 과학 · 5-2, '창체' → 창체).
 * 차시 칸의 숫자만큼 아직 늘지 않은 행은 늘려 연다(grown - 저장하면 수업 칸에 반영). 1, 2, 3 … 차례 번호인 옛 표는 그대로.
 */
export const toDraft = (p: ProgressPlan, classUnit: boolean): Draft => {
  const rows = p.lessons.map((l, i) => ({ ...withKey(l), _from: i }));
  const lessons = growCounts(rows);
  const grown = lessons.length - rows.length;
  const base = { id: p.id, key: p.key, startDate: p.startDate, lessons, ...(grown > 0 ? { grown } : {}) };
  if (isCourse(p)) return { ...base, subject: p.subject || '', classes: [...p.classes!], legacyKey: null };
  if (!classUnit) return { ...base, subject: '', classes: null, legacyKey: null };
  const slot = parseSlot(p.key);
  return { ...base, subject: slot.subject, classes: slot.cls ? [slot.cls] : [], legacyKey: p.key };
};
export const newDraft = (): Draft => ({
  id: newId(),
  key: '',
  startDate: formatDate(new Date()),
  lessons: [],
  subject: '',
  classes: null,
  legacyKey: null,
});
export const newCourseDraft = (subject = ''): Draft => ({ ...newDraft(), subject, classes: [] });

/** 수업 칸 글자로 채운 새 진도 ('📘 진도 만들기', 19번 U3). 교과 모드면 '5-2 과학' → 과목 과학 + 반 5-2 */
export function draftForSlot(text: string, classUnit: boolean): Draft {
  if (!classUnit) return { ...newDraft(), key: progressKey(text) };
  const slot = parseSlot(text);
  return { ...newCourseDraft(slot.subject), classes: slot.cls ? [slot.cls] : [] };
}

/**
 * 이 초안을 저장할 모양. 과정이면 subject·classes, 아니면 세는 칸 글자 하나(key).
 * 교과 모드: 반 둘 이상 → 과정. 옛 진도에 반 하나 이하 → 옛 모양(과목·반을 그대로 두면 글자도 그대로).
 * 새 진도에 반 하나 → 과정. 반을 고르지 않으면 '창체'처럼 반 없이 과목만 적힌 칸을 세는 진도.
 */
export function draftTarget(d: Draft): { key: string; subject?: string; classes?: string[] } {
  if (!d.classes) return { key: progressKey(d.key) };
  const subject = squeeze(d.subject);
  if (d.legacyKey !== null && d.classes.length <= 1) {
    const cls = d.classes[0] || '';
    const old = parseSlot(d.legacyKey);
    return { key: old.cls === cls && old.subject === subject ? d.legacyKey : progressKey(formatSlot(cls, subject)) };
  }
  if (d.classes.length === 0) return { key: progressKey(subject) };
  return { key: '', subject, classes: d.classes };
}

export const sameAsSaved = (d: Draft, p: ProgressPlan) => {
  const t = draftTarget(d);
  return (
    d.startDate === p.startDate &&
    JSON.stringify(cleanLessons(d.lessons)) === JSON.stringify(cleanLessons(p.lessons)) &&
    (t.classes
      ? isCourse(p) && t.subject === (p.subject || '') && t.classes.join(',') === p.classes!.join(',')
      : !isCourse(p) && t.key === p.key)
  );
};


/**
 * 차시 칸을 고친 행(row)을 그 숫자만큼 늘린다('2'면 같은 내용을 2행으로). 바로 뒤에 차시 칸이 빈 같은 내용 행이 이미 있으면 그만큼은 센다.
 * 줄이지는 않는다(지우는 일은 행 삭제로). 늘어난 행은 새 행이고 차시 칸은 비운다. 바뀐 것이 없으면 같은 목록을 돌려준다.
 */
export function expandRowRepeat(lessons: DraftLesson[], row: number): DraftLesson[] {
  const l = lessons[row];
  if (!l || !l.content.trim()) return lessons;
  const want = lessonRepeat(l.no);
  let already = 0;
  while (already + 1 < want) {
    const next = lessons[row + 1 + already];
    if (!next || next.no.trim() || next.content !== l.content || next.unit !== l.unit) break;
    already++;
  }
  const extra = want - 1 - already;
  if (extra <= 0) return lessons;
  const copies = Array.from({ length: extra }, () => withKey({ ...trimLesson(l), no: '' }));
  const next = [...lessons];
  next.splice(row + 1 + already, 0, ...copies);
  return next;
}

/** 차시 칸을 고친(_grow) 그 행을 늘리고 표시를 뗀다. 내용이 아직 없으면 표시를 두고 기다린다. 바뀐 것이 없으면 같은 목록 */
export function growRow(lessons: DraftLesson[], row: number): DraftLesson[] {
  const l = lessons[row];
  if (!l?._grow || !l.content.trim()) return lessons;
  const next = [...expandRowRepeat(lessons, row)];
  const { _grow: _, ...rest } = l;
  next[row] = rest;
  return next;
}

/** 차시 칸을 고친 모든 행을 늘린다 (저장 직전). 뒤에서부터 - 늘린 행이 앞 행 번호를 밀지 않게 */
export function growMarked(lessons: DraftLesson[]): DraftLesson[] {
  let next = lessons;
  for (let row = lessons.length - 1; row >= 0; row--) next = growRow(next, row);
  return next;
}

/** 차시 칸의 숫자만큼 모든 행을 늘린다 (저장한 진도를 열 때). 1, 2, 3 … 차례 번호인 옛 표는 그대로 */
export function growCounts(lessons: DraftLesson[]): DraftLesson[] {
  if (isOrderNumbered(lessons)) return lessons;
  let next = lessons;
  for (let row = lessons.length - 1; row >= 0; row--) next = expandRowRepeat(next, row);
  return next;
}

/** after 행 바로 아래(after가 -1이면 맨 위)에 빈 행을 넣은 새 목록과 그 행 번호 */
export function insertRowAfter(lessons: DraftLesson[], after: number): { lessons: DraftLesson[]; at: number } {
  const at = Math.max(0, Math.min(after + 1, lessons.length));
  const next = [...lessons];
  next.splice(at, 0, emptyLesson());
  return { lessons: next, at };
}

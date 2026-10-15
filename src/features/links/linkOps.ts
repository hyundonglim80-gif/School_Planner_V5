// 링크 - 항목끼리 잇기 (V4 utils/linkUtils.ts·LinkerModal 저장·LinkViewerModal 해제를 순수 함수로).
//
// V5는 양쪽 항목의 `linkIds`에 서로의 id를 적는다(DESIGN 4-2). id가 바뀌지 않으므로 V4의 역링크 갈아끼우기
// (이월·옮기기 때마다 새 id)·트랜잭션 읽기가 없다 - 잇기·끊기는 늘 양쪽을 한 묶음(batch)으로 적는다.
// 수업은 'lesson:{날짜}:{교시}' - 수업 쪽은 lessonDays의 그 칸 `periods.{교시}.linkIds`(P6-1 - 날짜 문서라 merge, 없으면 만든다).
// 링크는 교시 자리에 붙는다 - ▲▼로 교시를 맞바꿔도 링크는 그 교시에 남는다(features/lessons/lessonOps).
// 진도 차시는 'progress:{planId}:{행}' (P10-4) - **진도 쪽에만** 적는다(그 행의 linkIds - 메모에는 적지 않는다).
// 행을 지우거나 진도를 지우면 링크도 함께 사라지고, 휴지통에서 되살리면 함께 돌아온다. 메모 쪽에서는 계산해 보인다(progressLinksByNote).
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { Stored, YMD } from '../../data/types';
import { itemPath, type ItemDoc } from '../events/eventOps';
import { lessonDayPath } from '../lessons/lessonOps';
import { planLabel, sanitizePlan } from '../../domain/progress';

export const LESSON_LINK_PREFIX = 'lesson:';

/** 수업 링크 id */
export const lessonLinkId = (date: YMD, period: number | string) => `${LESSON_LINK_PREFIX}${date}:${period}`;

/** 'lesson:2026-10-08:3' → { date, period }. 수업 링크가 아니면 null */
export function parseLessonLink(id: string): { date: YMD; period: number } | null {
  const m = /^lesson:(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(id);
  return m ? { date: m[1], period: Number(m[2]) } : null;
}

/** 수업 쪽 끝 - 그날 그 교시 (lessonDays 문서의 periods[교시].linkIds) */
export interface LessonEnd {
  /** 'lesson:날짜:교시' */
  id: string;
  date: YMD;
  period: number;
  linkIds: readonly string[];
  /** 그날 lessonDays 문서 (없으면 null - 처음 적으면 만든다) */
  day: Stored<'lessonDays'> | null;
}

/** 수업 링크 id → 수업 쪽 끝 (그날 문서에서 지금 링크를 읽는다). 수업 링크가 아니면 null */
export function lessonEndOf(id: string, days: Readonly<Record<string, Stored<'lessonDays'>>>): LessonEnd | null {
  const p = parseLessonLink(id);
  if (!p) return null;
  const day = days[p.date] ?? null;
  return { id, date: p.date, period: p.period, linkIds: day?.periods?.[String(p.period)]?.linkIds ?? [], day };
}

/** 링크 목록에 더하기 (이미 있는 것은 그대로) - 바뀐 것이 없으면 null */
function added(have: readonly string[], self: string, add: readonly string[]): string[] | null {
  const more = add.filter((id) => id !== self && !have.includes(id));
  if (more.length === 0) return null;
  return [...have, ...[...new Set(more)]];
}

/** 링크 목록에서 빼기 - 없던 것이면 null (빈 목록이면 칸을 지운다 = undefined) */
function removed(have: readonly string[], id: string): string[] | undefined | null {
  if (!have.includes(id)) return null;
  const next = have.filter((x) => x !== id);
  return next.length > 0 ? next : undefined;
}

const itemLinks = (sid: string, item: ItemDoc, next: string[] | undefined) => writeOp.patch(itemPath(sid, item.id), { linkIds: next }, item);
const lessonLinks = (sid: string, end: LessonEnd, next: string[] | undefined) =>
  writeOp.merge(lessonDayPath(sid, end.date), { [`periods.${end.period}.linkIds`]: next }, end.day);

/**
 * 잇기: source의 linkIds에 targets(항목·수업)를, 각 상대의 linkIds에 source를. 이미 이어진 것은 건드리지 않는다.
 */
export function linkOps(sid: string, source: ItemDoc, targets: readonly ItemDoc[], lessons: readonly LessonEnd[] = []): WriteOp[] {
  const ops: WriteOp[] = [];
  const mine = added(source.linkIds ?? [], source.id, [...targets.map((t) => t.id), ...lessons.map((l) => l.id)]);
  if (mine) ops.push(itemLinks(sid, source, mine));
  for (const t of targets) {
    if (t.id === source.id) continue;
    const theirs = added(t.linkIds ?? [], t.id, [source.id]);
    if (theirs) ops.push(itemLinks(sid, t, theirs));
  }
  const seen = new Set<string>();
  for (const l of lessons) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const theirs = added(l.linkIds, l.id, [source.id]);
    if (theirs) ops.push(lessonLinks(sid, l, theirs));
  }
  return ops;
}

/** 수업에서 잇기: 그 교시의 linkIds에 항목들을, 각 항목의 linkIds에 그 교시를 */
export function lessonLinkOps(sid: string, source: LessonEnd, targets: readonly ItemDoc[]): WriteOp[] {
  const ops: WriteOp[] = [];
  const mine = added(source.linkIds, source.id, targets.map((t) => t.id));
  if (mine) ops.push(lessonLinks(sid, source, mine));
  for (const t of targets) {
    const theirs = added(t.linkIds ?? [], t.id, [source.id]);
    if (theirs) ops.push(itemLinks(sid, t, theirs));
  }
  return ops;
}

/** 끊기: 양쪽 모두에서 (상대가 없거나 지운 항목이어도 source 쪽은 끊는다). 상대가 수업이면 lesson으로 */
export function unlinkOps(sid: string, source: ItemDoc, targetId: string, target?: ItemDoc, lesson?: LessonEnd | null): WriteOp[] {
  const ops: WriteOp[] = [];
  const mine = removed(source.linkIds ?? [], targetId);
  if (mine !== null) ops.push(itemLinks(sid, source, mine));
  if (target) {
    const theirs = removed(target.linkIds ?? [], source.id);
    if (theirs !== null) ops.push(itemLinks(sid, target, theirs));
  }
  if (lesson) {
    const theirs = removed(lesson.linkIds, source.id);
    if (theirs !== null) ops.push(lessonLinks(sid, lesson, theirs));
  }
  return ops;
}

/** 수업에서 끊기 */
export function lessonUnlinkOps(sid: string, source: LessonEnd, targetId: string, target?: ItemDoc): WriteOp[] {
  const ops: WriteOp[] = [];
  const mine = removed(source.linkIds, targetId);
  if (mine !== null) ops.push(lessonLinks(sid, source, mine));
  if (target) {
    const theirs = removed(target.linkIds ?? [], source.id);
    if (theirs !== null) ops.push(itemLinks(sid, target, theirs));
  }
  return ops;
}

/** 항목의 링크 종류 - 일정 · 메모 (P10-4 5g: 옛 '기록'(날짜 있는 메모)·'메모' 둘을 메모 하나로) */
export type LinkKind = 'event' | 'note';

export const linkKindOf = (item: Pick<ItemDoc, 'kind'>): LinkKind => (item.kind === 'event' ? 'event' : 'note');

export const LINK_KIND_ICON: Record<LinkKind | 'lesson', string> = { event: '📌', note: '📝', lesson: '🏫' };
export const LINK_KIND_NAME: Record<LinkKind | 'lesson', string> = { event: '일정', note: '메모', lesson: '수업' };

// ── 진도 차시 (P10-4) ──

export const PROGRESS_LINK_PREFIX = 'progress:';

/** 진도 차시 링크 id ('progress:{planId}:{행 차례 - 0부터}') */
export const progressLinkId = (planId: string, row: number) => `${PROGRESS_LINK_PREFIX}${planId}:${row}`;

export function parseProgressLink(id: string): { planId: string; row: number } | null {
  const m = /^progress:([^:]+):(\d+)$/.exec(id);
  return m ? { planId: m[1], row: Number(m[2]) } : null;
}

/** 진도 쪽 끝 - 그 진도의 그 행 */
export interface ProgressEnd {
  id: string;
  planId: string;
  row: number;
  linkIds: readonly string[];
  /** '과학 5차시 · 비유 표현' */
  title: string;
  plan: Stored<'progress'>;
}

/** 진도 링크 id → 진도 쪽 끝 (진도·행이 없거나 지웠으면 null) */
export function progressEndOf(id: string, docs: Readonly<Record<string, Stored<'progress'>>>): ProgressEnd | null {
  const p = parseProgressLink(id);
  const plan = p ? docs[p.planId] : undefined;
  if (!p || !plan || plan.deletedAt) return null;
  const row = plan.lessons?.[p.row];
  if (!row) return null;
  return { id, planId: p.planId, row: p.row, linkIds: row.linkIds ?? [], title: progressRowTitle(plan, p.row), plan };
}

/** 진도 행 이름 '과학 5차시 · 비유 표현' (차시 = 행 차례 + 1 - 수업 칸의 'n/전체차시'와 같다) */
export function progressRowTitle(plan: Stored<'progress'>, row: number): string {
  const sane = sanitizePlan(plan.id, plan);
  const content = sane.lessons[row]?.content.trim();
  return `${planLabel(sane)} ${row + 1}차시${content ? ` · ${content}` : ''}`;
}

/** 그 행의 linkIds를 바꾼 쓰기 (lessons 배열째 - 그 행 말고는 그대로) */
function progressRowLinks(sid: string, end: ProgressEnd, next: string[] | undefined): WriteOp {
  const lessons = (end.plan.lessons ?? []).map((l, i) => {
    if (i !== end.row) return l;
    const { linkIds: _old, ...rest } = l;
    void _old;
    return next ? { ...rest, linkIds: next } : rest;
  });
  return writeOp.patch({ sid, coll: 'progress', id: end.planId }, { lessons }, end.plan);
}

/** 진도 행에 메모 잇기 (진도 쪽에만) */
export function progressLinkOps(sid: string, end: ProgressEnd, targets: readonly ItemDoc[]): WriteOp[] {
  const next = added(end.linkIds, end.id, targets.map((t) => t.id));
  return next ? [progressRowLinks(sid, end, next)] : [];
}

/** 진도 행에서 메모 끊기 */
export function progressUnlinkOps(sid: string, end: ProgressEnd, noteId: string): WriteOp[] {
  const next = removed(end.linkIds, noteId);
  return next === null ? [] : [progressRowLinks(sid, end, next)];
}

/** 메모 id → 그 메모를 이은 진도 차시 링크 id들 (메모 쪽 링크 보기·🔗 n - 계산) */
export function progressLinksByNote(docs: Readonly<Record<string, Stored<'progress'>>>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const plan of Object.values(docs)) {
    if (plan.deletedAt) continue;
    (plan.lessons ?? []).forEach((l, row) => {
      for (const noteId of l.linkIds ?? []) {
        const list = out.get(noteId) ?? [];
        list.push(progressLinkId(plan.id, row));
        out.set(noteId, list);
      }
    });
  }
  return out;
}

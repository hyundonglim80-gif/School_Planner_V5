// 링크 - 항목끼리 잇기 (V4 utils/linkUtils.ts·LinkerModal 저장·LinkViewerModal 해제를 순수 함수로).
//
// V5는 양쪽 항목의 `linkIds`에 서로의 id를 적는다(DESIGN 4-2). id가 바뀌지 않으므로 V4의 역링크 갈아끼우기
// (이월·옮기기 때마다 새 id)·트랜잭션 읽기가 없다 - 잇기·끊기는 늘 양쪽을 한 묶음(batch)으로 적는다.
// 수업은 'lesson:{날짜}:{교시}' - 수업 쪽(lessonDays)에 적는 것은 수업 칸이 생기는 P6-1에서. 지금은 항목 쪽만 다룬다.
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { YMD } from '../../data/types';
import { itemPath, type ItemDoc } from '../events/eventOps';

export const LESSON_LINK_PREFIX = 'lesson:';

/** 수업 링크 id */
export const lessonLinkId = (date: YMD, period: number | string) => `${LESSON_LINK_PREFIX}${date}:${period}`;

/** 'lesson:2026-10-08:3' → { date, period }. 수업 링크가 아니면 null */
export function parseLessonLink(id: string): { date: YMD; period: number } | null {
  const m = /^lesson:(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(id);
  return m ? { date: m[1], period: Number(m[2]) } : null;
}

/** 이 항목에 더한 링크 목록 (이미 있는 것은 그대로) - 바뀐 것이 없으면 null */
function withLinks(item: ItemDoc, add: readonly string[]): string[] | null {
  const have = item.linkIds ?? [];
  const more = add.filter((id) => id !== item.id && !have.includes(id));
  if (more.length === 0) return null;
  return [...have, ...[...new Set(more)]];
}

/** 이 항목에서 뺀 링크 목록 - 없던 것이면 null (빈 목록이면 칸을 지운다 = undefined) */
function withoutLink(item: ItemDoc, id: string): string[] | undefined | null {
  const have = item.linkIds ?? [];
  if (!have.includes(id)) return null;
  const next = have.filter((x) => x !== id);
  return next.length > 0 ? next : undefined;
}

/**
 * 잇기: source의 linkIds에 targets를, 각 target의 linkIds에 source를. 이미 이어진 것은 건드리지 않는다.
 * 수업 링크(lessonIds)는 source 쪽에만 적는다(수업 쪽은 P6-1).
 */
export function linkOps(sid: string, source: ItemDoc, targets: readonly ItemDoc[], lessonIds: readonly string[] = []): WriteOp[] {
  const ops: WriteOp[] = [];
  const mine = withLinks(source, [...targets.map((t) => t.id), ...lessonIds]);
  if (mine) ops.push(writeOp.patch(itemPath(sid, source.id), { linkIds: mine }, source));
  for (const t of targets) {
    if (t.id === source.id) continue;
    const theirs = withLinks(t, [source.id]);
    if (theirs) ops.push(writeOp.patch(itemPath(sid, t.id), { linkIds: theirs }, t));
  }
  return ops;
}

/** 끊기: 양쪽 모두에서 (상대가 없거나 지운 항목이어도 source 쪽은 끊는다) */
export function unlinkOps(sid: string, source: ItemDoc, targetId: string, target?: ItemDoc): WriteOp[] {
  const ops: WriteOp[] = [];
  const mine = withoutLink(source, targetId);
  if (mine !== null) ops.push(writeOp.patch(itemPath(sid, source.id), { linkIds: mine }, source));
  if (target) {
    const theirs = withoutLink(target, source.id);
    if (theirs !== null) ops.push(writeOp.patch(itemPath(sid, target.id), { linkIds: theirs }, target));
  }
  return ops;
}

export type LinkKind = 'event' | 'journal' | 'memo';

/** 항목의 링크 종류 (일정 · 기록(날짜 있는 note) · 메모) */
export const linkKindOf = (item: Pick<ItemDoc, 'kind' | 'date'>): LinkKind => (item.kind === 'event' ? 'event' : item.date ? 'journal' : 'memo');

export const LINK_KIND_ICON: Record<LinkKind | 'lesson', string> = { event: '📌', journal: '📔', memo: '📝', lesson: '🏫' };
export const LINK_KIND_NAME: Record<LinkKind | 'lesson', string> = { event: '일정', journal: '기록', memo: '메모', lesson: '수업' };

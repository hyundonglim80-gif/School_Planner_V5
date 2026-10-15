// 하루 '메모' 칸에 보일 메모 (P10-4 사용자 의견 2f - 계산, 저장하지 않는다).
//
// 그 날짜 링크가 있는 메모 + 그날 일정 칸에 보이는 일정(기간·이월 포함)에 이은 메모 + 그날 수업 칸(교시)에 이은 메모를 **겹치지 않게** 모은다.
// 이은 것은 양쪽 `linkIds`에 적혀 있으므로(features/links/linkOps) 일정·수업 쪽 `linkIds`에서 메모 id를 찾는다 - 메모 쪽에 날짜를 더 적지 않는다.
// 차례: 날짜 링크 메모(부르는 쪽의 차례 그대로) → 이은 것으로만 오는 메모(일정 차례 → 교시 차례 → 진도 차시).
// 어디서 왔는지(📌 일정·🏫 n교시·📘 진도)는 카드에 작게 - 날짜 링크는 표시 없음.
import type { ItemDoc } from '../events/eventOps';

/** 메모가 그날 칸에 온 길 (날짜 링크 말고) */
export type NoteFrom =
  | { kind: 'event'; id: string; text: string }
  | { kind: 'lesson'; n: number; subject: string }
  | { kind: 'progress'; n: number; planId: string; title: string };

export interface DayNote {
  item: ItemDoc;
  /** 그 날짜 링크가 있다 (▲▼로 옮길 수 있는 것은 이것들끼리) */
  dated: boolean;
  from: NoteFrom[];
}

export interface DayNoteInput {
  /** 그 날짜 링크가 있는 메모 (data/select itemsOn) - 차례 그대로 */
  dated: readonly ItemDoc[];
  /** 그날 일정 칸에 보이는 일정 (기간·반복·오늘로 따라온 것 포함) */
  events: readonly ItemDoc[];
  /** 그날 수업 칸 (교시·과목·링크) */
  lessons?: ReadonlyArray<{ n: number; subject: string; linkIds: readonly string[] }>;
  /** 그날 교시마다 하는 진도 차시에 이은 메모 (진도 행 `linkIds` - P10-4 ■2) */
  progress?: ReadonlyArray<{ n: number; planId: string; title: string; linkIds: readonly string[] }>;
  /** id → 항목 (사본) */
  byId: (id: string) => ItemDoc | undefined;
}

const isLiveNote = (d: ItemDoc | undefined): d is ItemDoc => !!d && d.kind === 'note' && !d.deletedAt;

export function dayNoteSources(input: DayNoteInput): DayNote[] {
  const out: DayNote[] = [];
  const at = new Map<string, DayNote>();
  for (const item of input.dated) {
    if (at.has(item.id)) continue;
    const row: DayNote = { item, dated: true, from: [] };
    at.set(item.id, row);
    out.push(row);
  }
  const add = (ids: readonly string[] | undefined, from: NoteFrom) => {
    for (const id of ids ?? []) {
      const have = at.get(id);
      if (have) {
        if (!have.from.some((f) => sameFrom(f, from))) have.from.push(from);
        continue;
      }
      const item = input.byId(id);
      if (!isLiveNote(item)) continue;
      const row: DayNote = { item, dated: false, from: [from] };
      at.set(id, row);
      out.push(row);
    }
  };
  const seenEvents = new Set<string>();
  for (const ev of input.events) {
    if (seenEvents.has(ev.id) || ev.deletedAt) continue;
    seenEvents.add(ev.id);
    add(ev.linkIds, { kind: 'event', id: ev.id, text: ev.text ?? '' });
  }
  for (const c of input.lessons ?? []) add(c.linkIds, { kind: 'lesson', n: c.n, subject: c.subject });
  for (const p of input.progress ?? []) add(p.linkIds, { kind: 'progress', n: p.n, planId: p.planId, title: p.title });
  return out;
}

function sameFrom(a: NoteFrom, b: NoteFrom): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'event') return a.id === (b as typeof a).id;
  if (a.kind === 'lesson') return a.n === (b as typeof a).n;
  return a.n === (b as typeof a).n && a.planId === (b as typeof a).planId;
}

/** 카드에 작게 보일 글 (짧게)·마우스를 올리면 보일 글 */
export function noteFromLabel(f: NoteFrom): { key: string; text: string; title: string } {
  if (f.kind === 'event') {
    const line = f.text.split('\n').find((l) => l.trim())?.trim() ?? '';
    const short = [...line].length > 8 ? `${[...line].slice(0, 8).join('')}…` : line;
    return { key: `event:${f.id}`, text: `📌 ${short || '일정'}`, title: `이은 일정: ${line || '(제목 없음)'}` };
  }
  if (f.kind === 'lesson') {
    return { key: `lesson:${f.n}`, text: `🏫 ${f.n}교시`, title: `이은 수업: ${f.n}교시${f.subject ? ` ${f.subject}` : ''}` };
  }
  return { key: `progress:${f.n}`, text: `📘 ${f.title}`, title: `이은 진도: ${f.n}교시 ${f.title}` };
}

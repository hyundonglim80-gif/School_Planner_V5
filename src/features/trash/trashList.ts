// 휴지통에 보일 것 (V4 TrashModal·trashHelper) - 셈만(순수). V5의 지우기는 지운 표시(원칙 5)라 휴지통은 따로 모은 사본이 아니라
// 지운 표시가 붙은 문서를 걸러 보는 것이다: 일정·기록·메모(items)·라벨(labels)·D-Day(settings/common.ddays) + 이 기기의 클립보드 휴지통.
//   - 탭: 전체 / 일정 / 기록 / 메모 / 클립보드 / 기타(라벨·D-Day, 뒤에 생길 수업·조사표·명단… 모두) - V4 2026-09-30 사용자 요청 그대로.
//   - 영구 삭제의 드라이브 첨부 정리: V5에서 올린 파일만, 다른 항목(살아 있는 것·휴지통)이 같은 파일을 쓰면 남긴다.
//     **V4에서 가져온 항목(src)의 첨부는 지우지 않는다** - V4가 같은 파일을 보고 있다(PLAN 5장 P5-4).
import { driveFileIdOf } from '../../data/google/drive';

export type TrashKind = 'event' | 'journal' | 'memo' | 'label' | 'dday' | 'clip';
export type TrashTab = 'all' | 'event' | 'journal' | 'memo' | 'clip' | 'etc';

export const TRASH_TABS: ReadonlyArray<{ key: TrashTab; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'event', label: '일정' },
  { key: 'journal', label: '기록' },
  { key: 'memo', label: '메모' },
  { key: 'clip', label: '클립보드' },
  { key: 'etc', label: '기타' },
];

export const KIND_LABEL: Record<TrashKind, string> = { event: '일정', journal: '기록', memo: '메모', label: '라벨', dday: 'D-Day', clip: '클립보드' };

export const tabOf = (kind: TrashKind): Exclude<TrashTab, 'all'> => (kind === 'event' || kind === 'journal' || kind === 'memo' || kind === 'clip' ? kind : 'etc');

export interface TrashEntry {
  /** 종류:id (휴지통 안에서 하나) */
  key: string;
  kind: TrashKind;
  id: string;
  text: string;
  /** 원래 날 (일정·기록 - 기간은 '~끝 날'까지) */
  when?: string;
  deletedAt: number;
  /** V4에서 지워져 가져오기가 지운 표시를 했다 */
  byV4?: boolean;
}

interface ItemLike {
  id: string;
  kind: string;
  date?: string | null;
  endDate?: string;
  text?: string;
  deletedAt?: unknown;
  deletedBy?: string;
  attachments?: ReadonlyArray<{ name?: string; url?: string; driveId?: string }>;
  src?: unknown;
}
interface LabelLike {
  id: string;
  name: string;
  kind: string;
  deletedAt?: unknown;
}

/** 지운 때(ms) - 방금 지워 서버 시각이 아직 없으면 지금 */
export function deletedMs(v: unknown, now = Date.now()): number {
  if (typeof v === 'number') return v;
  const t = v as { toMillis?: () => number } | null | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : now;
}

const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

export function trashEntries(src: {
  items: Readonly<Record<string, ItemLike>>;
  labels: Readonly<Record<string, LabelLike>>;
  ddays: ReadonlyArray<{ id: string; title: string; date: string; deletedAt?: number }>;
  clips: ReadonlyArray<{ id: string; kind: 'text' | 'image'; text?: string; deletedAt: number }>;
  now?: number;
}): TrashEntry[] {
  const now = src.now ?? Date.now();
  const out: TrashEntry[] = [];
  for (const it of Object.values(src.items)) {
    if (!it.deletedAt) continue;
    const kind: TrashKind = it.kind === 'event' ? 'event' : it.date ? 'journal' : 'memo';
    const when = it.date ? (it.endDate && it.endDate > it.date ? `${it.date} ~ ${md(it.endDate)}` : it.date) : undefined;
    out.push({ key: `${kind}:${it.id}`, kind, id: it.id, text: it.text || (it.attachments?.length ? `📎 ${it.attachments[0].name ?? '첨부'}` : ''), when, deletedAt: deletedMs(it.deletedAt, now), byV4: it.deletedBy === 'v4-import' });
  }
  for (const l of Object.values(src.labels)) {
    if (!l.deletedAt) continue;
    out.push({ key: `label:${l.id}`, kind: 'label', id: l.id, text: `${l.kind === 'event' ? '📅' : '📝'} ${l.name}`, deletedAt: deletedMs(l.deletedAt, now) });
  }
  for (const d of src.ddays) if (d.deletedAt) out.push({ key: `dday:${d.id}`, kind: 'dday', id: d.id, text: `${d.title} (${d.date})`, deletedAt: d.deletedAt });
  for (const c of src.clips) out.push({ key: `clip:${c.id}`, kind: 'clip', id: c.id, text: c.kind === 'image' ? '🖼️ 그림' : (c.text ?? ''), deletedAt: c.deletedAt });
  return out.sort((a, b) => b.deletedAt - a.deletedAt || a.key.localeCompare(b.key));
}

/** 자동 비우기: days일보다 먼저 지운 것 (0 = 끄기 → 없음) */
export function expiredOf(entries: readonly TrashEntry[], days: number, now = Date.now()): TrashEntry[] {
  if (!days || days <= 0) return [];
  const cutoff = now - days * 86_400_000;
  return entries.filter((e) => e.deletedAt < cutoff);
}

const fileIdOf = (a: { url?: string; driveId?: string }) => a.driveId || driveFileIdOf(a.url) || null;

/**
 * 영구 삭제하면서 드라이브에서 지울 파일 id - V5에서 올린 것(가져온 항목이 아님)만, 남는 항목이 같은 파일을 쓰면 남긴다.
 * purged = 영구 삭제할 항목, rest = 남는 항목 (살아 있는 것·휴지통 모두)
 */
export function driveFilesToClean(purged: readonly ItemLike[], rest: readonly ItemLike[]): string[] {
  const used = new Set(rest.flatMap((it) => (it.attachments ?? []).map(fileIdOf)).filter((x): x is string => !!x));
  const out = new Set<string>();
  for (const it of purged) {
    if (it.src) continue;
    for (const a of it.attachments ?? []) {
      const id = fileIdOf(a);
      if (id && !used.has(id)) out.add(id);
    }
  }
  return [...out];
}

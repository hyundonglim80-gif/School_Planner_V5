// 다시 가져오기 규칙 (DESIGN 8-1). 가져올 문서 목록(V4에서 셈한 것)과 V5에 지금 있는 문서를 견줘 쓰기 묶음과 결과 수를 짓는다 - 순수 함수.
//
// 가져온 문서는 `src.h`에 **가져올 때 적은 칸의 지문**을 남긴다. 다시 가져올 때
//   - 지금 V5 문서의 칸 지문 ≠ src.h  → V5에서 고친 것 → 덮지 않는다(둠)
//   - 새로 셈한 칸 지문 == src.h       → V4도 그대로 → 쓰지 않는다(그대로)
//   - 그 밖                            → V4에서 바뀐 칸만 고친다(바뀜)
// 그래서 '지난 가져오기 때'를 믿지 않아도 된다 - 가져오기가 중간에 끊겨 기록을 못 남겨도, 기기 시각이 틀려도 같다.
//
// V4에서 없어진 것(이 종류로 가져온 V5 문서인데 이번 목록에 없다): V5에서 고치지 않았으면 지운 표시(누가 = IMPORT_DELETER), 고쳤으면 둔다.
// V5에서 지운 것: 사용자가 지웠으면 되살리지 않는다(둠). 가져오기가 지운 것(V4에서 없어졌던 것)이 V4에 다시 있으면 새로 적는다.
import { writeOp, type Changes, type WriteOp } from '../../data/repo/ops';
import type { Editable, ImportSource, Stored } from '../../data/types';
import { hashText, sameValue, stableStringify } from './hash';

/** 가져오기가 지운 표시를 남길 때의 '누가' - 휴지통이 'V4에서 지움'으로 보인다 */
export const IMPORT_DELETER = 'v4-import';

/** 가져올 수 있는 컬렉션 (문서에 src 칸이 있는 것) - 기능을 옮기는 세션이 더한다 */
export type ImportColl = 'labels' | 'items' | 'series' | 'timetables' | 'lessonDays' | 'progress';

export interface ImportCounts {
  /** 새로 (V4에서 지운 뒤 다시 생긴 것 포함) */
  added: number;
  /** V4에서 바뀐 칸을 고침 */
  changed: number;
  /** 그대로 */
  same: number;
  /** V5 것을 둠 (V5에서 고쳤거나 지웠거나, 이름이 같은 V5 라벨에 이음) */
  kept: number;
  /** V4에서 없어져 지운 표시 */
  removed: number;
  /** 학년도별 수 (항목 - '2026' → 수). 라벨·설정에는 없다 */
  years?: Record<string, number>;
}

export const emptyCounts = (): ImportCounts => ({ added: 0, changed: 0, same: 0, kept: 0, removed: 0 });

/** 바뀐 것 수 (새로·바뀜·지움) - 두 번째 가져오기는 0이어야 한다 */
export const changedTotal = (c: ImportCounts) => c.added + c.changed + c.removed;

export type Outcome = Exclude<keyof ImportCounts, 'years'>;

export function tally(counts: ImportCounts, what: Outcome, year?: string) {
  counts[what]++;
  if (year) {
    counts.years ??= {};
    counts.years[year] = (counts.years[year] ?? 0) + 1;
  }
}

/** 가져올 문서 하나 (V4에서 셈한 것) */
export interface Planned<C extends ImportColl> {
  /** V5 id (ids.v4id) */
  id: string;
  /** 적을 칸 (src는 plan이 붙인다) */
  data: Omit<Editable<C>, 'src'>;
  /** V4 자리 */
  src: { path: string; id: string };
  /** 학년도 (결과 표의 학년도별 수) */
  year?: string;
}

type Fields = Record<string, unknown>;

/** 저장 도우미가 붙이는 칸·자리·가져오기 표시 - 지문에 넣지 않는다 */
const NOT_CONTENT = new Set(['id', 'src', 'updatedAt', 'v', 'createdAt', 'authorId', 'deletedAt', 'deletedBy']);

/** 문서의 내용 칸만 */
export function contentOf(doc: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(doc)) if (!NOT_CONTENT.has(k) && v !== undefined) out[k] = v;
  return out;
}

/**
 * V5가 저절로 적는 표시 - 지문에 넣지 않는다(사용자가 고친 것이 아니다). 넣으면 이월 표시(carrying - P3-3 ForwardMarks)나
 * 앱 안 알림이 울린 표시(alarmDone)만으로 'V5에서 고침'이 되어 그 뒤 V4에서 끝내거나 고친 것을 다시 가져오지 못한다.
 */
const NOT_IN_FINGERPRINT = new Set(['carrying', 'alarmDone']);

/** 내용 칸의 지문 (칸 차례와 상관없다) */
export function fingerprint(content: Fields): string {
  const rest: Fields = {};
  for (const [k, v] of Object.entries(content)) if (!NOT_IN_FINGERPRINT.has(k)) rest[k] = v;
  return hashText(stableStringify(rest), 16);
}

/** V4에서 가져와 V5에서 고치지 않은 문서인가 (src가 없거나 지문이 다르면 V5 것) */
export function untouched(doc: { src?: ImportSource }): boolean {
  return !!doc.src?.h && fingerprint(contentOf(doc as Fields)) === doc.src.h;
}

export interface PlanResult {
  ops: WriteOp[];
  counts: ImportCounts;
}

/**
 * 가져올 목록 → 쓰기 묶음과 결과 수.
 *   existing = 그 공간·그 컬렉션의 V5 문서 (지운 것 포함, 서버에서 읽은 것)
 *   owns     = 이 종류로 가져온 V5 문서인가 (V4에서 없어진 것을 찾을 때 - 예: src.path가 'settings/labels'이고 종류가 같다)
 */
export function planDocs<C extends ImportColl>(
  sid: string,
  coll: C,
  planned: readonly Planned<C>[],
  existing: Readonly<Record<string, Stored<C>>>,
  owns: (doc: Stored<C>) => boolean,
): PlanResult {
  const ops: WriteOp[] = [];
  const counts = emptyCounts();
  const seen = new Set<string>();
  const at = (id: string) => ({ sid, coll, id });

  for (const p of planned) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const data = contentOf(p.data as Fields);
    const src: ImportSource = { from: 'v4', path: p.src.path, id: p.src.id, h: fingerprint(data) };
    const cur = existing[p.id] as (Stored<C> & Fields) | undefined;
    const write = () => ops.push(writeOp.create(at(p.id), { ...data, src } as unknown as Editable<C>));

    if (!cur) {
      write();
      tally(counts, 'added', p.year);
    } else if (cur.deletedAt) {
      // 가져오기가 지운 것(V4에서 없어졌던 것)이 다시 있으면 새로, 사용자가 지운 것은 둔다
      if (cur.deletedBy === IMPORT_DELETER) {
        write();
        tally(counts, 'added', p.year);
      } else tally(counts, 'kept', p.year);
    } else if (!untouched(cur)) {
      tally(counts, 'kept', p.year);
    } else if (cur.src!.h === src.h && cur.src!.path === src.path && cur.src!.id === src.id) {
      tally(counts, 'same', p.year);
    } else {
      const now = contentOf(cur);
      const changes: Fields = {};
      for (const k of new Set([...Object.keys(now), ...Object.keys(data)])) {
        if (!sameValue(now[k], data[k])) changes[k] = data[k];
      }
      changes.src = src;
      ops.push(writeOp.patch(at(p.id), changes as Changes<C>, cur));
      tally(counts, 'changed', p.year);
    }
  }

  // V4에서 없어진 것
  for (const doc of Object.values(existing) as Array<Stored<C> & Fields>) {
    if (seen.has(doc.id) || doc.deletedAt || !owns(doc)) continue;
    if (untouched(doc)) {
      ops.push(writeOp.remove(at(doc.id), IMPORT_DELETER));
      tally(counts, 'removed');
    } else tally(counts, 'kept');
  }
  return { ops, counts };
}

/** 여러 결과 수 더하기 */
export function addCounts(a: ImportCounts, b: ImportCounts): ImportCounts {
  const out: ImportCounts = {
    added: a.added + b.added,
    changed: a.changed + b.changed,
    same: a.same + b.same,
    kept: a.kept + b.kept,
    removed: a.removed + b.removed,
  };
  if (a.years || b.years) {
    out.years = { ...a.years };
    for (const [y, n] of Object.entries(b.years ?? {})) out.years[y] = (out.years[y] ?? 0) + n;
  }
  return out;
}

// V4 lib/labelTree.ts에서 옮긴 읽기 (DESIGN 8-1). 메모·기록 라벨의 상위/하위.
//
// V4는 V4만 쓰는 따로 된 문서(users/{uid}/settings/v4_labelTree)에 "하위 이름 → 상위 이름"만 둔다.
// 19번 U5(10-07)부터 메모·기록 라벨은 한 목록이라 트리도 entry 하나. 그 전 문서는 memo·journal 둘 - 합친다(같은 하위는 기록 쪽).
// V5는 라벨 문서마다 parentId(id)로 둔다(DESIGN 4-3) - 가져오기가 이름을 id로 바꾼다.
import { mergeEntryTrees } from './entryLabels';

/** 하위 이름 → 상위 이름 */
export type V4ParentMap = Record<string, string>;

/**
 * 믿을 수 있는 모양으로 다듬는다. 지금 있는 라벨 이름(names)을 주면 없는 라벨은 걸러낸다.
 * 자기 자신이 상위인 것, 상위가 다시 상위를 가진 것(3단계 - 그 하위를 맨 위로)은 버린다.
 */
export function sanitizeParents(raw: unknown, names?: readonly string[]): V4ParentMap {
  const out: V4ParentMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const known = names ? new Set(names) : null;
  for (const [child, parent] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof parent !== 'string' || !child || !parent || child === parent) continue;
    if (known && (!known.has(child) || !known.has(parent))) continue;
    out[child] = parent;
  }
  for (const child of Object.keys(out)) {
    if (out[out[child]]) delete out[child];
  }
  return out;
}

export interface V4LabelTree {
  entry: V4ParentMap;
  /** entry가 없던 옛 문서에서 memo·journal의 상위가 달랐던 하위 이름 */
  conflicts: string[];
}

/** 저장된 문서 → 트리. entry가 있으면 그것, 없으면 memo·journal을 합친다 */
export function readLabelTree(data: unknown): V4LabelTree {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (d.entry && typeof d.entry === 'object') return { entry: sanitizeParents(d.entry), conflicts: [] };
  const merged = mergeEntryTrees(sanitizeParents(d.memo), sanitizeParents(d.journal));
  return { entry: sanitizeParents(merged.entry), conflicts: merged.conflicts };
}

// 메모·기록 라벨의 상위/하위 (2단계) - V4 lib/labelTree.ts를 이름 대신 id로 (원칙 3).
// 예: '학교' 밑에 'A초', 'B초', 'C초'.
//
// 사용자와 정한 것 (V4 2026-09-29 · 10-06):
//   - 메모·기록 라벨만. 일정 라벨은 속성(달력·이월…) 때문에 뺀다.
//   - 2단계까지 (상위 › 하위). 하위를 가진 라벨은 상위를 가질 수 없고, 하위의 하위는 없다.
//   - 라벨로 보기에서 상위를 고르면 하위가 붙은 항목까지 보인다. 하위 끝 가상 칩 '기타' = 하위 없이 상위만 붙은 항목.
//   - 칩 고르기는 윈도우 탐색기처럼 (그냥 = 하나, Ctrl = 더하기·빼기, Shift = 범위).
//
// V4와 다른 점: 상위는 라벨 문서마다 `parentId`(DESIGN 4-3). V4는 따로 된 설정 문서에 '하위 이름 → 상위 이름'을 두어
// 이름을 바꾸면 트리도 고쳐 써야 했다. 여기서는 모두 id라 이름을 바꿔도 트리는 그대로다.
// 문서의 parentId는 믿지 않고 다듬어 쓴다(parentMapOf): 상위가 지워졌거나 다른 종류거나 3단계가 되면 그 하위는 맨 위 단계로 보인다 -
// 상위를 휴지통에서 되살리면 트리도 돌아온다(하위 문서를 고쳐 쓰지 않는다).

/** 하위 id → 상위 id */
export type ParentMap = Record<string, string>;

/**
 * 라벨 문서들(차례대로) → 쓸 수 있는 상위/하위. 상위가 이 목록에 있고 자기 자신이 아니어야 한다.
 * 상위가 다시 하위인 것(3단계)은 끊는다 - 앞 차례부터 보아 끊으므로 어느 기기에서나 같다.
 */
export function parentMapOf(labels: ReadonlyArray<{ id: string; parentId?: string | null }>): ParentMap {
  const known = new Set(labels.map((l) => l.id));
  const out: ParentMap = {};
  for (const l of labels) {
    const p = l.parentId;
    if (p && p !== l.id && known.has(p)) out[l.id] = p;
  }
  for (const child of Object.keys(out)) {
    if (out[out[child]]) delete out[child];
  }
  return out;
}

export interface TreeRow {
  id: string;
  /** 0 = 상위(또는 혼자), 1 = 하위 */
  depth: 0 | 1;
  parent?: string;
  hasChildren: boolean;
}

/**
 * 라벨을 트리 차례로 늘어놓는다. 상위는 원래 차례대로, 하위는 제 상위 바로 뒤에 원래 차례대로.
 * 상위가 목록에 없는 하위는 맨 위 단계로 둔다.
 */
export function orderByTree(ids: readonly string[], parents: ParentMap): TreeRow[] {
  const set = new Set(ids);
  const parentOf = (n: string) => (parents[n] && set.has(parents[n]) && parents[n] !== n ? parents[n] : undefined);
  const rows: TreeRow[] = [];
  for (const id of ids) {
    if (parentOf(id)) continue;
    const children = ids.filter((c) => parentOf(c) === id);
    rows.push({ id, depth: 0, hasChildren: children.length > 0 });
    for (const c of children) rows.push({ id: c, depth: 1, parent: id, hasChildren: false });
  }
  return rows;
}

/** 하위 id들 */
export const childrenOf = (parent: string, parents: ParentMap) => Object.keys(parents).filter((c) => parents[c] === parent);

/** 상위 하나와 그 하위 (자기 자신 포함) */
export function expandLabel(id: string, parents: ParentMap): string[] {
  return [id, ...childrenOf(id, parents)];
}

/**
 * 라벨로 보기 (여러 개 고르기). 고른 라벨 중 하나라도 붙은 항목이 보인다.
 * 상위를 고르면 하위도 함께. '기타'를 고른 상위(others) = 그 상위가 붙었지만 그 하위는 하나도 안 붙은 항목.
 */
export interface LabelFilter {
  labels: string[];
  /** '기타' 칩을 고른 상위 id */
  others: string[];
}

export const EMPTY_FILTER: LabelFilter = { labels: [], others: [] };

/** '기타' 칩의 열쇠 (칩 차례·Shift 범위에서 라벨 id와 함께 다룬다). id에 들 수 없는 글자로 시작한다 */
const OTHER_MARK = '\u0000기타:';
export const otherKey = (parent: string) => OTHER_MARK + parent;
export const isOtherKey = (key: string) => key.startsWith(OTHER_MARK);
export const otherParentOf = (key: string) => key.slice(OTHER_MARK.length);

/** 기억해 둔 값을 믿을 수 있는 모양으로 */
export function readLabelFilter(raw: unknown): LabelFilter {
  if (!raw || typeof raw !== 'object') return EMPTY_FILTER;
  const r = raw as { labels?: unknown; others?: unknown };
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);
  return { labels: strs(r.labels), others: strs(r.others) };
}

export const isEmptyFilter = (f: LabelFilter) => f.labels.length === 0 && f.others.length === 0;

/**
 * 이 항목(붙은 라벨 id들)이 거르개에 걸리나. 아무것도 안 골랐으면 늘 참.
 * 고른 라벨이 붙었거나(상위면 그 하위 하나라도), '기타'를 고른 상위가 붙고 그 하위는 하나도 없으면 참.
 */
export function matchLabels(itemLabelIds: readonly string[] | undefined, filter: LabelFilter, parents: ParentMap): boolean {
  if (isEmptyFilter(filter)) return true;
  const has = new Set(itemLabelIds ?? []);
  for (const id of filter.labels) {
    if (has.has(id)) return true;
    if (childrenOf(id, parents).some((c) => has.has(c))) return true;
  }
  for (const parent of filter.others) {
    if (has.has(parent) && !childrenOf(parent, parents).some((c) => has.has(c))) return true;
  }
  return false;
}

const toKeys = (f: LabelFilter) => [...f.labels, ...f.others.map(otherKey)];
const fromKeys = (keys: string[]): LabelFilter => ({
  labels: keys.filter((k) => !isOtherKey(k)),
  others: keys.filter(isOtherKey).map(otherParentOf),
});

/** 칩(라벨 id 또는 otherKey)을 붙이고 뗀다 */
export function toggleFilterLabel(filter: LabelFilter, key: string): LabelFilter {
  const keys = toKeys(filter);
  return fromKeys(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
}

export type FilterClick = { ctrl: boolean; shift: boolean };

/**
 * 라벨 칩을 윈도우 탐색기처럼 고른다 (V4 2026-09-30 사용자가 정함).
 *   - 그냥 누르기: 그 칩 하나만 (다른 것은 뗀다)
 *   - Ctrl(맥은 ⌘) + 누르기: 붙이고 떼기 (여러 개)
 *   - Shift + 누르기: 기준(마지막으로 그냥·Ctrl로 누른 칩)부터 여기까지 보이는 차례대로 (Ctrl+Shift는 더하기)
 * key·order·anchor는 라벨 id 또는 '기타' 칩의 otherKey(상위).
 */
export function clickFilterLabel(
  filter: LabelFilter,
  key: string,
  click: FilterClick,
  order: readonly string[],
  anchor: string | null,
): LabelFilter {
  const keys = toKeys(filter);
  if (click.shift && anchor && order.includes(anchor) && order.includes(key)) {
    const [a, b] = [order.indexOf(anchor), order.indexOf(key)].sort((x, y) => x - y);
    const range = order.slice(a, b + 1);
    return fromKeys(click.ctrl ? [...keys, ...range.filter((k) => !keys.includes(k))] : range);
  }
  if (click.ctrl) return toggleFilterLabel(filter, key);
  return fromKeys([key]);
}

/**
 * 화면에 보이는 거르개 칩 차례 (Shift 범위에 쓴다): 상위 → 그 하위들 → 그 상위의 '기타'.
 * 접힌 상위의 하위·기타는 빼되, 골라 둔 것은 보인다.
 */
export function filterChipOrder(
  rows: readonly TreeRow[],
  isOpen: (parent: string) => boolean,
  isSelected: (key: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (r.depth === 1) continue;
    out.push(r.id);
    if (!r.hasChildren) continue;
    const open = isOpen(r.id);
    for (const c of rows) if (c.parent === r.id && (open || isSelected(c.id))) out.push(c.id);
    const other = otherKey(r.id);
    if (open || isSelected(other)) out.push(other);
  }
  return out;
}

/** 지금 있는 라벨만 남긴다 (지운 라벨을 기억한 채로 두지 않는다) */
export function pruneFilter(filter: LabelFilter, ids: readonly string[]): LabelFilter {
  const known = new Set(ids);
  return { labels: filter.labels.filter((l) => known.has(l)), others: filter.others.filter((p) => known.has(p)) };
}

/** 칩에 마우스를 올렸을 때 보일 이름. 하위면 '상위 › 하위' */
export function labelPath(id: string, parents: ParentMap, nameOf: (id: string) => string | undefined): string {
  const name = nameOf(id) ?? '';
  const parent = parents[id];
  return parent ? `${nameOf(parent) ?? ''} › ${name}` : name;
}

/**
 * '상위 라벨' 고르기 칸에 보일 후보. 자기 자신, 이미 하위인 라벨(3단계가 되므로)은 빠진다.
 * 자기에게 하위가 있으면 상위를 가질 수 없으므로 빈 목록.
 */
export function parentCandidates(id: string, ids: readonly string[], parents: ParentMap): string[] {
  if (Object.values(parents).includes(id)) return [];
  return ids.filter((n) => n !== id && !parents[n]);
}

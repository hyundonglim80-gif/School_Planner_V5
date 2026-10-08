// V4 lib/entryLabels.ts에서 옮긴 읽기 (DESIGN 8-1). 메모·기록 라벨 한 목록.
//
// V4 settings/labels의 두 배열(V3와 함께 쓴다):
//   - memoLabels: 이름 문자열 또는 { name, color?, id? } (V3 옛 판은 문자열만) - 메모는 라벨을 **이름**으로 들고 있다
//   - journalLabels: { id, name, color } - 기록은 라벨을 **id**(labelIds)로 들고 있다
// V4는 둘을 이름(앞뒤 빈칸을 뗀 것)으로 합쳐 하나로 보인다. 같은 이름의 색이 다르면 기록 쪽 색.
// 메모에만 있던 라벨의 기록용 id는 이름으로 정한다(`jm_이름`) - V4 기록이 그 id를 들고 있을 수 있다.
// 쓰는 쪽(toMemoLabels·toJournalLabels·fillEntryLabels)은 V5가 V4에 쓰지 않으므로 옮기지 않았다.

export interface V4EntryLabel {
  /** 기록 라벨 id. 메모에만 있던 라벨은 `jm_이름` */
  id: string;
  name: string;
  color: string;
  /** journalLabels에 실제로 있는가 */
  inJournal: boolean;
}

/** V4가 라벨 문서가 없을 때 보이는 기본값 (V4 useLabels 그대로) */
export const V4_DEFAULT_MEMO_LABELS: readonly string[] = ['긴급', '중요', '업무', '개인', '기타'];
export const V4_DEFAULT_JOURNAL_LABELS: ReadonlyArray<{ id: string; name: string; color: string }> = [
  { id: 'j_1', name: '학급활동', color: 'green' },
  { id: 'j_2', name: '학생상담', color: 'yellow' },
  { id: 'j_3', name: '업무전달', color: 'blue' },
  { id: 'j_4', name: '수업기록', color: 'purple' },
];

const nameOf = (l: unknown): string =>
  typeof l === 'string' ? l.trim() : l && typeof l === 'object' ? String((l as { name?: unknown }).name ?? '').trim() : '';

/** 메모에만 있던 라벨의 기록용 id */
export const entryJournalId = (name: string) => `jm_${name.trim()}`;

/** 두 배열을 이름으로 합친다. 차례: 기록 라벨 차례 → 메모에만 있는 것(메모 차례) */
export function mergeEntryLabels(memoRaw: readonly unknown[], journalRaw: readonly unknown[]): V4EntryLabel[] {
  const out: V4EntryLabel[] = [];
  const byName = new Map<string, V4EntryLabel>();
  journalRaw.forEach((j, i) => {
    const name = nameOf(j);
    if (!name || byName.has(name)) return;
    const o = j as { id?: unknown; color?: unknown };
    const l: V4EntryLabel = {
      id: String(o.id || `j_${i}_${name}`),
      name,
      color: typeof o.color === 'string' && o.color ? o.color : 'green',
      inJournal: true,
    };
    byName.set(name, l);
    out.push(l);
  });
  memoRaw.forEach((m) => {
    const name = nameOf(m);
    if (!name || byName.has(name)) return;
    const color = m && typeof m === 'object' && typeof (m as { color?: unknown }).color === 'string' ? (m as { color: string }).color : 'green';
    const l: V4EntryLabel = { id: entryJournalId(name), name, color, inJournal: false };
    byName.set(name, l);
    out.push(l);
  });
  return out;
}

/** 상위/하위 트리 합치기 (하위 이름 → 상위 이름): 같은 하위의 상위가 다르면 기록 쪽. conflicts = 상위가 달랐던 하위 이름 */
export function mergeEntryTrees(
  memo: Record<string, string>,
  journal: Record<string, string>,
): { entry: Record<string, string>; conflicts: string[] } {
  const entry: Record<string, string> = { ...memo, ...journal };
  const conflicts = Object.keys(memo).filter((c) => journal[c] && journal[c] !== memo[c]);
  return { entry, conflicts };
}

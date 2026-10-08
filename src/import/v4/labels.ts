// V4 라벨 → V5 labels (DESIGN 8-3). 순수 함수 - 읽기는 read.ts, 적기는 run.ts.
//
//   V4 users/{uid}/settings/labels  eventLabels(또는 V3 옛 칸 labels)  → labels(event, props)   속성은 V3 이름 먼저(normalizeEventLabel)
//                                   memoLabels + journalLabels         → labels(note)            이름으로 합친다(mergeEntryLabels)
//   V4 settings/v4_labelTree        하위 이름 → 상위 이름               → 하위 라벨의 parentId(id)
//   V4 settings/v4_gcal             labels: { [일정 라벨 id]: true }   → props.gcal
//
// - V5 id = v4id('label.event'|'label.note', 공간, 'settings/labels', V4 열쇠). 열쇠는 V4 라벨 id(메모에만 있던 것은 V4가 쓰는 `jm_이름`),
//   id가 없던 일정 라벨은 'name:이름'(V4는 `ev_차례_이름`을 붙였다 - 차례가 밀리면 다른 라벨이 된다).
// - V4에 라벨 문서가 없으면 V4가 보이던 기본 라벨을 가져온다(그 사람 항목이 그 id·이름을 들고 있다).
// - 이름은 같은 종류 안에서 겹치지 않게(DESIGN 4-3): V5에 이름이 같은 라벨이 이미 있으면(V5에서 만든 것·'기본 라벨 넣기') 새로 만들지 않고 그 라벨에 잇는다.
//   V4에 이름이 같은 라벨이 둘이면 앞의 것에 잇는다. 이은 것은 짝 표(labelMap - V4 이름 → V5 id)에 - P3-4 항목 가져오기가 이것으로 라벨을 찾는다.
// - 차례는 V4 차례대로 'a0', 'a1' … (V5 상태와 상관없이 셈해 다시 가져와도 같다).
import { cleanLabelName, labelProps } from '../../domain/labels';
import { ordersBetween } from '../../domain/order';
import type { WriteOp } from '../../data/repo/ops';
import type { ItemKind, Stored } from '../../data/types';
import { v4id } from './ids';
import { mergeEntryLabels, V4_DEFAULT_JOURNAL_LABELS, V4_DEFAULT_MEMO_LABELS } from './legacy/entryLabels';
import { normalizeEventLabel, V4_DEFAULT_EVENT_LABELS } from './legacy/eventLabels';
import { readLabelTree, sanitizeParents } from './legacy/labelTree';
import { planDocs, tally, untouched, type ImportCounts, type Planned } from './plan';

type LabelDoc = Stored<'labels'>;

/** V4 라벨 자리 (공간 밑) */
export const V4_LABELS_PATH = 'settings/labels';

/** 읽어 온 V4 설정 문서들 (없는 문서는 undefined) */
export interface V4LabelDocs {
  labels?: unknown;
  labelTree?: unknown;
  gcal?: unknown;
}

export interface LabelsPlan {
  ops: WriteOp[];
  counts: Record<ItemKind, ImportCounts>;
  /** V4 이름 → V5 라벨 id (종류마다) */
  labelMap: Record<ItemKind, Record<string, string>>;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const nonEmpty = (v: unknown): unknown[] | null => (Array.isArray(v) && v.length > 0 ? v : null);

interface Source {
  /** V4 열쇠 (v4id에) */
  key: string;
  /** V4 이름 그대로 (짝 표의 열쇠 - V4 항목이 들고 있는 이름) */
  v4Name: string;
  name: string;
  color: string;
  props?: ReturnType<typeof labelProps>;
  /** 상위의 V4 이름 (메모·기록) */
  parentName?: string;
}

/** V4 일정 라벨 → 가져올 것 */
export function eventLabelSources(docs: V4LabelDocs): Source[] {
  const d = obj(docs.labels);
  const raw = nonEmpty(d.eventLabels) ?? nonEmpty(d.labels) ?? V4_DEFAULT_EVENT_LABELS;
  const gcal = obj(obj(docs.gcal).labels);
  return raw.map((r, i) => {
    const l = normalizeEventLabel(r, i);
    const rawId = obj(r).id;
    return {
      key: typeof rawId === 'string' && rawId ? rawId : `name:${cleanLabelName(l.name)}`,
      v4Name: l.name,
      name: cleanLabelName(l.name),
      color: l.color,
      props: labelProps({ calendar: l.calendar, forward: l.forward, skip: l.skip, period: l.period, recur: l.recur, gcal: gcal[l.id] === true }),
    };
  });
}

/** V4 메모·기록 라벨 → 가져올 것 (상위는 트리 문서에서) */
export function noteLabelSources(docs: V4LabelDocs): Source[] {
  const d = obj(docs.labels);
  const merged = mergeEntryLabels(nonEmpty(d.memoLabels) ?? V4_DEFAULT_MEMO_LABELS, nonEmpty(d.journalLabels) ?? V4_DEFAULT_JOURNAL_LABELS);
  const parents = sanitizeParents(
    readLabelTree(docs.labelTree).entry,
    merged.map((l) => l.name),
  );
  // 열쇠 = V4 기록 라벨 id (메모에만 있던 것은 entryJournalId - V4 기록이 그 id를 들고 있을 수 있다)
  return merged.map((l) => ({
    key: l.id,
    v4Name: l.name,
    name: cleanLabelName(l.name),
    color: l.color,
    parentName: parents[l.name],
  }));
}

const owns = (kind: ItemKind) => (d: LabelDoc) => d.kind === kind && d.src?.from === 'v4' && d.src.path === V4_LABELS_PATH;

function planKind(sid: string, kind: ItemKind, sources: Source[], existing: Readonly<Record<string, LabelDoc>>) {
  const labelMap: Record<string, string> = {};
  const idOf = (s: Source) => v4id(`label.${kind}`, sid, V4_LABELS_PATH, s.key);
  const plannedIds = new Set(sources.map(idOf));
  // 이름이 같으면 이을 V5 라벨: 이 가져오기의 것이 아니고, 이번에 지워질 것(V4에서 없어졌고 V5에서 고치지 않은 것)도 아닌 살아 있는 라벨
  const taken = new Map<string, string>();
  for (const d of Object.values(existing)) {
    if (d.kind !== kind || d.deletedAt || plannedIds.has(d.id)) continue;
    if (owns(kind)(d) && untouched(d)) continue;
    if (!taken.has(cleanLabelName(d.name))) taken.set(cleanLabelName(d.name), d.id);
  }

  const kept: Source[] = [];
  const used = new Map<string, string>();
  const rows: Array<{ s: Source; id: string }> = [];
  for (const s of sources) {
    if (!s.name) continue;
    const id = idOf(s);
    const cur = existing[id];
    const other = taken.get(s.name);
    const twin = used.get(s.name);
    if (twin !== undefined && twin !== id) {
      labelMap[s.v4Name] ??= twin;
      continue;
    }
    if (other && !(cur && !cur.deletedAt)) {
      labelMap[s.v4Name] ??= other;
      kept.push(s);
      continue;
    }
    labelMap[s.v4Name] ??= id;
    if (rows.some((r) => r.id === id)) continue;
    used.set(s.name, id);
    // V4에서 이름을 바꿨는데 V5의 다른 라벨과 겹치면 V5 이름을 둔다
    rows.push({ s: other && cur ? { ...s, name: cur.name } : s, id });
  }

  const keys = ordersBetween(null, null, rows.length);
  const byV4Name = new Map(rows.map((r) => [r.s.v4Name, r.id]));
  const planned: Planned<'labels'>[] = rows.map(({ s, id }, i) => {
    const parentId = kind === 'note' && s.parentName ? (byV4Name.get(s.parentName) ?? labelMap[s.parentName] ?? null) : null;
    const data: Planned<'labels'>['data'] = { kind, name: s.name, color: s.color, parentId: parentId === id ? null : parentId, order: keys[i] };
    if (kind === 'event') data.props = s.props;
    return { id, data, src: { path: V4_LABELS_PATH, id: s.key } };
  });

  const { ops, counts } = planDocs(sid, 'labels', planned, existing, owns(kind));
  for (let i = 0; i < kept.length; i++) tally(counts, 'kept');
  return { ops, counts, labelMap };
}

/** V4 라벨 → 쓰기 묶음·결과 수·짝 표. existing = 그 공간의 V5 라벨(지운 것 포함, 서버에서 읽은 것) */
export function planLabels(sid: string, docs: V4LabelDocs, existing: Readonly<Record<string, LabelDoc>>): LabelsPlan {
  const ev = planKind(sid, 'event', eventLabelSources(docs), existing);
  const note = planKind(sid, 'note', noteLabelSources(docs), existing);
  return {
    ops: [...ev.ops, ...note.ops],
    counts: { event: ev.counts, note: note.counts },
    labelMap: { event: ev.labelMap, note: note.labelMap },
  };
}

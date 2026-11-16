// 메모 틀 (P36-2 - 자주 쓰는 양식) - 순수 셈. 읽기·쓰기는 data/noteTemplates, 단추·목록은 features/notes/NoteTemplateMenu.
//
// - 담는 곳 = 개인 공간 settings/noteTemplates 한 문서, 틀마다 칸 `t.<id>` (그룹 공간 메모에서도 내 틀 · 계정이라 기기끼리 같다).
//   고칠 때는 그 틀의 칸만 적는다(merge - 두 기기가 서로 다른 틀을 고쳐도 덮지 않는다). 지우기 = `t.<id>` 칸 지우기.
// - 담는 것 = 글(체크 줄은 모두 ☐) · 라벨 · 표. 첨부·날짜·완료·즐겨찾기·학생은 뺀다(그때마다 다른 것 - PLAN 5장 'P36-2 ■0').
// - 라벨은 id와 이름(상위 이름)을 함께 - 채울 때 같은 공간이고 그 라벨이 있으면 id, 아니면 이름이 같은 라벨, 그것도 없으면 '+ 새 라벨'(저장할 때만 만든다).
// - 채우기는 글·표·라벨만 틀 것으로 바꾼다. 글이 있으면 묻는 것은 화면(쓰던 글은 묻지 않고 덮이지 않는다).
import { firstTextLine } from './noteTitle';
import type { EntryTable } from '../data/types';

export const NOTE_TEMPLATES_DOC_ID = 'noteTemplates';
/** 틀 개수 한도 */
export const MAX_NOTE_TEMPLATES = 30;
/** 문서 크기 한도 (Firestore 문서 1MB - 넉넉히) */
export const MAX_TEMPLATES_BYTES = 900_000;
/** 이름 길이 한도 (목록 한 줄) */
export const MAX_TEMPLATE_NAME = 40;

export interface TemplateLabel {
  /** 만든 공간의 라벨 id */
  id: string;
  name: string;
  /** 상위 라벨 이름 (하위 라벨이면) */
  parent?: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  text: string;
  labels: TemplateLabel[];
  /** 라벨 id가 가리키는 공간 (만든 공간) */
  sid: string;
  tables: EntryTable[];
  /** 목록 차례 (작은 것이 위) */
  order: number;
  /** 만든·고친 때 (ms) */
  at: number;
}

/** 틀을 채울 메모 칸 (features/notes/noteForm NoteForm의 일부) */
export interface TemplateTarget {
  text: string;
  labelIds: string[];
  newLabels: string[];
  tables: EntryTable[];
}

/** 라벨을 셀 때 쓰는 트리 (data/select LabelTree의 일부) */
export interface TemplateLabelTree {
  list: ReadonlyArray<{ id: string; name: string }>;
  byId: ReadonlyMap<string, { id: string; name: string }>;
  /** 하위 id → 상위 id */
  parents: Readonly<Record<string, string>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function readLabel(v: unknown): TemplateLabel | null {
  if (!isObj(v)) return null;
  const name = str(v.name).trim();
  if (!name) return null;
  const parent = str(v.parent).trim();
  return { id: str(v.id), name, ...(parent ? { parent } : {}) };
}

function readTable(v: unknown): EntryTable | null {
  if (!isObj(v) || !Array.isArray(v.rows)) return null;
  return v as unknown as EntryTable;
}

/** 서버 문서 → 틀 목록 (차례대로 - 모양이 틀린 칸은 건너뛴다) */
export function readNoteTemplates(data: unknown): NoteTemplate[] {
  const t = isObj(data) && isObj(data.t) ? data.t : {};
  const out: NoteTemplate[] = [];
  for (const [id, v] of Object.entries(t)) {
    if (!isObj(v)) continue;
    const text = str(v.text);
    const tables = Array.isArray(v.tables) ? v.tables.map(readTable).filter((x): x is EntryTable => !!x) : [];
    if (!text.trim() && tables.length === 0) continue;
    out.push({
      id,
      name: str(v.name).trim() || firstTextLine(text) || '틀',
      text,
      labels: Array.isArray(v.labels) ? v.labels.map(readLabel).filter((x): x is TemplateLabel => !!x) : [],
      sid: str(v.sid),
      tables,
      order: num(v.order),
      at: num(v.at),
    });
  }
  return out.sort((a, b) => a.order - b.order || a.at - b.at || a.id.localeCompare(b.id));
}

/** 체크 줄을 모두 ☐로 (틀은 늘 새로 체크한다) */
export function uncheckAll(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^([ \t]*)☑/, '$1☐'))
    .join('\n');
}

/** 틀 이름 = 글의 첫 줄(제목 - P35, 길면 자른다), 없으면 '틀 n' */
export function templateNameOf(text: string, list: readonly NoteTemplate[]): string {
  const first = firstTextLine(text).replace(/\s+/g, ' ').trim();
  if (first) return first.length > MAX_TEMPLATE_NAME ? `${first.slice(0, MAX_TEMPLATE_NAME - 1)}…` : first;
  const used = new Set(list.map((t) => t.name));
  let n = list.length + 1;
  while (used.has(`틀 ${n}`)) n++;
  return `틀 ${n}`;
}

/** 겹치지 않는 이름 ('회의록' → '회의록 (2)' …) */
export function uniqueTemplateName(name: string, list: readonly NoteTemplate[]): string {
  const used = new Set(list.map((t) => t.name));
  if (!used.has(name)) return name;
  let n = 2;
  while (used.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

/** 이름 다듬기 (빈 이름은 null - 바꾸지 않는다) */
export function cleanTemplateName(name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_NAME);
  return n || null;
}

/** 메모 칸 → 틀 라벨 (고른 라벨은 id + 이름, '+ 새 라벨'은 이름만) */
export function templateLabelsOf(labelIds: readonly string[], newLabels: readonly string[], tree: TemplateLabelTree): TemplateLabel[] {
  const out: TemplateLabel[] = [];
  for (const id of labelIds) {
    const l = tree.byId.get(id);
    if (!l) continue;
    const parentId = tree.parents[id];
    const parent = parentId ? tree.byId.get(parentId)?.name : undefined;
    out.push({ id, name: l.name, ...(parent ? { parent } : {}) });
  }
  for (const n of newLabels) if (n.trim()) out.push({ id: '', name: n.trim() });
  return out;
}

/** 메모 칸 → 틀 (id·차례·때는 부르는 쪽이) */
export function templateFromForm(
  form: TemplateTarget,
  tree: TemplateLabelTree,
  at: { id: string; sid: string; name: string; order: number; now: number },
): NoteTemplate {
  return {
    id: at.id,
    name: at.name,
    text: uncheckAll(form.text).trim(),
    labels: templateLabelsOf(form.labelIds, form.newLabels, tree),
    sid: at.sid,
    tables: form.tables.map((t) => ({ ...t })),
    order: at.order,
    at: at.now,
  };
}

/** 틀 라벨 → 이 공간의 라벨 (있으면 id, 없으면 '+ 새 라벨' 이름 - 'AAA-BBB' = 상위-하위) */
export function resolveTemplateLabels(tpl: Pick<NoteTemplate, 'labels' | 'sid'>, tree: TemplateLabelTree, sid: string): { labelIds: string[]; newLabels: string[] } {
  const labelIds: string[] = [];
  const newLabels: string[] = [];
  const parentName = (id: string) => {
    const p = tree.parents[id];
    return p ? (tree.byId.get(p)?.name ?? '') : '';
  };
  for (const l of tpl.labels) {
    let id = tpl.sid === sid && l.id && tree.byId.has(l.id) ? l.id : null;
    if (!id) {
      // 이름(과 상위 이름)이 같은 라벨 - 상위가 없는 틀 라벨은 상위가 없는 라벨부터
      const same = tree.list.filter((x) => x.name.trim() === l.name);
      const hit = same.find((x) => parentName(x.id) === (l.parent ?? '')) ?? (l.parent ? undefined : same[0]);
      id = hit?.id ?? null;
    }
    if (id) {
      if (!labelIds.includes(id)) labelIds.push(id);
      continue;
    }
    const name = l.parent ? `${l.parent}-${l.name}` : l.name;
    if (!newLabels.includes(name)) newLabels.push(name);
  }
  return { labelIds, newLabels };
}

/** 틀로 채운 칸 - 글·표·라벨만 틀 것으로 (표는 새 id - 메모마다 따로). 틀에 라벨이 없으면 칸의 라벨 그대로 */
export function applyTemplate<F extends TemplateTarget>(form: F, tpl: NoteTemplate, tree: TemplateLabelTree, sid: string, makeId: () => string, now = Date.now()): F {
  const labels = resolveTemplateLabels(tpl, tree, sid);
  const hasLabels = labels.labelIds.length > 0 || labels.newLabels.length > 0;
  return {
    ...form,
    text: tpl.text,
    tables: tpl.tables.map((t) => ({ ...t, id: makeId(), createdAt: now })),
    ...(hasLabels ? labels : {}),
  };
}

/** 칸에 틀이 덮을 것이 있나 (글·표 - 있으면 채우기 전에 묻는다) */
export const formHasBody = (f: Pick<TemplateTarget, 'text' | 'tables'>) => !!f.text.trim() || f.tables.length > 0;

/** 틀로 저장할 것이 있나 */
export const canSaveAsTemplate = formHasBody;

// ─── 쓰기 (merge 칸 - data/noteTemplates가 저장 도우미로 적는다) ───

type Changes = Record<string, unknown>;

/**
 * 틀 하나 통째로. 새 틀 = 칸 `t.<id>` 하나(되돌리기가 그 칸을 통째로 지운다),
 * 있는 틀 = 그 틀의 칸마다(merge는 겹친 칸을 합치므로 빈 표는 칸을 지워야 옛 표가 남지 않는다 - 되돌리기는 칸마다 옛 값).
 */
export function templateWrite(tpl: NoteTemplate, existing: boolean): Changes {
  const at = `t.${tpl.id}`;
  const fields: Record<string, unknown> = {
    name: tpl.name,
    text: tpl.text,
    labels: tpl.labels.map((l) => ({ id: l.id, name: l.name, ...(l.parent ? { parent: l.parent } : {}) })),
    sid: tpl.sid,
    tables: tpl.tables.length > 0 ? tpl.tables : undefined,
    order: tpl.order,
    at: tpl.at,
  };
  if (!existing) return { [at]: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [`${at}.${k}`, v]));
}

/** 틀 지우기 */
export const templateRemove = (id: string): Changes => ({ [`t.${id}`]: undefined });

/** 이름 바꾸기 */
export const templateRename = (id: string, name: string): Changes => ({ [`t.${id}.name`]: name });

/** 새 틀의 차례 = 맨 아래 */
export const nextTemplateOrder = (list: readonly NoteTemplate[]) => list.reduce((m, t) => Math.max(m, t.order), -1) + 1;

/** ▲▼ - 옮긴 차례로 0, 1, 2 … 바뀐 틀만. 끝에서 더 못 가면 null */
export function templateMove(list: readonly NoteTemplate[], id: string, step: -1 | 1): Changes | null {
  const from = list.findIndex((t) => t.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) return null;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  const out: Changes = {};
  next.forEach((t, i) => {
    if (t.order !== i) out[`t.${t.id}.order`] = i;
  });
  return out;
}

/** 이 틀을 더하거나 바꾼 뒤의 문서가 한도 안인가 (개수·크기) - 넘으면 안내 글 */
export function templateLimitError(list: readonly NoteTemplate[], tpl: NoteTemplate): string | null {
  const others = list.filter((t) => t.id !== tpl.id);
  if (others.length >= MAX_NOTE_TEMPLATES) return `틀은 ${MAX_NOTE_TEMPLATES}개까지 둘 수 있습니다. 쓰지 않는 틀을 지운 뒤 다시 저장해 주세요.`;
  const bytes = new TextEncoder().encode(JSON.stringify([...others, tpl])).length;
  if (bytes > MAX_TEMPLATES_BYTES) return '틀이 너무 큽니다(큰 표). 표를 줄이거나 쓰지 않는 틀을 지운 뒤 다시 저장해 주세요.';
  return null;
}

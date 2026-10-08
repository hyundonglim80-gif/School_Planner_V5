// 메모·기록 쓰는 칸이 들고 있는 것과 저장할 것 (순수 - 서버 없이 시험한다). 칸은 NotePanel.tsx.
//
// - 📅 날짜 칸 = 자리(DESIGN 4-2, V4 U7): 날짜가 있으면 그날 기록, 비우면 메모. 옮기기 = 문서 하나의 date만
//   (V4는 휴지통 사본을 남기고 새 자리에 다시 썼다). 기록 → 메모는 fromDate('📅 10/6에서')를 남기고, 메모 → 기록은 걷는다.
// - 첫·마지막 줄 '#라벨'(domain/hashLabels): 저장할 때 라벨로 붙이고 그 줄은 글에서 뗀다 - 사용자가 적은 지시라 본문을 바꾸는 것이 맞다.
//   목록에 없는 이름과 '+ 새 라벨'은 저장할 때 항목과 한 묶음으로 만든다(data/labels ensureLabelOps - actions.ts).
// - 저장 = 바뀐 칸만(원칙 1). 고치던 항목의 완료·즐겨찾기는 누르는 즉시 그 칸만 저장하므로 여기 견주지 않는다(새 항목만 처음 저장 때 함께).
// - 글은 앞뒤 빈칸만 다듬어 적는다(V4 그대로).
import { takeHashLabels } from '../../domain/hashLabels';
import type { Changes } from '../../data/repo/ops';
import type { LabelTree } from '../../data/select';
import type { Attachment, Editable, EntryTable, YMD } from '../../data/types';
import type { ItemDoc } from '../events/eventOps';

export interface NoteForm {
  text: string;
  /** 'YYYY-MM-DD' = 그날 기록, '' = 메모 */
  date: YMD | '';
  labelIds: string[];
  /** '+ 새 라벨'로 적은 이름 - 저장할 때 만든다 */
  newLabels: string[];
  /** 새 항목의 완료·즐겨찾기 (처음 저장할 때 함께) */
  done: boolean;
  favorite: boolean;
  attachments: Attachment[];
  tables: EntryTable[];
}

/**
 * 새 칸 = 미리 고른 라벨(라벨로 보기에서 고른 것)이 없으면 맨 위 라벨(V4 - 기록·메모 모두 첫 라벨).
 * 안 고른 채 저장되면 라벨로 보기의 어느 갈래에도 걸리지 않는다.
 */
export function newNoteForm(date: YMD | null, tree: LabelTree, labelIds?: readonly string[], draftText = ''): NoteForm {
  const preset = labelIds?.filter((id) => tree.byId.has(id)) ?? [];
  return {
    text: draftText,
    date: date ?? '',
    labelIds: preset.length > 0 ? preset : tree.defaultId ? [tree.defaultId] : [],
    newLabels: [],
    done: false,
    favorite: false,
    attachments: [],
    tables: [],
  };
}

/** 저장된 항목 → 칸 */
export function noteFormOf(item: ItemDoc): NoteForm {
  return {
    text: item.text ?? '',
    date: item.date ?? '',
    labelIds: [...(item.labelIds ?? [])],
    newLabels: [],
    done: !!item.done,
    favorite: !!item.favorite,
    attachments: [...(item.attachments ?? [])],
    tables: [...(item.tables ?? [])],
  };
}

const keyOf = (f: NoteForm, isNew: boolean) =>
  JSON.stringify([
    f.text.trim(),
    f.date,
    f.labelIds,
    f.newLabels,
    f.attachments.map((a) => a.url),
    f.tables,
    // 고치던 항목의 완료·즐겨찾기는 칸이 아니라 항목에 곧바로 저장한다
    isNew ? [f.done, f.favorite] : null,
  ]);

/** 저장할 것이 같은가 (칸을 손댔나 - ESC 묻기·배경 누르기 저장) */
export function sameNoteForm(a: NoteForm, b: NoteForm, isNew: boolean): boolean {
  return keyOf(a, isNew) === keyOf(b, isNew);
}

/** 저장할 것이 있나 (글·첨부·표 가운데 하나) */
export const hasContent = (f: Pick<NoteForm, 'text' | 'attachments' | 'tables'>) =>
  !!f.text.trim() || f.attachments.length > 0 || f.tables.length > 0;

export interface SavePlan {
  /** 적을 글 ('#라벨' 줄을 뗀 뒤 앞뒤 빈칸을 다듬은 것) */
  text: string;
  /** 붙일 라벨 이름 - '+ 새 라벨'과 '#라벨' (있는 이름이면 그 라벨에 잇는다) */
  names: string[];
}

/** 저장 직전: 첫·마지막 줄 '#라벨'을 떼고 붙일 이름을 모은다 */
export function savePlanOf(form: NoteForm): SavePlan {
  const hash = takeHashLabels(form.text);
  const names = [...form.newLabels];
  for (const n of hash.names) if (!names.includes(n)) names.push(n);
  return { text: (hash.names.length > 0 ? hash.text : form.text).trim(), names };
}

/** 라벨 이름 → 있는 라벨인가 ('#라벨' 미리 보기 - 새로 만들 이름은 '(새로 만듦)') */
export function isKnownLabel(tree: LabelTree, name: string): boolean {
  return tree.list.some((l) => l.name.trim() === name);
}

/** 새 항목 문서 (labelIds는 #라벨·새 라벨까지 합친 것) */
export function createNoteData(form: NoteForm, text: string, labelIds: string[], order: string, now = Date.now()): Editable<'items'> {
  return {
    kind: 'note',
    date: form.date || null,
    text,
    labelIds,
    order,
    ...(form.done ? { done: true, doneAt: now } : {}),
    ...(form.favorite ? { favorite: true } : {}),
    ...(form.attachments.length > 0 ? { attachments: form.attachments } : {}),
    ...(form.tables.length > 0 ? { tables: form.tables } : {}),
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * 고친 항목 → 바뀐 칸만. 바뀐 것이 없으면 빈 객체.
 * 자리(date)가 바뀌면 date만 더 - 기록 → 메모는 fromDate(원래 날)를 남기고, 메모 → 기록은 fromDate를 걷는다.
 */
export function noteEditChanges(item: ItemDoc, form: NoteForm, text: string, labelIds: string[]): Changes<'items'> {
  const out: Changes<'items'> = {};
  if (text !== (item.text ?? '')) out.text = text;
  if (!sameJson(labelIds, item.labelIds ?? [])) out.labelIds = labelIds;
  if (!sameJson(form.attachments, item.attachments ?? [])) out.attachments = form.attachments.length > 0 ? form.attachments : undefined;
  if (!sameJson(form.tables, item.tables ?? [])) out.tables = form.tables.length > 0 ? form.tables : undefined;
  Object.assign(out, placeChanges(item, form.date || null));
  return out;
}

/** 자리 옮기기의 칸 (같은 자리면 빈 객체) */
export function placeChanges(item: Pick<ItemDoc, 'date' | 'fromDate'>, to: YMD | null): Changes<'items'> {
  const from = item.date ?? null;
  if (to === from) return {};
  const out: Changes<'items'> = { date: to };
  if (!to && from) out.fromDate = from;
  else if (to && item.fromDate) out.fromDate = undefined;
  return out;
}

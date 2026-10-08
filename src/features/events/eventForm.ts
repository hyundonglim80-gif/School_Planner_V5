// 일정 칸이 들고 있는 것과 저장할 것 (순수 - 서버 없이 시험한다). 칸은 EventPanel.tsx.
//
// - 속성(달력·이월·수업X·구글 캘린더): **라벨이 정한 값**(붙은 라벨 가운데 하나라도 켰으면 켬, 라벨이 없으면 달력만 켬 - V4 그대로)이 먼저이고,
//   이 일정만 다르게 정한 것만 `props`에 적는다(DESIGN 4-2 - 같으면 적지 않아 나중에 라벨 속성을 바꾸면 따라간다).
//   라벨을 바꾸면 따로 정한 것은 걷는다 - 새 라벨의 속성을 따라 켜진다(V4 '라벨을 고르면 그 라벨 속성이 따라 켜진다').
// - 저장 = 바뀐 칸만(원칙 1 - 이름 바꾸기처럼 문서 하나의 그 칸만). 날짜를 바꾸면 date만 더 - 알림 시각은 date 기준이라 따라간다.
// - 글은 앞뒤 빈칸만 다듬어 적는다(V4 그대로). 그 밖에는 읽기·저장 길에서 바꾸지 않는다.
import { labelProps } from '../../domain/labels';
import type { Changes } from '../../data/repo/ops';
import type { LabelTree } from '../../data/select';
import type { Editable, ItemProps, YMD } from '../../data/types';
import type { ItemDoc } from './eventOps';

export type AttrKey = keyof Required<ItemProps>;
export const ATTR_KEYS: readonly AttrKey[] = ['calendar', 'forward', 'skip', 'gcal'];
export type Attrs = Record<AttrKey, boolean>;

export interface EventForm {
  text: string;
  labelIds: string[];
  /** 이 일정만 정한 속성 (라벨이 정한 값과 다를 수도 같을 수도 - 저장할 때 다른 것만 남긴다) */
  props: ItemProps;
  /** 알림 'HH:mm' ('' = 없음) */
  time: string;
  /** 기한 'YYYY-MM-DD' ('' = 없음) */
  due: string;
  date: YMD;
}

/** 붙은 라벨이 정한 속성 (모르는·지운 라벨은 빼고) */
export function labelAttrs(labelIds: readonly string[], tree: LabelTree): Attrs {
  const defs = labelIds.map((id) => tree.byId.get(id)).filter((l) => !!l);
  const any = (k: AttrKey) => defs.some((l) => labelProps(l.props)[k]);
  return { calendar: defs.length === 0 ? true : any('calendar'), forward: any('forward'), skip: any('skip'), gcal: any('gcal') };
}

/** 칸에 보이는 속성 = 이 일정만 정한 것 → 없으면 라벨 */
export function effectiveAttrs(form: Pick<EventForm, 'labelIds' | 'props'>, tree: LabelTree): Attrs {
  const fromLabels = labelAttrs(form.labelIds, tree);
  const out = { ...fromLabels };
  for (const k of ATTR_KEYS) if (typeof form.props[k] === 'boolean') out[k] = form.props[k]!;
  return out;
}

/** 적을 props: 라벨이 정한 값과 다른 것만 (모두 같으면 undefined) */
export function propsToStore(form: Pick<EventForm, 'labelIds' | 'props'>, tree: LabelTree): ItemProps | undefined {
  const fromLabels = labelAttrs(form.labelIds, tree);
  const eff = effectiveAttrs(form, tree);
  const out: ItemProps = {};
  for (const k of ATTR_KEYS) if (eff[k] !== fromLabels[k]) out[k] = eff[k];
  return Object.keys(out).length ? out : undefined;
}

/** 속성 하나 켜고 끄기 */
export function withAttr(form: EventForm, key: AttrKey, on: boolean): EventForm {
  return { ...form, props: { ...form.props, [key]: on } };
}

/** 라벨을 바꾸면 따로 정한 속성은 걷는다 (새 라벨 속성을 따라 켜진다 - V4) */
export function withLabels(form: EventForm, labelIds: string[]): EventForm {
  return { ...form, labelIds, props: {} };
}

/** 새 일정 칸 = 라벨 관리의 맨 위 라벨을 미리 골라 둔다 (안 고른 채 저장되면 어느 갈래에도 걸리지 않는다 - V4) */
export function newForm(date: YMD, tree: LabelTree, draftText = ''): EventForm {
  return { text: draftText, labelIds: tree.defaultId ? [tree.defaultId] : [], props: {}, time: '', due: '', date };
}

/** 저장된 일정 → 칸 */
export function formOf(item: ItemDoc): EventForm {
  return {
    text: item.text ?? '',
    labelIds: [...(item.labelIds ?? [])],
    props: { ...(item.props ?? {}) },
    time: item.time ?? '',
    due: item.due ?? '',
    date: item.date ?? '',
  };
}

const keyOf = (f: EventForm, tree: LabelTree) =>
  JSON.stringify([f.text.trim(), f.labelIds, propsToStore(f, tree) ?? null, f.time, f.due, f.date]);

/** 저장할 것이 같은가 (칸을 손댔나 - ESC 묻기·배경 누르기 저장) */
export function sameForm(a: EventForm, b: EventForm, tree: LabelTree): boolean {
  return keyOf(a, tree) === keyOf(b, tree);
}

/** 새 일정 문서 */
export function createData(form: EventForm, tree: LabelTree, order: string): Editable<'items'> {
  const props = propsToStore(form, tree);
  return {
    kind: 'event',
    date: form.date,
    text: form.text.trim(),
    labelIds: form.labelIds,
    order,
    ...(props ? { props } : {}),
    ...(form.time ? { time: form.time } : {}),
    ...(form.due ? { due: form.due } : {}),
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 고친 일정 → 바뀐 칸만. 바뀐 것이 없으면 빈 객체 */
export function editChanges(item: ItemDoc, form: EventForm, tree: LabelTree): Changes<'items'> {
  const out: Changes<'items'> = {};
  const text = form.text.trim();
  if (text !== item.text) out.text = text;
  if (!sameJson(form.labelIds, item.labelIds ?? [])) out.labelIds = form.labelIds;
  // 저장된 props도 라벨과 견줘 다듬은 뒤 견준다 - 손대지 않았으면 쓰지 않는다
  const nextProps = propsToStore(form, tree);
  if (!sameJson(nextProps, propsToStore({ labelIds: item.labelIds ?? [], props: item.props ?? {} }, tree))) out.props = nextProps;
  if (form.time !== (item.time ?? '')) {
    out.time = form.time || undefined;
    // 시각을 새로 정하면 다시 울린다
    if (item.alarmDone) out.alarmDone = undefined;
  }
  if (form.due !== (item.due ?? '')) out.due = form.due || undefined;
  if (form.date && form.date !== item.date) {
    out.date = form.date;
    // 다른 날로 옮기면 알림도 그날 다시 울린다
    if (item.alarmDone && item.time) out.alarmDone = undefined;
  }
  return out;
}

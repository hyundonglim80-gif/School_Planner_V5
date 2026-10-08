// 라벨 쓰기 (DESIGN 4-3). 라벨 관리 창·쓰는 칸('+ 새 라벨')이 이것으로 라벨을 만들고 고친다 - 저장 도우미(repo)를 거친다.
//
// - 라벨 하나 = 문서 하나. 이름·색·상위·속성·차례를 바꾸면 **그 라벨 문서의 바뀐 칸만** 고친다
//   (V4는 라벨 목록 문서 하나를 통째로 다시 쓰고, 이름을 바꾸면 그 라벨이 붙은 항목을 모두 돌며 고쳐 썼다 - 항목은 id로 가리키므로 그럴 일이 없다).
// - 차례는 옮긴 라벨만 새 값(domain/order rekeyOrders). 새 라벨은 그 종류의 맨 뒤.
// - 지우기 = 지운 표시(휴지통에서 되살린다). 지운 상위의 하위는 고쳐 쓰지 않는다 - 맨 위 단계로 보이다가 상위를 되살리면 돌아온다(domain/labelTree).
// - 이름은 같은 종류 안에서 겹치지 않게 저장 때 본다(labelNameProblem).
// 쓰기 묶음(WriteOp)을 짓는 부분은 순수 함수라 서버 없이 시험한다. 적기·안내·되돌리기는 아래 save… 함수.
import { cleanLabelName, DEFAULT_LABELS, labelProps } from '../domain/labels';
import { isOrderKey, orderBetween, ordersBetween, rekeyOrders } from '../domain/order';
import { batch, newPath, writeOp, type Changes, type WriteOp } from './repo';
import { recordUndo } from './undo';
import type { Editable, ItemKind, LabelProps, Stored } from './types';

type LabelDoc = Stored<'labels'>;

/** 라벨 관리 창이 들고 고치는 한 줄 */
export interface LabelDraft {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  props?: LabelProps;
}

/** 새 라벨에 적는 것 */
export interface NewLabel {
  name: string;
  color: string;
  parentId?: string | null;
  props?: LabelProps;
}

/** 이름 검사 - 빈 이름, 같은 종류 안에서 겹치는 이름. 문제가 없으면 null */
export function labelNameProblem(labels: ReadonlyArray<{ name: string }>): string | null {
  const seen = new Set<string>();
  for (const l of labels) {
    const name = cleanLabelName(l.name);
    if (!name) return '이름이 빈 라벨이 있습니다. 이름을 적거나 지워 주세요.';
    if (seen.has(name)) return `'${name}' 라벨이 둘 있습니다. 이름을 다르게 해 주세요.`;
    seen.add(name);
  }
  return null;
}

/** 그 종류에서 가장 뒤 차례 값 (틀린 값은 건너뛴다) */
function lastOrder(live: readonly LabelDoc[]): string | null {
  let last: string | null = null;
  for (const l of live) if (isOrderKey(l.order) && (last === null || l.order > last)) last = l.order;
  return last;
}

function newLabelData(kind: ItemKind, fields: NewLabel, order: string): Editable<'labels'> {
  const data: Editable<'labels'> = {
    kind,
    name: cleanLabelName(fields.name),
    color: fields.color,
    // 상위/하위는 메모·기록 라벨만 (DESIGN 4-3)
    parentId: kind === 'note' ? (fields.parentId ?? null) : null,
    order,
  };
  // 속성은 일정 라벨만 - 모두 채워 적는다(읽는 쪽은 labelProps로 같게 읽는다)
  if (kind === 'event') data.props = labelProps(fields.props);
  return data;
}

/** 새 라벨 하나 (그 종류의 맨 뒤). live = 그 공간·그 종류의 살아 있는 라벨 */
export function createLabelOp(sid: string, kind: ItemKind, fields: NewLabel, live: readonly LabelDoc[]): { op: WriteOp; id: string } {
  const at = newPath(sid, 'labels');
  return { op: writeOp.create(at, newLabelData(kind, fields, orderBetween(lastOrder(live), null))), id: at.id };
}

/** 기본 라벨 (그 종류에 라벨이 하나도 없을 때 - domain/labels DEFAULT_LABELS, id를 정해 두었다) */
export function defaultLabelOps(sid: string, kind: ItemKind): WriteOp[] {
  const list = DEFAULT_LABELS[kind];
  const keys = ordersBetween(null, null, list.length);
  return list.map((d, i) =>
    writeOp.create({ sid, coll: 'labels', id: d.id }, newLabelData(kind, { name: d.name, color: d.color, props: d.props }, keys[i])),
  );
}

const sameProps = (a: LabelProps | undefined, b: LabelProps | undefined) => {
  const x = labelProps(a);
  const y = labelProps(b);
  return (Object.keys(x) as (keyof LabelProps)[]).every((k) => x[k] === y[k]);
};

/**
 * 라벨 관리 창의 저장 → 쓰기 묶음. 바뀐 칸만 고치고(라벨마다 patch 하나), 지운 것은 지운 표시, 차례는 옮긴 것만 새 값.
 *   live    = 그 종류의 살아 있는 라벨 (지금 사본)
 *   next    = 창에서 고친 줄 (보이는 차례대로 - 상위/하위면 평평하게 늘어놓은 차례, 지운 것은 빼고)
 *   removed = 창에서 지운 라벨 id
 */
export function labelSaveOps(
  sid: string,
  kind: ItemKind,
  live: readonly LabelDoc[],
  next: readonly LabelDraft[],
  removed: readonly string[],
): WriteOp[] {
  const byId = new Map(live.map((l) => [l.id, l]));
  const rows = next.filter((d) => byId.has(d.id));
  const keys = rekeyOrders(rows.map((d) => byId.get(d.id)!.order));
  const ops: WriteOp[] = [];
  rows.forEach((d, i) => {
    const before = byId.get(d.id)!;
    const changes: Changes<'labels'> = {};
    const name = cleanLabelName(d.name);
    if (name !== before.name) changes.name = name;
    if (d.color !== before.color) changes.color = d.color;
    if (kind === 'note' && (d.parentId ?? null) !== (before.parentId ?? null)) changes.parentId = d.parentId ?? null;
    if (kind === 'event' && !sameProps(d.props, before.props)) changes.props = labelProps(d.props);
    if (keys[i] !== before.order) changes.order = keys[i];
    if (Object.keys(changes).length > 0) ops.push(writeOp.patch({ sid, coll: 'labels', id: d.id }, changes, before));
  });
  for (const id of removed) {
    if (byId.has(id)) ops.push(writeOp.remove({ sid, coll: 'labels', id }));
  }
  return ops;
}

// ─────────────── 적기 (안내·되돌리기) ───────────────

/** 새 라벨을 만들고 안내(되돌리기 = 지운 표시). 새 id를 돌려준다. 실패는 안내하고 던진다 */
export async function addLabel(sid: string, kind: ItemKind, fields: NewLabel, live: readonly LabelDoc[]): Promise<string> {
  const { op, id } = createLabelOp(sid, kind, fields, live);
  const undo = await batch([op]);
  recordUndo(sid, `🏷️ '${cleanLabelName(fields.name)}' 라벨을 더했습니다.`, undo, { what: '라벨 더하기' });
  return id;
}

/** 라벨 관리 창의 저장. 바뀐 것이 없으면 쓰지 않는다. 실패는 안내하고 던진다 */
export async function saveLabels(sid: string, ops: WriteOp[], message = '🏷️ 라벨을 저장했습니다.'): Promise<void> {
  if (ops.length === 0) return;
  const undo = await batch(ops);
  recordUndo(sid, message, undo, { what: '라벨 저장' });
}

export async function addDefaultLabels(sid: string, kind: ItemKind): Promise<void> {
  const undo = await batch(defaultLabelOps(sid, kind));
  recordUndo(sid, '🏷️ 기본 라벨을 넣었습니다.', undo, { what: '기본 라벨 넣기' });
}

/** 지운 라벨 되살리기 (라벨 관리 '삭제된 라벨 복구') */
export async function restoreLabels(sid: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const undo = await batch(ids.map((id) => writeOp.restore({ sid, coll: 'labels', id })));
  recordUndo(sid, `🏷️ 라벨 ${ids.length}개를 되살렸습니다.`, undo, { what: '라벨 되살리기' });
}

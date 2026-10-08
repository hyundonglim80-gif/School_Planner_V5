// 작년 이맘때 - 골라서 올해로 가져오기 (V4 lib/lastYearImport.ts를 V5 자료로, 순수).
// 작년 같은 주 같은 요일의 일정·기록을 올해 그 요일에 **새 항목으로 복사**한다(작년 것은 그대로).
//   - 일정: 글·라벨·속성(달력·이월·수업X)만. 완료는 풀고 알림·링크·첨부·기한·기간/반복 묶음은 가져오지 않는다
//     (작년 날짜를 가리키거나 엉뚱한 때 울리거나 작년 묶음과 함께 지워진다. 첨부는 같은 드라이브 파일을 두 항목이 가리키게 된다).
//   - 기록: 글·라벨·표만. 첨부만 있는 기록은 고를 수 없다.
//   - 올해 그날에 같은 글(같은 종류)이 이미 있으면 건너뛴다 - 두 번 눌러도 두 벌이 되지 않게.
// 새 항목은 그날 목록의 맨 뒤. 쓰기는 한 묶음(되돌리기 = 만든 것만 지운 표시).
import { orderBetween } from '../../domain/order';
import { newId } from '../../data/id';
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { Docs } from '../../data/select';
import { itemsOn } from '../../data/select';
import type { Editable, YMD } from '../../data/types';
import { itemPath, type ItemDoc } from '../events/eventOps';

export interface LastYearPick {
  /** 작년 항목 */
  item: ItemDoc;
  /** 올해 같은 요일 */
  toDate: YMD;
}

export const pickKeyOf = (p: { item: { id: string }; toDate: string }) => `${p.item.id}|${p.toDate}`;

/** 본문 비교 (앞뒤 공백만 뺀다 - 본문은 바꾸지 않는다) */
const sameText = (a: string | undefined, b: string | undefined) => (a ?? '').trim() === (b ?? '').trim();

/** 고를 수 있는 기록인가 (글이나 표가 있어야 - 첨부만 있는 기록은 안 된다) */
export const isImportableNote = (item: Pick<ItemDoc, 'text' | 'tables'>) => !!item.text?.trim() || (item.tables?.length ?? 0) > 0;

/** 올해 그날에 같은 글의 같은 종류가 있나 */
export function existsThisYear(items: Docs<'items'>, item: Pick<ItemDoc, 'kind' | 'text'>, toDate: YMD): boolean {
  return itemsOn(items, toDate, item.kind).some((d) => sameText(d.text, item.text));
}

/** 복사본 (그날 맨 뒤 차례) */
export function copyForThisYear(item: ItemDoc, toDate: YMD, order: string): Editable<'items'> {
  if (item.kind === 'event') {
    return {
      kind: 'event',
      date: toDate,
      text: item.text,
      labelIds: [...(item.labelIds ?? [])],
      order,
      ...(item.props && Object.keys(item.props).length ? { props: { ...item.props } } : {}),
    };
  }
  return {
    kind: 'note',
    date: toDate,
    text: item.text,
    labelIds: [...(item.labelIds ?? [])],
    order,
    ...(item.tables?.length ? { tables: JSON.parse(JSON.stringify(item.tables)) } : {}),
  };
}

export interface ImportPlan {
  ops: WriteOp[];
  /** 만든 수 (일정·기록) */
  events: number;
  notes: number;
  /** 올해 같은 글이 있어(또는 고른 것끼리 같아) 건너뛴 수 */
  skipped: number;
}

/** 고른 것 → 쓰기. 같은 날 같은 글은 하나만 */
export function lastYearImportPlan(sid: string, items: Docs<'items'>, picks: readonly LastYearPick[], makeId: () => string = newId): ImportPlan {
  const plan: ImportPlan = { ops: [], events: 0, notes: 0, skipped: 0 };
  const lastOrder = new Map<string, string | null>();
  const seen = new Set<string>();
  for (const { item, toDate } of picks) {
    if (item.kind === 'note' && !isImportableNote(item)) continue;
    const key = `${item.kind}|${toDate}|${(item.text ?? '').trim()}`;
    if (seen.has(key) || existsThisYear(items, item, toDate)) {
      plan.skipped += 1;
      continue;
    }
    seen.add(key);
    const k = `${item.kind}|${toDate}`;
    if (!lastOrder.has(k)) {
      let last: string | null = null;
      for (const d of itemsOn(items, toDate, item.kind)) if (d.order && (last === null || d.order > last)) last = d.order;
      lastOrder.set(k, last);
    }
    const order = orderBetween(lastOrder.get(k) ?? null, null);
    lastOrder.set(k, order);
    plan.ops.push(writeOp.create(itemPath(sid, makeId()), copyForThisYear(item, toDate, order)));
    if (item.kind === 'event') plan.events += 1;
    else plan.notes += 1;
  }
  return plan;
}

/** 안내 글 (V4 importedMessage) */
export function importedMessage(p: Pick<ImportPlan, 'events' | 'notes' | 'skipped'>): string {
  const parts = [p.events ? `일정 ${p.events}개` : '', p.notes ? `기록 ${p.notes}개` : ''].filter(Boolean).join(' · ');
  const head = parts ? `📥 작년 ${parts}를 올해로 가져왔습니다.` : '가져올 것이 없습니다.';
  return p.skipped > 0 ? `${head} 그날 같은 글이 있어 ${p.skipped}개는 건너뛰었습니다.` : head;
}

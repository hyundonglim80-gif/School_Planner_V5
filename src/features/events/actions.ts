// 일정 쓰기 (하루·주간·월간·년간이 함께 쓴다). 저장 도우미(data/repo)로 적고 되돌리기를 남긴다(data/undo).
// 실패는 저장 도우미가 안내하고 던진다 - 누른 단추에서 부르면 `.catch(() => {})`로 받는다(안내는 이미 나갔다).
// 쓰기마다 문서 하나(원칙 1).
import { showToast } from '../../app/toast';
import { shortDateLabel, todayStr } from '../../domain/dateUtils';
import { ordersBetween } from '../../domain/order';
import { cutFromChanges, isPeriod, periodDoneChanges, skipDayChanges } from '../../domain/period';
import { ruleLabel, type SeriesRuleShape } from '../../domain/recur';
import { batch, create, newPath, patch, remove, writeOp, type Changes, type WriteOp } from '../../data/repo';
import type { LabelTree } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { createData, editChanges, effectiveAttrs, type EventForm } from './eventForm';
import { carriedDoneChanges, doneChanges, itemPath, reorderOps, type ItemDoc } from './eventOps';
import type { GroupScope } from './EventScopeWindow';
import { closeEventPanelsFor } from './open';
import { createSeriesOps, deleteSeriesOps, editSeriesOps, planDates, scopeItems, type SeriesDoc } from './seriesOps';
import { multiDeleteOps, multiDoneOps, multiLabelOps, multiMoveOps, pickedCount, type MoveResult, type Picked } from './multiOps';

const KEEP = '적은 내용은 칸에 남아 있습니다.';
/** 옮기기의 되돌리기가 함께 되돌리는 자리 칸 (date 말고) */
const PLACE_KEYS = ['endDate', 'skipDates', 'doneDates'] as const;

export interface DoneOptions {
  /** 오늘 칸에서 따라오던 일정을 끝낼 때 - 그날로 옮겨 적는다(eventOps carriedDoneChanges, 되돌리면 제자리로) */
  carried?: { today: string; order: string };
  /** 기간 일정은 그날만 (doneDates - domain/period) */
  day?: string;
}

/** 완료 / 완료 풀기 (☐·라벨 칩). 안내 없이 Ctrl+Z 더미에만 - V4도 안내를 띄우지 않았다. */
export async function setEventDone(sid: string, item: ItemDoc, done: boolean, opts: DoneOptions = {}): Promise<void> {
  const changes = (
    opts.day && isPeriod(item)
      ? periodDoneChanges(item, opts.day, done)
      : done && opts.carried
        ? carriedDoneChanges(item, opts.carried.today, opts.carried.order)
        : doneChanges(done)
  ) as Changes<'items'>;
  const undo = await patch(itemPath(sid, item.id), changes, item, {
    fail: done ? '일정을 완료하지 못했습니다.' : '일정 완료를 풀지 못했습니다.',
  });
  recordUndo(sid, '', undo, { what: done ? '일정 완료' : '일정 완료 풀기', quiet: true });
}

/** 보이는 목록에서 한 칸 옮기기 (▲▼). 옮긴 것의 order만 */
export async function moveEventInList(sid: string, list: readonly ItemDoc[], from: number, to: number): Promise<void> {
  const ops = reorderOps(sid, list, from, to);
  if (ops.length === 0) return;
  const undo = await batch(ops, { fail: '일정 순서를 바꾸지 못했습니다.' });
  recordUndo(sid, '', undo, { what: '일정 순서 바꾸기', quiet: true });
}

/** 새 일정 (그날 목록의 맨 뒤 - order는 부르는 쪽이). 만든 id */
export async function createEvent(sid: string, form: EventForm, tree: LabelTree, order: string): Promise<string> {
  const at = newPath(sid, 'items');
  const undo = await create(at, createData(form, tree, order), { fail: `일정을 저장하지 못했습니다. ${KEEP}` });
  recordUndo(sid, '✅ 일정을 추가했습니다.', undo, { what: '일정 추가' });
  return at.id;
}

/**
 * 고친 일정 저장 = 바뀐 칸만. 날짜를 바꿨으면 옮기기 - 안내의 되돌리기는 **날짜만** 원래대로(함께 고친 내용은 그대로 - V4).
 * 바뀐 것이 없으면 false (쓰지 않는다).
 */
export async function saveEvent(sid: string, item: ItemDoc, form: EventForm, tree: LabelTree): Promise<boolean> {
  const changes = editChanges(item, form, tree);
  if (Object.keys(changes).length === 0) return false;
  const at = itemPath(sid, item.id);
  const to = changes.date;
  const undo = await patch(at, changes, item, { fail: `${to ? '일정을 옮기지 못했습니다.' : '일정을 저장하지 못했습니다.'} ${KEEP}` });
  if (to && item.date) {
    // 끝내지 않은 이월 일정을 지난 날에 두면 오늘 칸에 따라온다 - 미리 알린다 (V4 movesForwardIntoPast)
    const bounce = !item.done && to < todayStr() && effectiveAttrs(form, tree).forward ? ' 이월 일정이라 끝내지 않으면 오늘 칸에 따라옵니다.' : '';
    // 되돌리기는 자리만 - 기간이면 끝 날·뺀 날·끝낸 날도 함께 (같이 고친 글·라벨은 그대로)
    const back: Changes<'items'> = { date: item.date };
    const fwd: Changes<'items'> = { date: to };
    for (const k of PLACE_KEYS) {
      if (Object.hasOwn(changes, k)) {
        (back as Record<string, unknown>)[k] = item[k];
        (fwd as Record<string, unknown>)[k] = changes[k];
      }
    }
    const span = item.endDate && changes.endDate ? `~${shortDateLabel(changes.endDate)}` : '';
    recordUndo(sid, `📅 일정을 ${shortDateLabel(item.date)} → ${shortDateLabel(to)}${span}로 옮겼습니다.${bounce}`, [writeOp.patch(at, back, fwd)], {
      what: '일정 옮기기',
    });
  } else {
    recordUndo(sid, '✅ 일정을 저장했습니다.', undo, { what: '일정 고치기' });
  }
  return true;
}

/** 알림 시각 바꾸기·끄기 (하루 카드의 ⏰ - 누르는 즉시 저장). '' = 끄기 */
export async function setEventAlarm(sid: string, item: ItemDoc, time: string): Promise<void> {
  const undo = await patch(
    itemPath(sid, item.id),
    { time: time || undefined, ...(item.alarmDone ? { alarmDone: undefined } : {}) },
    item,
    { fail: time ? '알림을 저장하지 못했습니다.' : '알림을 끄지 못했습니다.' },
  );
  recordUndo(sid, '', undo, { what: time ? '알림 바꾸기' : '알림 끄기', quiet: true });
}

/**
 * 지우기 = 지운 표시(원칙 5 - 휴지통에서 되살린다). 확인 창 없이 곧바로, 안내의 되돌리기·Ctrl+Z로 그 자리에 돌아온다(V4 그대로).
 * 그 일정을 고치던 칸은 닫는다(없는 일정을 붙들고 있지 않게). 못 지웠으면 던진다 - 칸은 닫지 않는다.
 * 기간·반복 묶음은 먼저 어디까지 지울지 묻는다(EventDeleteChooser) - 기간의 '전부'가 이것이다.
 */
export async function deleteEvent(sid: string, item: ItemDoc): Promise<void> {
  const undo = await remove(itemPath(sid, item.id), { fail: '일정을 지우지 못했습니다.' });
  closeEventPanelsFor(sid, item.id);
  recordUndo(sid, '🗑️ 일정을 삭제했습니다. 휴지통에서 복원할 수 있습니다.', undo, { what: '일정 지우기' });
}

/**
 * 지난 일정을 오늘로 (하루 화면 '📥 지난 일정' 줄 - V4 '오늘로 전달'). 고른 것마다 date = 오늘·order = 오늘 줄 맨 뒤부터 차례로(한 묶음).
 * 알림이 울렸던 일정은 오늘 다시 울린다(날짜를 옮기면 - P3-1). 안내의 되돌리기·Ctrl+Z = 모두 제 날짜로.
 */
export async function bringEventsToToday(sid: string, list: readonly ItemDoc[], today: string, lastOrder: string | null): Promise<void> {
  if (list.length === 0) return;
  const orders = ordersBetween(lastOrder, null, list.length);
  const ops: WriteOp[] = list.map((d, i) =>
    writeOp.patch(itemPath(sid, d.id), { date: today, order: orders[i], ...(d.alarmDone && d.time ? { alarmDone: undefined } : {}) }, d),
  );
  const undo = await batch(ops, { fail: '지난 일정을 오늘로 가져오지 못했습니다.' });
  recordUndo(sid, `📥 지난 일정 ${list.length}개를 오늘로 가져왔습니다.`, undo, { what: '지난 일정 가져오기' });
}

/**
 * 기간 일정의 '이 날만'(그날 빼기 - skipDates) · '이 날부터'(끝 날 당기기). 문서 하나, 안내의 되돌리기·Ctrl+Z.
 * 남는 날이 없으면 일정을 지운다(deleteEvent).
 */
export async function deletePeriodPart(sid: string, item: ItemDoc, day: string, scope: 'only' | 'after'): Promise<void> {
  const changes = scope === 'only' ? skipDayChanges(item, day) : cutFromChanges(item, day);
  if (!changes) return deleteEvent(sid, item);
  const undo = await patch(itemPath(sid, item.id), changes as Changes<'items'>, item, { fail: '일정을 지우지 못했습니다.' });
  recordUndo(
    sid,
    scope === 'only' ? `🗑️ ${shortDateLabel(day)} 하루를 기간에서 뺐습니다.` : `🗑️ ${shortDateLabel(day)}부터 뒤쪽 기간을 지웠습니다.`,
    undo,
    { what: '기간 일정 지우기' },
  );
}

// ─────────────── 반복 (DESIGN 4-4 - features/events/seriesOps) ───────────────

/**
 * 반복 일정 만들기: series 하나 + 날마다 항목을 한 묶음으로. 안내의 되돌리기·Ctrl+Z = 모두 지운 표시. 만든 첫 항목 id와 수.
 * 날짜가 없으면(규칙에 맞는 날이 없다) 쓰지 않고 null.
 */
export async function createSeriesEvents(
  sid: string,
  form: EventForm,
  tree: LabelTree,
  recur: { rule: SeriesRuleShape; until: string },
  orderOn: (date: string) => string,
): Promise<{ firstId: string; firstDate: string; count: number } | null> {
  const plan = { rule: recur.rule, start: form.date, until: recur.until };
  const dates = planDates(plan);
  if (dates.length === 0) return null;
  const itemIds = dates.map(() => newPath(sid, 'items').id);
  const data = createData({ ...form, endDate: '', skipDates: [] }, tree, '');
  const ops = createSeriesOps(sid, { ...plan, data, orderOn, seriesId: newPath(sid, 'series').id, itemIds });
  const undo = await batch(ops, { fail: `반복 일정을 저장하지 못했습니다. ${KEEP}` });
  recordUndo(sid, `🔁 반복 일정 ${dates.length}개를 만들었습니다 (${ruleLabel(recur.rule)}).`, undo, { what: '반복 일정 만들기' });
  return { firstId: itemIds[0], firstDate: dates[0], count: dates.length };
}

/**
 * 반복 묶음 고치기 (이 날부터·전부 - 이 날만은 saveEvent). 바꾼 칸만 고른 항목들에, 날짜를 옮겼으면 같은 날 수만큼.
 * 바뀐 것이 없으면 false.
 */
export async function saveSeriesEvents(
  sid: string,
  item: ItemDoc,
  form: EventForm,
  tree: LabelTree,
  scope: 'after' | 'all',
  list: readonly ItemDoc[],
  series: SeriesDoc | undefined,
): Promise<boolean> {
  const changes = editChanges(item, form, tree);
  if (Object.keys(changes).length === 0) return false;
  const targets = scopeItems(list, item, scope);
  const ops = editSeriesOps(sid, item, changes, targets, series, true);
  if (ops.length === 0) return false;
  const undo = await batch(ops, { fail: `반복 일정을 저장하지 못했습니다. ${KEEP}` });
  const n = targets.length;
  recordUndo(sid, changes.date ? `📅 반복 일정 ${n}개를 옮겼습니다.` : `✅ 반복 일정 ${n}개를 고쳤습니다.`, undo, { what: '반복 일정 고치기' });
  return true;
}

/** 반복 묶음 지우기 - 이 날만·이 날부터(series.until도 당긴다)·전부(series도). 안내의 되돌리기·Ctrl+Z */
export async function deleteSeriesEvents(
  sid: string,
  item: ItemDoc,
  scope: GroupScope,
  list: readonly ItemDoc[],
  series: SeriesDoc | undefined,
): Promise<void> {
  if (scope === 'only') return deleteEvent(sid, item);
  const ops = deleteSeriesOps(sid, item, list, series, scope);
  const undo = await batch(ops, { fail: '반복 일정을 지우지 못했습니다.' });
  const removed = scopeItems(list, item, scope);
  for (const d of removed) closeEventPanelsFor(sid, d.id);
  recordUndo(sid, `🗑️ 반복 일정 ${removed.length}개를 삭제했습니다. 휴지통에서 복원할 수 있습니다.`, undo, { what: '반복 일정 지우기' });
}

// ─────────────── 여러 개 고르기 (features/events/multiOps - 모두 한 묶음, 안내의 되돌리기 하나) ───────────────

/** 고른 일정 모두 완료 (이미 끝낸 것은 그대로). 바꾼 수 */
export async function completePicked(sid: string, list: readonly Picked[], opts: Parameters<typeof multiDoneOps>[2]): Promise<number> {
  const ops = multiDoneOps(sid, list, opts);
  if (ops.length === 0) return 0;
  const undo = await batch(ops, { fail: '일정을 완료하지 못했습니다.' });
  recordUndo(sid, `✅ 일정 ${ops.length}건을 완료로 표시했습니다.`, undo, { what: '여러 일정 완료' });
  return ops.length;
}

/** 고른 일정의 라벨을 하나로 바꾸거나(null = 떼기) */
export async function relabelPicked(sid: string, list: readonly Picked[], labelId: string | null, labelName: string): Promise<number> {
  const ops = multiLabelOps(sid, list, labelId);
  if (ops.length === 0) return 0;
  const undo = await batch(ops, { fail: '라벨을 바꾸지 못했습니다.' });
  recordUndo(sid, labelId ? `🏷️ 일정 ${ops.length}건의 라벨을 '${labelName}'(으)로 바꿨습니다.` : `🏷️ 일정 ${ops.length}건의 라벨을 뗐습니다.`, undo, {
    what: '여러 일정 라벨',
  });
  return ops.length;
}

/** 고른 일정을 모두 한 날로. orders = 그 날 맨 뒤부터 쓸 차례 값 */
export async function movePicked(sid: string, list: readonly Picked[], to: string, lastOrder: string | null, bounce: boolean): Promise<MoveResult> {
  const r = multiMoveOps(sid, list, to, ordersBetween(lastOrder, null, Math.max(1, pickedCount(list))), () => newPath(sid, 'items').id);
  if (r.ops.length === 0) {
    showToast(r.same > 0 ? `옮긴 일정이 없습니다. ${r.same}건은 이미 그 날입니다.` : '옮긴 일정이 없습니다.');
    return r;
  }
  const undo = await batch(r.ops, { fail: '일정을 옮기지 못했습니다. 고른 것은 그대로 두었습니다.' });
  recordUndo(
    sid,
    `📅 일정 ${r.moved}건을 ${shortDateLabel(to)}로 옮겼습니다.` +
      (r.same > 0 ? ` ${r.same}건은 이미 그 날입니다.` : '') +
      (bounce ? ' 이월 일정은 끝내지 않으면 오늘 칸에 따라옵니다.' : ''),
    undo,
    { what: '여러 일정 옮기기' },
  );
  return r;
}

/** 고른 일정 지우기 (기간은 고른 날만) */
export async function deletePicked(sid: string, list: readonly Picked[]): Promise<number> {
  const ops = multiDeleteOps(sid, list);
  if (ops.length === 0) return 0;
  const undo = await batch(ops, { fail: '일정을 지우지 못했습니다.' });
  for (const { item } of list) if (!isPeriod(item)) closeEventPanelsFor(sid, item.id);
  const n = pickedCount(list);
  recordUndo(sid, `🗑️ 일정 ${n}건을 삭제했습니다. 휴지통에서 복원할 수 있습니다.`, undo, { what: '여러 일정 지우기' });
  return n;
}

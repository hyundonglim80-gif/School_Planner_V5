// 구글 캘린더 자동 보내기 (V4 lib/gcalAuto.ts - 일정 라벨 속성 '구글 캘린더', P8-1). 셈은 domain/gcal, 큐는 data/gcalQueue, API는 data/google/calendar.
//
// 흐름: 일정을 쓰면(저장 도우미 observeWrites) → 그 항목이 쓰기 전이나 뒤에 '구글 캘린더'였으면 큐 gcalQueue/{itemId}에 (1.2초 모았다가)
//   → 조용한 토큰이 있으면 곧바로 보낸다. 보낼 때 항목을 **서버에서 다시 읽어** 구글의 그 항목 것과 맞춘다(무엇을 바꿨는지 들고 다니지 않는다 -
//   완료·옮기기·기간·여러 개 고르기·끌어 옮기기·지우기·되살리기가 따로 처리 없이 맞는다).
// 이월 중인 일정은 오늘로 보낸다 - 날이 바뀌면(앱을 열 때·자정) 이월 중인 '구글 캘린더' 일정을 큐에 넣는다(이 기기에서 하루 한 번).
// 라벨 관리에서 라벨의 '구글 캘린더'를 끄면 구글에 자동으로 보낸 것을 모두 큐에 넣어 맞춘다(끈 것은 지운다 - V4 2026-10-07 사용자 요청).
// 토큰이 없으면(로그인 만료) 큐에 남고 머리줄 '📅 못 보낸 일정 N' - 누르면 로그인 창을 열고 보낸다(누른 때라 막히지 않는다).
// 가져오기가 쓴 것(src를 적는 쓰기)은 큐에 넣지 않는다 - V4가 이미 보냈고, 수백 개를 한꺼번에 맞추지 않게.
// 개인 공간 일정만(V4 1차와 같다). 클라우드 컨테이너는 googleapis에 닿지 못해 점검은 fetch를 흉내 낸다.
import { useEffect } from 'react';
import { create } from 'zustand';
import { useCommonSettings } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import { todayStr } from '../../domain/dateUtils';
import { carriedOf, isCarried } from '../../domain/forward';
import { APP_TAG, CALENDAR_NAME, gcalOn, itemPayloads, planItemSync, planSize, spIdOf, type GcalItem, type GoogleEvent } from '../../domain/gcal';
import { labelProps } from '../../domain/labels';
import { isPeriod, periodDays, periodDoneOn, periodPosition } from '../../domain/period';
import { dropGcalQueue, markGcalFail, queueGcalItems, readItemFromServer, watchGcalQueue, type GcalQueueEntry } from '../../data/gcalQueue';
import { deleteCalendarEvent, getOrCreateCalendarByName, insertCalendarEvent, listCalendarEvents, updateCalendarEvent } from '../../data/google/calendar';
import { forgetGoogleToken, getGoogleTokenQuietly, getValidGoogleToken, GoogleApiError } from '../../data/google/token';
import { isHoliday } from '../../data/holidays';
import { observeWrites, type WriteOp } from '../../data/repo';
import { docsNow, itemLabels, itemsOfKind, itemsOn, labelTreeOf, useMirrorStatus, type LabelTree } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { useToday } from '../../ui/useToday';
import { labelForwardOf } from '../events/forward';

/** 일정을 쓰고 이만큼 모였다가 큐에 넣는다 (한 번에 여러 항목을 쓰는 여러 개 고르기·반복) */
const DEBOUNCE_MS = 1200;
/** 같은 항목을 이만큼 못 보내면 한 번 알린다 */
const FAIL_NOTICE = 3;
/** 이월 중인 일정을 오늘로 넣은 날 (이 기기 - 하루 한 번) */
const CARRIED_KEY = 'sp5-gcal-carried';

export const GCAL_LOGIN_REASON = "'구글 캘린더'를 켠 일정을 구글 캘린더(SP(work))에 반영하려면 구글 로그인이 필요합니다. 로그인하면 바로 보냅니다.";

/** 머리줄이 보는 것 */
export const useGcal = create<{ pending: number; flushing: boolean }>(() => ({ pending: 0, flushing: false }));

const state = {
  sid: '',
  calId: '',
  queue: [] as GcalQueueEntry[],
  pending: new Set<string>(),
  timer: null as ReturnType<typeof setTimeout> | null,
  flushing: false,
  rerun: false,
};

const setFlushing = (flushing: boolean) => {
  state.flushing = flushing;
  useGcal.setState({ flushing });
};

// ── 보낼 일정인가 (화면 store = 기기 사본으로) ──

const eventTree = (sid: string) => labelTreeOf(docsNow('labels', sid), 'event');

const labelGcalOf = (tree: LabelTree) => (ids: readonly string[]) => ids.some((id) => labelProps(tree.byId.get(id)?.props).gcal);

/** '구글 캘린더'를 켠 일정 라벨 id */
const gcalLabelIds = (tree: LabelTree) => new Set(tree.list.filter((l) => labelProps(l.props).gcal).map((l) => l.id));

const onNow = (sid: string, id: string, tree = eventTree(sid)) => gcalOn(docsNow('items', sid)[id] as GcalItem | undefined, labelGcalOf(tree));

/** 가져오기가 쓴 것 (src를 적는다) */
const fromImport = (op: WriteOp) => (op.type === 'create' && 'src' in op.data) || ((op.type === 'patch' || op.type === 'merge') && 'src' in op.changes);

/** 쓰기 지켜보기: 쓰기 전 판으로 '구글 캘린더'였나 보고, 끝나면 뒤 판으로 한 번 더 */
function watchWrite(ops: readonly WriteOp[]) {
  const sid = state.sid;
  if (!sid) return;
  const ids: string[] = [];
  let labelsTouched = false;
  for (const op of ops) {
    if (op.at.sid !== sid || fromImport(op)) continue;
    if (op.at.coll === 'items' && !ids.includes(op.at.id)) ids.push(op.at.id);
    if (op.at.coll === 'labels') labelsTouched = true;
  }
  if (ids.length === 0 && !labelsTouched) return;
  const tree = eventTree(sid);
  const before = new Set(ids.filter((id) => onNow(sid, id, tree)));
  const labelsBefore = labelsTouched ? gcalLabelIds(tree) : null;
  return (ok: boolean) => {
    if (!ok || state.sid !== sid) return;
    const after = eventTree(sid);
    const changed = ids.filter((id) => before.has(id) || onNow(sid, id, after));
    if (changed.length) enqueue(changed);
    if (labelsBefore) {
      const now = gcalLabelIds(after);
      if ([...labelsBefore].some((id) => !now.has(id))) void queueSentItems();
    }
  };
}

/** 큐에 넣기 (모았다가) */
export function enqueue(ids: readonly string[]) {
  for (const id of ids) state.pending.add(id);
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => void commitPending(), DEBOUNCE_MS);
}

async function commitPending() {
  state.timer = null;
  const sid = state.sid;
  const ids = [...state.pending];
  state.pending.clear();
  if (!sid || ids.length === 0) return;
  try {
    await queueGcalItems(sid, ids);
  } catch (e) {
    console.warn('[gcal] 보낼 일정을 큐에 적지 못했습니다.', e);
    return;
  }
  void flushGcalQueue(false);
}

/** 이월 중인 '구글 캘린더' 일정을 오늘로 (이 기기에서 하루 한 번) */
export function queueCarriedToday() {
  const sid = state.sid;
  if (!sid) return;
  const today = todayStr();
  let mark: { sid?: string; day?: string } = {};
  try {
    mark = JSON.parse(localStorage.getItem(CARRIED_KEY) ?? '{}');
  } catch {
    /* 처음 */
  }
  if (mark.sid === sid && mark.day === today) return;
  const tree = eventTree(sid);
  const events = itemsOfKind(docsNow('items', sid), 'event');
  const carried = carriedOf(events, labelForwardOf(tree), today, useCommonSettings.getState().forwardDays).filter((d) => gcalOn(d as GcalItem, labelGcalOf(tree)));
  try {
    localStorage.setItem(CARRIED_KEY, JSON.stringify({ sid, day: today }));
  } catch {
    /* 시크릿 모드 - 다음에 또 넣을 뿐 */
  }
  if (carried.length) enqueue(carried.map((d) => d.id));
}

/** 라벨의 '구글 캘린더'를 껐다 - 구글에 자동으로 보낸 것 가운데 이제 아닌 항목을 큐에 (조용한 토큰이 없으면 그만 - 그 일정을 다음에 저장할 때 맞춰진다) */
async function queueSentItems(): Promise<void> {
  const sid = state.sid;
  if (!sid) return;
  try {
    const token = await getGoogleTokenQuietly();
    if (!token) return;
    if (!state.calId) state.calId = await getOrCreateCalendarByName(token, CALENDAR_NAME.event);
    const sent = await listCalendarEvents(token, state.calId, [`app=${APP_TAG}`, 'sp_auto=true']);
    const items = docsNow('items', sid);
    const bySrc = new Map<string, string>();
    for (const d of Object.values(items)) if (d.src?.from === 'v4' && d.src.id) bySrc.set(d.src.id, d.id);
    const tree = eventTree(sid);
    const ids = new Set<string>();
    for (const ev of sent) {
      const p = ev.extendedProperties?.private ?? {};
      const id = p.sp_item || bySrc.get(p.sp_id ?? '');
      if (id && !onNow(sid, id, tree)) ids.add(id);
    }
    if (ids.size) enqueue([...ids]);
  } catch (e) {
    console.warn('[gcal] 라벨을 끈 일정을 구글 캘린더에서 지우지 못했습니다.', e);
  }
}

// ── 보내기 ──

/** 그날 차례 (그날 일정 가운데 몇째 - 구글에서 같은 날 차례를 지킨다. 그날에 없으면(이월) 끝) */
function seqOf(sid: string, id: string, date: string): number {
  const day = itemsOn(docsNow('items', sid), date, 'event');
  const k = day.findIndex((d) => d.id === id);
  return k < 0 ? day.length + 1 : k + 1;
}

/** 항목 하나를 맞춘다 - 쓴 수 */
async function syncItem(token: string, calId: string, sid: string, id: string): Promise<number> {
  const item = (await readItemFromServer(sid, id)) as (GcalItem & { carrying?: boolean; carriedFrom?: string }) | null;
  const tree = eventTree(sid);
  const on = gcalOn(item, labelGcalOf(tree));
  const today = todayStr();
  let payloads: ReturnType<typeof itemPayloads> = [];
  if (item && on) {
    const period = isPeriod({ date: item.date, endDate: item.endDate ?? '' });
    const pi = item as Parameters<typeof periodDays>[0];
    const carried = !period && isCarried(item, labelForwardOf(tree), today, useCommonSettings.getState().forwardDays);
    payloads = itemPayloads(item, {
      dates: period ? periodDays(pi, isHoliday) : [carried ? today : item.date!],
      position: period ? (d) => periodPosition(pi, d, isHoliday) : undefined,
      doneOn: (d) => periodDoneOn(pi, d),
      labelNames: itemLabels(tree, item.labelIds).map((l) => l.name),
      seqOf: (d) => seqOf(sid, id, d),
    });
  }
  const spId = item ? spIdOf(item) : id;
  const found = new Map<string, GoogleEvent>();
  const add = (list: GoogleEvent[]) => list.forEach((e) => found.set(e.id, e));
  add(await listCalendarEvents(token, calId, [`app=${APP_TAG}`, `sp_item=${id}`]));
  // 가져온 항목: V4가 보낸 것(같은 V4 id · 보낼 날의 같은 글 - 이월 사슬·기간 조각)도 찾아 이어 맡는다
  if (item?.src?.from === 'v4') {
    if (spId !== id) add(await listCalendarEvents(token, calId, [`app=${APP_TAG}`, `sp_id=${spId}`]));
    for (const p of payloads) add(await listCalendarEvents(token, calId, [`app=${APP_TAG}`, `dateStr=${p.extendedProperties.private.dateStr}`]));
  }
  const plan = planItemSync(id, spId, [...found.values()], payloads);
  for (const p of plan.post) await insertCalendarEvent(token, calId, p);
  for (const { id: gid, payload } of plan.put) await updateCalendarEvent(token, calId, gid, payload);
  for (const gid of plan.del) {
    try {
      await deleteCalendarEvent(token, calId, gid);
    } catch (e) {
      // 이미 지운 것
      if (!(e instanceof GoogleApiError && (e.status === 404 || e.status === 410))) throw e;
    }
  }
  return planSize(plan);
}

export type FlushResult = 'done' | 'no-token' | 'busy' | 'empty';

/**
 * 큐의 항목을 보낸다. interactive면 토큰이 없을 때 로그인 창을 연다(단추를 누른 때만).
 * 보낸 항목은 큐에서 뺀다 - 그새 다시 쌓였으면(at이 바뀜) 둔다. 실패는 큐에 남기고 다음에 다시.
 */
export async function flushGcalQueue(interactive: boolean): Promise<FlushResult> {
  const sid = state.sid;
  if (!sid) return 'empty';
  if (state.flushing) {
    state.rerun = true;
    return 'busy';
  }
  setFlushing(true);
  try {
    // 단추로 부르면 토큰부터 - 누른 직후라야 로그인 창이 막히지 않는다
    let token = interactive ? await getValidGoogleToken(GCAL_LOGIN_REASON) : null;
    const queued = [...state.queue];
    if (queued.length === 0) {
      if (interactive) showToast('📅 보낼 일정이 없습니다.');
      return 'empty';
    }
    token ??= await getGoogleTokenQuietly();
    if (!token) return 'no-token';
    if (!state.calId) state.calId = await getOrCreateCalendarByName(token, CALENDAR_NAME.event);
    let changed = 0;
    for (const q of queued) {
      if (state.sid !== sid) break;
      try {
        changed += await syncItem(token, state.calId, sid, q.id);
        await dropGcalQueue(sid, q.id, q.at);
      } catch (e) {
        if (e instanceof GoogleApiError && (e.status === 401 || e.status === 403)) {
          // 만료된 토큰 - 잊고 단추로 다시 받게 한다
          forgetGoogleToken();
          return 'no-token';
        }
        if (e instanceof GoogleApiError && e.status === 404) state.calId = ''; // 캘린더를 지웠다 - 다음에 다시 만든다
        const fails = q.fails + 1;
        await markGcalFail(sid, q.id, fails).catch(() => {});
        console.warn('[gcal] 구글 캘린더에 일정을 보내지 못했습니다.', q.id, e);
        if (fails === FAIL_NOTICE) showErrorToast(`구글 캘린더에 일정을 ${FAIL_NOTICE}번 보내지 못했습니다. 다음에 다시 보냅니다.`, e);
      }
    }
    if (interactive) showToast(changed > 0 ? `📅 구글 캘린더에 보냈습니다 (${changed}건 반영).` : '📅 구글 캘린더가 이미 맞습니다.');
    return 'done';
  } catch (e) {
    if (interactive) throw e;
    console.warn('[gcal] 구글 캘린더 보내기 실패', e);
    return 'done';
  } finally {
    setFlushing(false);
    if (state.rerun) {
      state.rerun = false;
      void flushGcalQueue(false);
    }
  }
}

/**
 * 일정 칸에서 '구글 캘린더' 일정을 저장한 뒤 (V4 2026-10-07 사용자 요청): 구글 로그인이 없으면 묻는다.
 * 저장 단추를 누른 직후라 로그인 창이 열리고, 막히면 '구글 로그인이 필요합니다' 창의 단추로. 닫으면 큐에 남아 '📅 못 보낸 일정 N'으로 나중에.
 */
export async function ensureGcalLogin(): Promise<void> {
  if (!state.sid) return;
  if (await getGoogleTokenQuietly()) return; // 로그인돼 있다 - 큐가 알아서 보낸다
  try {
    await getValidGoogleToken(GCAL_LOGIN_REASON);
    // 큐에 아직 안 들어갔으면(1.2초 모으는 중) 들어간 뒤 commitPending이 보낸다
    await flushGcalQueue(false);
  } catch {
    showToast('구글 로그인을 하지 않아 구글 캘린더에 아직 보내지 않았습니다. 맨 위 📅 못 보낸 일정 단추로 나중에 보냅니다.');
  }
}

/** 머리줄 단추 - 로그인 창을 열 수 있다 */
export async function sendGcalNow(): Promise<void> {
  try {
    await flushGcalQueue(true);
  } catch (e) {
    showErrorToast('구글 캘린더에 보내지 못했습니다.', e);
  }
}

/** 개인 공간 하나를 지켜본다 (끝내면 함수를 부른다) */
function startGcalAuto(sid: string): () => void {
  state.sid = sid;
  state.calId = '';
  state.queue = [];
  const offWrite = observeWrites(watchWrite);
  const offQueue = watchGcalQueue(sid, (entries) => {
    state.queue = entries;
    useGcal.setState({ pending: entries.length });
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible' && state.queue.length) void flushGcalQueue(false);
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    offWrite();
    offQueue();
    document.removeEventListener('visibilitychange', onVisible);
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.pending.clear();
    state.sid = '';
    state.queue = [];
    useGcal.setState({ pending: 0, flushing: false });
  };
}

/** Shell에 하나: 쓰기를 큐에 넣고, 앱을 열 때·날이 바뀔 때 이월 일정을 오늘로, 쌓인 것을 조용히 보낸다 */
export function useGcalAuto() {
  const sid = usePersonalSpaceId();
  const items = useMirrorStatus('items', sid);
  const labels = useMirrorStatus('labels', sid);
  const today = useToday();
  const ready = items === 'live' && labels === 'live';
  useEffect(() => (sid ? startGcalAuto(sid) : undefined), [sid]);
  useEffect(() => {
    if (!sid || !ready) return;
    queueCarriedToday();
    const t = setTimeout(() => {
      if (state.queue.length) void flushGcalQueue(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [sid, ready, today]);
}

/** 시험용 */
export function _gcalState() {
  return state;
}

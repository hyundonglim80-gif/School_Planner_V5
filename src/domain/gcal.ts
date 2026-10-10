// 구글 캘린더로 보내기 (V4 lib/calendarSync·gcalPlan) - 순수 함수. 보내기·읽기는 features/gcal.
//
// V3·V4와 같은 캘린더(SP(work)·SP(class)·SP(commentary))·같은 표시(app=SchoolPlannerV3)·같은 글 모양이라 서로 겹치지 않는다.
// V5 자동 보내기(라벨 속성 '구글 캘린더')는 **항목마다** 맞춘다(V4는 날짜마다 - DESIGN 4-9 gcalQueue/{itemId}):
//   보낼 것 = 그 항목이 보이는 날마다 하나 (하루짜리 = 그 날, 이월 중 = 오늘, 기간 = 보이는 날마다 '(k/n)', 반복 = 항목이 날마다 따로).
//   구글의 것 = 표시 sp_item=항목 id (V5가 보낸 것) + 가져온 항목이면 V4가 보낸 것(sp_id = V4 id, 같은 날 같은 글).
//   짝이 있으면 고칠 것만 PUT, 없으면 POST, 남는 것 가운데 V5가 보냈거나 V4가 자동으로 보낸 것(sp_auto)은 DELETE -
//   지웠거나 옮겼거나 '구글 캘린더'를 끈 것. V4에서 손으로만 보낸 것(표시 없음)은 남긴다.

/** V3가 쓰는 표시. 바꾸면 V3·V4가 만든 일정을 못 알아본다 */
export const APP_TAG = 'SchoolPlannerV3';

export type SyncKind = 'event' | 'class' | 'journal';

export const CALENDAR_NAME: Record<SyncKind, string> = {
  event: 'SP(work)',
  class: 'SP(class)',
  journal: 'SP(commentary)',
};

export interface GoogleEventPayload {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: Record<string, string> };
}

/** 구글에서 읽은 일정 (필요한 칸만) */
export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  extendedProperties?: { private?: Record<string, string> };
}

export const EVENT_DESCRIPTION = '📌 School Planner에서 관리되는 일정입니다.';

// ── 날짜·글 (V4 그대로) ──

/** 종일 일정의 끝 날짜는 '다음 날' (구글은 end.date를 넣지 않는다 - 같은 날이면 길이 0이라 안 보인다) */
export function nextDayStr(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  for (let guard = 0; cur <= end && guard < 800; guard++) {
    out.push(cur);
    cur = nextDayStr(cur);
  }
  return out;
}

/** 같은 날 차례를 지키는 보이지 않는 글자 (구글은 같은 날을 제목 차례로 늘어놓는다) */
export function invisiblePrefix(seq: number): string {
  return seq.toString(2).padStart(5, '0').replace(/0/g, '‌').replace(/1/g, '‍');
}

/** 앞의 보이지 않는 글자와 완료 표시를 떼고 제목만 */
export function bareSummary(summary: string): string {
  return (summary || '')
    .replace(/^[‌‍]+/, '')
    .replace(/^✅\s*/, '')
    .trim();
}

/** 구글 제목: 라벨은 내용 뒤(좁은 칸에서 내용이 먼저 보이게), 완료는 앞에 ✅. 수업은 '[1교시] 국어'(labelFirst) */
export function composeSummary(seq: number, completed: boolean, content: string, labelStr: string, labelFirst = false): string {
  const head = `${invisiblePrefix(seq)}${completed ? '✅ ' : ''}`;
  return labelFirst ? `${head}[${labelStr}] ${content}` : `${head}${content} [${labelStr}]`;
}

/** 제목으로 맞춰 볼 때의 알맹이 (앞뒤 [묶음]을 뗀다 - 라벨을 앞에 두던 옛 제목과도 맞는다) */
export function summaryCore(summary: string): string {
  const bare = bareSummary(summary);
  let core = bare;
  let prev = '';
  while (core && core !== prev) {
    prev = core;
    core = core
      .replace(/^\[[^\]]*\]\s*/, '')
      .replace(/\s*\[[^\]]*\]$/, '')
      .trim();
  }
  return core || bare;
}

/** 손으로 보내기의 짝 (V4 isSameItem): 종류·날 같고, 수업은 교시, 둘 다 id가 있으면 id, 아니면 제목 알맹이 */
export function isSameItem(existing: GoogleEvent, payload: GoogleEventPayload): boolean {
  const e = existing.extendedProperties?.private;
  const p = payload.extendedProperties.private;
  if (!e) return false;
  if (e.type !== p.type || e.dateStr !== p.dateStr) return false;
  if (p.type === 'class') return e.period === p.period;
  if (e.sp_id && p.sp_id) return e.sp_id === p.sp_id;
  return summaryCore(existing.summary ?? '') === summaryCore(payload.summary);
}

/** 고칠 것이 있나 */
export function needsUpdate(existing: GoogleEvent, payload: GoogleEventPayload): boolean {
  return (
    existing.summary !== payload.summary ||
    existing.description !== payload.description ||
    existing.extendedProperties?.private?.completed !== payload.extendedProperties.private.completed
  );
}

// ── V5 항목 → 보낼 것 ──

/** 보낼지·무엇을 보낼지 셈하는 데 쓰는 항목 칸 (data/types Item의 일부) */
export interface GcalItem {
  id: string;
  kind: string;
  date: string | null;
  endDate?: string;
  text?: string;
  done?: boolean;
  doneDates?: string[];
  labelIds?: string[];
  props?: { gcal?: boolean; forward?: boolean };
  deletedAt?: unknown;
  src?: { from?: string; id?: string };
}

/**
 * '구글 캘린더'로 보낼 일정인가: 일정에 적은 값(props.gcal - 일정 칸에서 고침)이 먼저, 없으면 '구글 캘린더'를 켠 라벨이 붙었나.
 * 지운 것·글이 없는 것은 보내지 않는다(지운 것은 구글에서도 지운다).
 */
export function gcalOn(item: GcalItem | null | undefined, labelGcal: (labelIds: readonly string[]) => boolean): boolean {
  if (!item || item.kind !== 'event' || item.deletedAt || !item.date || !item.text?.trim()) return false;
  if (typeof item.props?.gcal === 'boolean') return item.props.gcal;
  return labelGcal(item.labelIds ?? []);
}

/**
 * 구글 표시 sp_id: 가져온 항목은 V4 id(V4가 보낸 것과 손으로 보내기가 같은 것으로 본다), 아니면 V5 id.
 * 기간 일정은 V4가 조각마다 따로 보냈다(조각 id가 남지 않는다) - V5 id로 하고 같은 날 같은 글로 짝짓는다.
 */
export function spIdOf(item: Pick<GcalItem, 'id' | 'src'>): string {
  const v4 = item.src?.from === 'v4' ? (item.src.id ?? '') : '';
  return v4 && !v4.startsWith('period:') ? v4 : item.id;
}

export interface ItemPayloadContext {
  /** 그 항목이 구글에 보일 날 (하루짜리 = 그 날·이월 중이면 오늘, 기간 = 보이는 날) */
  dates: readonly string[];
  /** 기간이면 그날의 '(k/n)' */
  position?: (date: string) => { k: number; n: number } | null;
  /** 그날 끝냈나 */
  doneOn: (date: string) => boolean;
  /** 라벨 이름 (없으면 '일정') */
  labelNames: readonly string[];
  /** 그날 차례 (1부터) */
  seqOf: (date: string) => number;
}

/** 항목 하나 → 보낼 것 (날마다 하나) */
export function itemPayloads(item: GcalItem, ctx: ItemPayloadContext): GoogleEventPayload[] {
  const labelStr = ctx.labelNames.length ? ctx.labelNames.join(', ') : '일정';
  const spId = spIdOf(item);
  return ctx.dates.map((date) => {
    const pos = ctx.position?.(date);
    const content = `${(item.text ?? '').trim()}${pos ? ` (${pos.k}/${pos.n})` : ''}`;
    const done = ctx.doneOn(date);
    return {
      summary: composeSummary(ctx.seqOf(date), done, content, labelStr),
      description: EVENT_DESCRIPTION,
      start: { date },
      end: { date: nextDayStr(date) },
      extendedProperties: {
        private: {
          app: APP_TAG,
          dateStr: date,
          type: 'event',
          labelStr,
          completed: done ? 'true' : 'false',
          sp_id: spId,
          sp_forwardChainId: '',
          sp_auto: 'true',
          sp_item: item.id,
        },
      },
    };
  });
}

export interface SyncPlan {
  post: GoogleEventPayload[];
  put: Array<{ id: string; payload: GoogleEventPayload }>;
  del: string[];
}

/**
 * 구글에 있는 그 항목의 것 ↔ 보낼 것.
 *   existing = sp_item이 이 항목인 것 + (가져온 항목이면) V4가 보낸 것 후보(같은 sp_id, 또는 보낼 날의 우리 표시 일정)
 *   - 짝: 같은 날의 V5 것 먼저, 없으면 같은 날 V4 것(sp_item 없음 · sp_id가 같거나 제목 알맹이가 같다)
 *   - 짝은 고칠 것이 있거나 자동 표시가 없으면 PUT(이제 V5가 맡는다)
 *   - 같은 날 V5 것이 둘이면(두 기기가 함께 넣었다) 남는 것은 지운다
 *   - 짝이 없는 것 가운데 이 항목의 것(V5가 보냈거나, V4가 자동으로 보낸 같은 sp_id)은 지운다. V4에서 손으로 보낸 것은 남긴다
 */
export function planItemSync(itemId: string, spId: string, existing: readonly GoogleEvent[], payloads: readonly GoogleEventPayload[]): SyncPlan {
  const plan: SyncPlan = { post: [], put: [], del: [] };
  const events = existing.filter((ev) => ev.extendedProperties?.private?.type === 'event');
  const priv = (ev: GoogleEvent) => ev.extendedProperties?.private ?? {};
  const matched = new Set<string>();
  const isV5 = (ev: GoogleEvent) => priv(ev).sp_item === itemId;
  const isV4Twin = (ev: GoogleEvent, p: GoogleEventPayload) =>
    !priv(ev).sp_item && (priv(ev).sp_id === spId || summaryCore(ev.summary ?? '') === summaryCore(p.summary));
  for (const p of payloads) {
    const date = p.extendedProperties.private.dateStr;
    const sameDay = (ev: GoogleEvent) => !matched.has(ev.id) && priv(ev).dateStr === date;
    const hit = events.find((ev) => sameDay(ev) && isV5(ev)) ?? events.find((ev) => sameDay(ev) && isV4Twin(ev, p));
    if (!hit) {
      plan.post.push(p);
      continue;
    }
    matched.add(hit.id);
    if (needsUpdate(hit, p) || priv(hit).sp_auto !== 'true' || priv(hit).sp_item !== itemId) plan.put.push({ id: hit.id, payload: p });
  }
  for (const ev of events) {
    if (matched.has(ev.id)) continue;
    const own = isV5(ev) || (!priv(ev).sp_item && priv(ev).sp_id === spId && priv(ev).sp_auto === 'true');
    if (own) plan.del.push(ev.id);
  }
  return plan;
}

/** 쓰기 수 (보낸 뒤 안내 '…건 반영') */
export const planSize = (p: SyncPlan) => p.post.length + p.put.length + p.del.length;

// V4 일정·기록·메모 → V5 items (+ 반복 묶음 → series) - DESIGN 8-3. 순수 함수 - 읽기는 read.ts, 적기는 run.ts.
//
//   {sp}/events/{date}   readEventList        → items(event)   라벨 셋 자리 → labelIds(짝 표 labelMap - 라벨 가져오기가 같은 실행에서), 본문은 그대로
//                                                               time 'YYYY-MM-DDTHH:mm' → 'HH:mm'(그 날이 다르면 일정 날에 두고 수를 적는다), alarmTriggered → alarmDone
//                                                               기한 = 일정의 due → 이월 사슬의 기한(v4_eventDue), 공휴일 일정은 뺀다
//                                                               속성은 라벨과 다른 것만(P3-1), forwardOptOut = 이월 끔
//                                                               이월 사슬: 끝내지 않았으면 date = 처음 날(originalDate)·carrying → 오늘 칸에 '↪ 처음 날부터'(P3-3),
//                                                               끝냈으면 carriedFrom. 사슬 하나에 일정 하나면 V5 id를 사슬로 셈한다(V4는 날마다 새 id로 옮겼다)
//   기간 조각(groupId + '(i/n)') → items 하나(date~endDate, '(i/n)' 떼기, 날마다 완료 doneDates, 빈 날 skipDates, 평일에만 있으면 workdays)
//   반복 묶음(groupId, '(i/n)' 없음, 둘 이상) → series(imported - 규칙 없음) + 항목마다 seriesId·seriesIndex
//   {sp}/journals/{date}.entries                → items(note, date)  기록 라벨 id·이름 → labelIds, '[표]' → 빈 글, notice_·attendance_ 자동 기록은 빼다(DESIGN 5-4)
//   {sp}/tasks/{id}                             → items(note, null)  라벨 이름 → labelIds, fromDate·keepId, 차례는 V4 차례대로
//   linkedItems                                  → linkIds           결정적 id로 바로 셈(같은 실행에서 짝을 찾는다), 수업 → 'lesson:{date}:{n}', 다른 공간(그룹) 것은 빼다
//
// 학생 태그(#26040305 → studentIds)는 학급을 옮기는 P7에서. 글의 태그는 그대로 남는다.
import { academicYearOf, isValidDateStr } from '../../domain/dateUtils';
import { ordersBetween } from '../../domain/order';
import { isWeekend } from '../../domain/period';
import type { WriteOp } from '../../data/repo/ops';
import type { Attachment, EntryTable, ItemProps, Stored } from '../../data/types';
import { idlessKey, v4id } from './ids';
import { eventLabelSources, noteLabelSources, type V4LabelDocs } from './labels';
import { dueOf, isDueDate, isHolidayEvent, journalLabelNames, periodPieceOf, readJournalEntries, sanitizeDueMap } from './legacy/entries';
import { resolveEventLabelNames } from './legacy/eventLabels';
import { eventContentOf, parseV3EventText } from './legacy/eventText';
import { emptyCounts, planDocs, type ImportCounts, type Planned } from './plan';

/** 읽어 온 V4 문서들 (공간 밑) */
export interface V4ItemDocs {
  /** 날짜 → events/{date} 문서 */
  events: Readonly<Record<string, unknown>>;
  /** 날짜 → journals/{date} 문서 */
  journals: Readonly<Record<string, unknown>>;
  /** 문서 id → tasks/{id} 문서 */
  tasks: Readonly<Record<string, unknown>>;
  /** settings/v4_eventDue 문서 */
  dues?: unknown;
}

/** 결과 표에 따로 적는 수 */
export interface ItemNotes {
  /** 공휴일 일정 (뺐다 - V5 공휴일은 P5-3) */
  holidays: number;
  /** 글이 비어 뺀 일정 */
  empty: number;
  /** 알림 날짜가 일정 날과 달라 일정 날에 둔 것 */
  alarmMoved: number;
  /** 알림장·출결 자동 기록 (뺐다 - V5는 계산해 보인다) */
  autoJournals: number;
  /** 한 항목으로 합친 기간 일정 */
  periods: number;
  /** 반복 묶음 */
  series: number;
  /** 찾지 못해 뺀 링크 */
  linksDropped: number;
}

export interface ItemsPlan {
  ops: WriteOp[];
  counts: { 'items.event': ImportCounts; 'items.note': ImportCounts; series: ImportCounts };
  notes: ItemNotes;
  /** V4 링크 하나 → V5 id (수업 가져오기가 같은 짝 표로) */
  linkOf: (l: unknown) => string | undefined;
  /** 가져올 일정 (수업 없는 날 셈 - 수업X 일정) */
  events: ReadonlyArray<Planned<'items'>['data']>;
}

type Raw = Record<string, unknown>;
type ItemData = Planned<'items'>['data'];
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 일정 문서의 목록 + id가 없던 것인가 (V4 readEventList는 id 없는 것에 차례 id를 붙인다 - 가져오기는 그것을 믿지 않는다) */
function eventsOf(data: unknown): { it: Raw; idless: boolean }[] {
  const d = isObj(data) ? data : {};
  if (Array.isArray(d.eventList) && d.eventList.length > 0) {
    return d.eventList.map((item: unknown, idx: number) => {
      const o = isObj(item) ? item : {};
      const has = o.id !== undefined && o.id !== null && o.id !== '';
      return { it: has ? o : { ...o, id: 'ev_' + idx }, idless: !has };
    });
  }
  if (typeof d.eventText === 'string' && d.eventText) return parseV3EventText(d.eventText).map((it) => ({ it: it as Raw, idless: true }));
  return [];
}

/** 첨부 (+ 옛 imageUrl 하나) */
function attachmentsOf(o: Raw): Attachment[] | undefined {
  const out: Attachment[] = [];
  if (Array.isArray(o.attachments)) {
    for (const a of o.attachments) if (isObj(a) && str(a.url)) out.push({ ...(a as unknown as Attachment), name: str(a.name) || '첨부', type: str(a.type) || 'file' });
  }
  const img = str(o.imageUrl);
  if (img && !out.some((a) => a.url === img)) out.push({ name: '사진', url: img, type: 'image' });
  return out.length ? out : undefined;
}

const tablesOf = (o: Raw): EntryTable[] | undefined => (Array.isArray(o.tables) && o.tables.length ? (o.tables as EntryTable[]) : undefined);

/** V4 표만 있는 항목의 글 ('[표]') → 빈 글 (lib/entryTable TABLE_ONLY_CONTENT) */
const textOf = (content: string, tables: EntryTable[] | undefined) => (tables && content.trim() === '[표]' ? '' : content);

/** 알림 'YYYY-MM-DDTHH:mm'(또는 'HH:mm') → 'HH:mm'과 그 날 */
function alarmOf(v: unknown): { hm: string; day: string } | null {
  const s = str(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return { hm: m[2], day: m[1] };
  return /^\d{2}:\d{2}$/.test(s) ? { hm: s, day: '' } : null;
}

const yearOf = (date: string | null) => (date ? String(academicYearOf(date)) : undefined);

/** 지금 V5 문서 (지운 것 포함) */
export interface ExistingDocs {
  items: Readonly<Record<string, Stored<'items'>>>;
  series: Readonly<Record<string, Stored<'series'>>>;
}

export function planItems(
  sid: string,
  docs: V4ItemDocs,
  labelDocs: V4LabelDocs,
  labelMap: { event: Readonly<Record<string, string>>; note: Readonly<Record<string, string>> },
  existing: ExistingDocs,
): ItemsPlan {
  const notes: ItemNotes = { holidays: 0, empty: 0, alarmMoved: 0, autoJournals: 0, periods: 0, series: 0, linksDropped: 0 };
  const dueMap = sanitizeDueMap(isObj(docs.dues) ? docs.dues.dues : undefined);

  // 라벨: V4 이름 → V5 id, 그리고 V4 일정 라벨 속성(라벨과 다른 속성만 적으려고 - P3-1)
  const evSources = eventLabelSources(labelDocs);
  const evLabelList = evSources.map((s) => ({ id: s.key, name: s.v4Name }));
  const evProps = new Map(evSources.map((s) => [s.v4Name, s.props]));
  const noteList = noteLabelSources(labelDocs).map((s) => ({ id: s.key, name: s.v4Name }));
  const idsOf = (names: string[], map: Readonly<Record<string, string>>) => [...new Set(names.map((n) => map[n]).filter((x): x is string => !!x))];

  /** 링크 짝: 'event|날짜|V4 id' · 'journal|날짜|V4 id' · 'memo|V4 id' → V5 id */
  const linkTarget = new Map<string, string>();
  /** 링크는 모두 셈한 뒤에 푼다 */
  const linkJobs: { data: ItemData; links: unknown[] }[] = [];

  // ───────── 일정 ─────────
  const eventPlanned: Planned<'items'>[] = [];
  const dates = Object.keys(docs.events).filter(isValidDateStr).sort();
  const perDate = dates.map((date) => ({ date, list: eventsOf(docs.events[date]) }));

  // 사슬 하나에 일정이 하나뿐이면 그 사슬로 셈한다 (V4는 이월할 때마다 새 id - 다시 가져와도 같은 V5 일정이게)
  const chainCount = new Map<string, number>();
  for (const { list } of perDate) for (const { it } of list) if (str(it.forwardChainId)) chainCount.set(str(it.forwardChainId), (chainCount.get(str(it.forwardChainId)) ?? 0) + 1);

  interface Piece {
    date: string;
    it: Raw;
    base: string;
    order: string;
  }
  const pieces = new Map<string, Piece[]>();
  const groups = new Map<string, Planned<'items'>[]>();

  for (const { date, list } of perDate) {
    const seen = new Map<string, number>();
    const orders = ordersBetween(null, null, list.length);
    list.forEach(({ it, idless }, idx) => {
      const content = eventContentOf(it);
      if (isHolidayEvent(it)) {
        notes.holidays++;
        return;
      }
      if (!content) {
        notes.empty++;
        return;
      }
      const piece = periodPieceOf(it, content);
      if (piece) {
        const arr = pieces.get(piece.key) ?? [];
        arr.push({ date, it, base: piece.base, order: orders[idx] });
        pieces.set(piece.key, arr);
        // 링크 짝은 기간을 합친 뒤에
        linkTarget.set(`event|${date}|${str(it.id)}`, `period:${piece.key}`);
        return;
      }
      const chain = str(it.forwardChainId);
      const key = chain && chainCount.get(chain) === 1 ? `chain:${chain}` : idless ? idlessKey(seen, date, content, str(it.label)) : str(it.id);
      const id = v4id('item.event', sid, chain && key.startsWith('chain:') ? 'events/chain' : `events/${date}`, key);
      linkTarget.set(`event|${date}|${str(it.id)}`, id);
      const data = eventData(it, date, content, orders[idx]);
      const p: Planned<'items'> = { id, data, src: { path: `events/${date}`, id: key }, year: yearOf(data.date) };
      eventPlanned.push(p);
      if (Array.isArray(it.linkedItems) && it.linkedItems.length) linkJobs.push({ data, links: it.linkedItems });
      const gid = str(it.groupId);
      if (gid) groups.set(gid, [...(groups.get(gid) ?? []), p]);
    });
  }

  /** V4 일정 하나 → 칸 (기간·반복 칸은 뒤에서) */
  function eventData(it: Raw, date: string, content: string, order: string): ItemData {
    const names = resolveEventLabelNames(it, evLabelList);
    const labelIds = idsOf(names, labelMap.event);
    // 라벨이 정한 속성 (붙은 라벨 하나라도 켰으면 - 라벨이 없으면 달력만)
    const defs = names.map((n) => evProps.get(n)).filter((x) => !!x);
    const any = (k: 'calendar' | 'forward' | 'skip' | 'gcal') => defs.some((p) => p![k]);
    const fromLabels = { calendar: defs.length === 0 ? true : any('calendar'), forward: any('forward'), skip: any('skip'), gcal: any('gcal') };
    const explicit: ItemProps = {};
    if (it.forwardOptOut === true) explicit.forward = false;
    else if (it.forward === true) explicit.forward = true;
    if (typeof it.calendar === 'boolean') explicit.calendar = it.calendar;
    if (typeof it.skip === 'boolean') explicit.skip = it.skip;
    if (typeof it.gcal === 'boolean') explicit.gcal = it.gcal;
    const props: ItemProps = {};
    for (const k of ['calendar', 'forward', 'skip', 'gcal'] as const) if (typeof explicit[k] === 'boolean' && explicit[k] !== fromLabels[k]) props[k] = explicit[k];
    // 이월 판단 (V4 isForwardTarget - 라벨을 못 풀면 사슬 흔적)
    const forward = explicit.forward ?? (defs.length ? fromLabels.forward : !!(it.forwardChainId || it.originalDate));

    const done = it.completed === true;
    const out: ItemData = { kind: 'event', date, text: content, labelIds, order };
    if (done) out.done = true;
    if (Object.keys(props).length) out.props = props;
    const alarm = alarmOf(it.time);
    if (alarm) {
      out.time = alarm.hm;
      if (alarm.day && alarm.day !== date) notes.alarmMoved++;
      if (it.alarmTriggered === true) out.alarmDone = true;
    }
    const due = dueOf(it, dueMap);
    if (isDueDate(due)) out.due = due;
    const att = attachmentsOf(it);
    if (att) out.attachments = att;
    // 이월 사슬
    const origin = str(it.originalDate);
    if (isValidDateStr(origin) && origin < date) {
      if (done) out.carriedFrom = origin;
      else if (forward) {
        out.date = origin;
        out.carrying = true;
      }
    }
    return out;
  }

  // 기간: 조각을 한 항목으로
  for (const [key, list] of pieces) {
    const byDate = new Map<string, Piece>();
    for (const p of list.sort((a, b) => a.date.localeCompare(b.date))) if (!byDate.has(p.date)) byDate.set(p.date, p);
    const ds = [...byDate.keys()];
    const first = byDate.get(ds[0])!;
    const data = eventData(first.it, first.date, first.base, first.order);
    delete data.carrying;
    delete data.carriedFrom;
    data.date = ds[0];
    delete data.done;
    if (ds.length > 1) {
      const start = ds[0];
      const end = ds[ds.length - 1];
      const workdays = ds.every((d) => !isWeekend(d));
      const skip: string[] = [];
      for (let d = start; d <= end; d = nextDay(d)) if (!byDate.has(d) && !(workdays && isWeekend(d))) skip.push(d);
      const doneDays = ds.filter((d) => byDate.get(d)!.it.completed === true);
      data.endDate = end;
      if (workdays) data.workdays = true;
      if (skip.length) data.skipDates = skip;
      if (doneDays.length === ds.length) data.done = true;
      else if (doneDays.length) data.doneDates = doneDays;
      notes.periods++;
    } else if (first.it.completed === true) data.done = true;
    const id = v4id('item.event', sid, 'events/period', key);
    for (const d of ds) linkTarget.set(`event|${d}|${str(byDate.get(d)!.it.id)}`, id);
    for (const [k, v] of linkTarget) if (v === `period:${key}`) linkTarget.set(k, id);
    eventPlanned.push({ id, data, src: { path: `events/${ds[0]}`, id: `period:${key}` }, year: yearOf(ds[0]) });
    const links = ds.flatMap((d) => (Array.isArray(byDate.get(d)!.it.linkedItems) ? (byDate.get(d)!.it.linkedItems as unknown[]) : []));
    if (links.length) linkJobs.push({ data, links });
  }

  // 반복 묶음: groupId가 같은 일정이 둘 이상이면
  const seriesPlanned: Planned<'series'>[] = [];
  for (const [gid, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => (a.data.date ?? '').localeCompare(b.data.date ?? ''));
    const seriesId = v4id('series', sid, 'events', gid);
    sorted.forEach((p, i) => {
      p.data.seriesId = seriesId;
      p.data.seriesIndex = i;
    });
    const head = sorted[0].data;
    seriesPlanned.push({
      id: seriesId,
      data: {
        start: head.date ?? '',
        until: sorted[sorted.length - 1].data.date ?? '',
        count: sorted.length,
        template: { text: head.text, labelIds: head.labelIds, ...(head.time ? { time: head.time } : {}), ...(head.props ? { props: head.props } : {}) },
        imported: true,
      },
      src: { path: 'events', id: gid },
    });
    notes.series++;
  }

  // ───────── 기록 ─────────
  const notePlanned: Planned<'items'>[] = [];
  for (const date of Object.keys(docs.journals).filter(isValidDateStr).sort()) {
    const entries = readJournalEntries(docs.journals[date]);
    const seen = new Map<string, number>();
    const orders = ordersBetween(null, null, entries.length);
    entries.forEach((e, idx) => {
      const v4Id = str(e.id);
      if (v4Id.startsWith('notice_') || v4Id.startsWith('attendance_')) {
        notes.autoJournals++;
        return;
      }
      const tables = tablesOf(e);
      const att = attachmentsOf(e);
      const content = str(e.content ?? e.text);
      if (!content.trim() && !tables && !att) {
        notes.empty++;
        return;
      }
      const names = journalLabelNames(e, noteList);
      const key = e.__idless ? idlessKey(seen, date, content, names.join(',')) : v4Id;
      const id = v4id('item.note', sid, `journals/${date}`, key);
      linkTarget.set(`journal|${date}|${v4Id}`, id);
      const data: ItemData = { kind: 'note', date, text: textOf(content, tables), labelIds: idsOf(names, labelMap.note), order: orders[idx] };
      if (e.completed === true) data.done = true;
      if (e.favorite === true) data.favorite = true;
      if (tables) data.tables = tables;
      if (att) data.attachments = att;
      notePlanned.push({ id, data, src: { path: `journals/${date}`, id: key }, year: yearOf(date) });
      if (Array.isArray(e.linkedItems) && e.linkedItems.length) linkJobs.push({ data, links: e.linkedItems });
    });
  }

  // ───────── 메모 ─────────
  const memos = Object.entries(docs.tasks)
    .filter(([, d]) => isObj(d))
    .map(([docId, d]) => {
      const o = d as Raw;
      const created = typeof o.createdAt === 'number' ? o.createdAt : typeof o.order === 'number' ? Math.abs(o.order) : 0;
      return { docId, o, created, order: typeof o.order === 'number' ? o.order : -created };
    })
    // V4(V3) 차례: order가 작은 것이 앞, 같으면 나중에 만든 것이 앞
    .sort((a, b) => a.order - b.order || b.created - a.created || a.docId.localeCompare(b.docId));
  const memoOrders = ordersBetween(null, null, memos.length);
  memos.forEach(({ docId, o }, idx) => {
    const tables = tablesOf(o);
    const att = attachmentsOf(o);
    const content = str(o.text) || str(o.content);
    if (!content.trim() && !tables && !att) {
      notes.empty++;
      return;
    }
    const names = Array.isArray(o.labels) ? o.labels.map((n) => String(n).trim()).filter(Boolean) : [];
    const id = v4id('item.note', sid, `tasks/${docId}`, docId);
    linkTarget.set(`memo|${docId}`, id);
    const data: ItemData = { kind: 'note', date: null, text: textOf(content, tables), labelIds: idsOf(names, labelMap.note), order: memoOrders[idx] };
    if (o.completed === true) data.done = true;
    if (o.favorite === true) data.favorite = true;
    if (isValidDateStr(str(o.fromDate))) data.fromDate = str(o.fromDate);
    if (str(o.keepId)) data.keepId = str(o.keepId);
    if (tables) data.tables = tables;
    if (att) data.attachments = att;
    notePlanned.push({ id, data, src: { path: `tasks/${docId}`, id: docId } });
    if (Array.isArray(o.linkedItems) && o.linkedItems.length) linkJobs.push({ data, links: o.linkedItems });
  });

  // ───────── 링크 (모두 셈한 뒤 - 상대를 찾지 않고 바로) ─────────
  /** V4 링크 하나 → V5 id (찾지 못했거나 다른 공간 것이면 undefined - 수를 센다). 수업 가져오기(lessons.ts)도 쓴다 */
  const linkOf = (l: unknown): string | undefined => {
    if (!isObj(l)) return undefined;
    if (l.targetFId && l.targetFId !== 'personal') {
      notes.linksDropped++;
      return undefined;
    }
    const type = str(l.targetType);
    const tid = String(l.targetId ?? l.id ?? '');
    const tdate = str(l.targetDate).slice(0, 10);
    let id: string | undefined;
    if (type === 'schedule' && isValidDateStr(tdate) && l.targetPeriod !== undefined && l.targetPeriod !== '') id = `lesson:${tdate}:${String(l.targetPeriod)}`;
    else if (type === 'event') id = linkTarget.get(`event|${tdate}|${tid}`);
    else if (type === 'journal') id = linkTarget.get(`journal|${tdate}|${tid}`);
    else if (type === 'memo') id = linkTarget.get(`memo|${tid}`);
    if (id?.startsWith('period:')) id = undefined;
    if (!id) notes.linksDropped++;
    return id;
  };
  for (const { data, links } of linkJobs) {
    const ids = linkIdsOf(links, linkOf);
    if (ids.length) data.linkIds = ids;
  }

  const ownsItem = (kind: 'event' | 'note') => (d: Stored<'items'>) =>
    d.kind === kind && d.src?.from === 'v4' && /^(events|journals|tasks)\//.test(d.src.path ?? '');
  const ev = planDocs(sid, 'items', eventPlanned, existing.items, ownsItem('event'));
  const nt = planDocs(sid, 'items', notePlanned, existing.items, ownsItem('note'));
  const sr = planDocs(sid, 'series', seriesPlanned, existing.series, (d) => d.src?.from === 'v4' && d.src.path === 'events');
  return {
    // 반복 문서를 먼저 (항목이 가리킨다)
    ops: [...sr.ops, ...ev.ops, ...nt.ops],
    counts: { 'items.event': ev.counts, 'items.note': nt.counts, series: sr.counts ?? emptyCounts() },
    notes,
    linkOf,
    events: eventPlanned.map((p) => p.data),
  };
}

/** V4 링크 목록 → V5 id 목록 (겹친 것·못 찾은 것은 뺀다) */
export function linkIdsOf(links: readonly unknown[], linkOf: (l: unknown) => string | undefined): string[] {
  const ids: string[] = [];
  for (const l of links) {
    const id = linkOf(l);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function nextDay(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(y, m - 1, day + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

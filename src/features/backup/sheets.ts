// 구글 시트로 보내기 · 시트에서 되읽기 (V4 lib/sheetsSync.ts exportToSheets·importFromSheets, P8-3). 칸 모양은 domain/sheets.
//
// V5는 V5만의 시트 파일에 쓴다 - 파일 id는 공간마다 settings/sheets(V4·V3가 함께 쓰는 시트를 덮지 않는다).
// 되읽기는 **고치고 더하기만**: 메타데이터 id로 같은 항목을 찾아 글·완료·라벨을 고치고, id 없는 줄은 새로 만든다.
// 시트에서 지운 줄은 앱에서 지우지 않는다(V4는 그날 목록을 통째로 바꿨다 - PLAN 5장 P8-3). 날짜 옮기기는 앱에서.
import { doc, getDocFromServer } from 'firebase/firestore';
import { addDays } from '../../domain/dateUtils';
import { lessonsOn, type LessonSource } from '../../domain/lessons';
import { cleanLabelName } from '../../domain/labels';
import { orderBetween } from '../../domain/order';
import {
  buildEvalRows,
  buildMemoRows,
  buildScheduleRows,
  EVAL_SHEET_PREFIX,
  evalSheetNameOf,
  evalUpdatesFor,
  parseEvalRows,
  parseMemoRows,
  parseScheduleRows,
  realLabels,
  SHEET_MEMO,
  SHEET_SCHEDULE,
  type ReadLine,
  type ScheduleDay,
  type SheetEval,
  type SheetsInclude,
} from '../../domain/sheets';
import { db } from '../../data/firebase';
import { createSpreadsheet, listSheetTitles, readSheet, spreadsheetExists, writeSheet, ensureSheet } from '../../data/google/sheets';
import { withGoogleToken } from '../../data/google/token';
import { ensureLabelOps } from '../../data/labels';
import { batch, newPath, writeOp, type WriteOp } from '../../data/repo';
import { itemLabels, labelTreeOf, labelsOf, memos, type Docs } from '../../data/select';
import type { ItemKind } from '../../data/types';
import { doneChanges, itemPath, type ItemDoc } from '../events/eventOps';
import { editChanges, lessonDayPath } from '../lessons/lessonOps';

export const SHEETS_TITLE = 'School Planner V5 시트';
const RECORD_ID = 'sheets';

/** 시트에 담을 자료 (지금 공간 - 화면이 고른 사본) */
export interface SheetsData {
  sid: string;
  items: Docs<'items'>;
  labels: Docs<'labels'>;
  evaluations: Docs<'evaluations'>;
  classes: Docs<'classes'>;
  lessons: LessonSource;
  /** 수업 칸 문서 (되읽기에서 고치기 전 값) */
  lessonDays: Docs<'lessonDays'>;
  periodNames: string[];
}

/** 이 공간이 쓰는 시트 파일 id (없으면 null) */
export async function readSheetRecord(sid: string): Promise<string | null> {
  const snap = await getDocFromServer(doc(db, 'spaces', sid, 'settings', RECORD_ID));
  const id = snap.data()?.spreadsheetId;
  return typeof id === 'string' && id ? id : null;
}

async function writeSheetRecord(sid: string, spreadsheetId: string, before: string | null) {
  await batch([writeOp.merge({ sid, coll: 'settings', id: RECORD_ID }, { spreadsheetId }, before ? { spreadsheetId: before } : null)], {
    fail: '시트 파일은 만들었지만 그 주소를 적지 못했습니다. 다시 보내 주세요.',
  });
}

/** 이 공간의 시트 파일 (없거나 지웠으면 새로 만들어 적는다) */
export async function ensureSpreadsheet(token: string, sid: string): Promise<string> {
  const before = await readSheetRecord(sid);
  if (before && (await spreadsheetExists(token, before))) return before;
  const id = await createSpreadsheet(token, SHEETS_TITLE);
  await writeSheetRecord(sid, id, before);
  return id;
}

const live = <T extends { deletedAt?: unknown }>(d: T | undefined): d is T => !!d && !d.deletedAt;

function datesOf(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

function byDate(items: Docs<'items'>, kind: ItemKind): Map<string, ItemDoc[]> {
  const out = new Map<string, ItemDoc[]>();
  for (const it of Object.values(items)) {
    if (!live(it) || it.kind !== kind || !it.date) continue;
    if (!out.has(it.date)) out.set(it.date, []);
    out.get(it.date)!.push(it);
  }
  for (const list of out.values()) list.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : 1));
  return out;
}

function sheetEvalOf(ev: Docs<'evaluations'>[string], classes: Docs<'classes'>): SheetEval {
  const genderOf = new Map((classes[ev.classId]?.students ?? []).map((s) => [s.sid, s.gender]));
  return {
    id: ev.id,
    date: ev.date,
    period: ev.period ?? null,
    classId: ev.classId,
    title: ev.title,
    type: ev.type,
    ...(ev.subject ? { subject: ev.subject } : {}),
    ...(ev.indiv ? { indiv: true } : {}),
    ...(ev.group ? { group: true } : {}),
    students: (ev.students ?? []).map((s) => ({ sid: s.sid, num: s.num, name: s.name, ...(genderOf.get(s.sid) ? { gender: genderOf.get(s.sid) } : {}) })),
    values: ev.values ?? {},
  };
}

export interface SheetsExportResult {
  spreadsheetId: string;
  days: number;
  memos: number;
  evaluations: number;
}

/** 보내기 - 기간 안의 날마다 한 줄(일정기록), 학급마다 조사표 탭, 메모는 통째로. 탭은 비우고 다시 쓴다 */
export function exportToSheets(d: SheetsData, range: { start: string; end: string }, include: SheetsInclude, onStep?: (msg: string) => void): Promise<SheetsExportResult> {
  return withGoogleToken('구글 시트로 보내려면 구글 로그인이 필요합니다.', async (token) => {
    onStep?.('시트 파일을 확인하는 중…');
    const id = await ensureSpreadsheet(token, d.sid);
    const titles = await listSheetTitles(token, id);
    const evTree = labelTreeOf(d.labels, 'event');
    const noteTree = labelTreeOf(d.labels, 'note');
    const names = (tree: typeof evTree, ids: string[] | undefined) => itemLabels(tree, ids).map((l) => l.name);
    const result: SheetsExportResult = { spreadsheetId: id, days: 0, memos: 0, evaluations: 0 };

    const evalsInRange = Object.values(d.evaluations)
      .filter((e) => live(e) && e.date >= range.start && e.date <= range.end)
      .sort((a, b) => (a.date + String(a.period ?? 0)).localeCompare(b.date + String(b.period ?? 0)));
    if (include.event || include.class || include.journal || include.evaluation) {
      onStep?.('일정·수업·기록·조사표를 모으는 중…');
      const events = byDate(d.items, 'event');
      const records = byDate(d.items, 'note');
      const dates = datesOf(range.start, range.end);
      let periodNames = d.periodNames;
      const days: ScheduleDay[] = dates.map((date) => {
        const cells = include.class ? lessonsOn(date, d.lessons).cells : [];
        if (cells.length > periodNames.length) periodNames = [...periodNames, ...cells.slice(periodNames.length).map((c) => `${c.n}교시`)];
        return {
          date,
          events: (events.get(date) ?? []).map((e) => ({ id: e.id, text: e.text ?? '', labels: names(evTree, e.labelIds), done: !!e.done })),
          periods: cells.map((c) => ({ subject: c.subject, memo: c.memo, supplies: c.supplies })),
          records: (records.get(date) ?? []).map((n) => ({ id: n.id, text: n.text ?? '', labels: names(noteTree, n.labelIds), done: !!n.done })),
          evals: evalsInRange.filter((e) => e.date === date).map((e) => (e.period ? `${e.title} (${e.period}교시)` : e.title)),
        };
      });
      result.days = days.length;
      onStep?.('시트에 쓰는 중…');
      await ensureSheet(token, id, SHEET_SCHEDULE, titles);
      await writeSheet(token, id, SHEET_SCHEDULE, buildScheduleRows(days, include, periodNames));
      if (include.evaluation) {
        const byClass = new Map<string, SheetEval[]>();
        for (const e of evalsInRange) {
          const name = evalSheetNameOf(e.classId);
          if (!byClass.has(name)) byClass.set(name, []);
          byClass.get(name)!.push(sheetEvalOf(e, d.classes));
        }
        for (const [name, list] of byClass) {
          onStep?.(`조사표를 [${name}]에 쓰는 중…`);
          await ensureSheet(token, id, name, titles);
          await writeSheet(token, id, name, buildEvalRows(list));
          result.evaluations += list.length;
        }
      }
    }
    if (include.memo) {
      onStep?.('메모를 쓰는 중…');
      const list = memos(d.items)
        .slice()
        .sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0))
        .map((m) => ({ id: m.id, text: m.text ?? '', done: !!m.done, labels: names(noteTree, m.labelIds), url: m.attachments?.[0]?.url ?? '', createdAt: Number(m.createdAt ?? 0) }));
      result.memos = list.length;
      await ensureSheet(token, id, SHEET_MEMO, titles);
      await writeSheet(token, id, SHEET_MEMO, buildMemoRows(list));
    }
    return result;
  });
}

export interface SheetsReadResult {
  changed: number;
  added: number;
  lessons: number;
  evaluations: number;
  skipped: number;
}

export const sheetsReadText = (r: SheetsReadResult) =>
  [
    `고친 것 ${r.changed}건`,
    `새로 ${r.added}건`,
    r.lessons > 0 ? `수업 ${r.lessons}칸` : '',
    r.evaluations > 0 ? `조사표 ${r.evaluations}장` : '',
    r.skipped > 0 ? `지운 항목이라 건너뜀 ${r.skipped}건` : '',
  ]
    .filter(Boolean)
    .join(' · ');

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
const VALID_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** 되읽기 - 시트 → 앱 (고치고 더하기만). 쓰기는 400개씩, 되돌리기 더미에는 넣지 않는다(수백 칸이 한꺼번에) */
export function importFromSheets(d: SheetsData, include: SheetsInclude, onStep?: (msg: string) => void): Promise<SheetsReadResult> {
  return withGoogleToken('구글 시트에서 되읽으려면 구글 로그인이 필요합니다.', async (token) => {
    const id = await readSheetRecord(d.sid);
    if (!id) throw new Error("연결된 시트가 없습니다. 먼저 '시트로 보내기'를 한 번 해 주세요.");
    const r: SheetsReadResult = { changed: 0, added: 0, lessons: 0, evaluations: 0, skipped: 0 };
    const ops: WriteOp[] = [];

    onStep?.('시트를 읽는 중…');
    const days = include.event || include.class || include.journal ? parseScheduleRows(await readSheet(token, id, SHEET_SCHEDULE), include) : [];
    const memoRows = include.memo ? parseMemoRows(await readSheet(token, id, SHEET_MEMO)) : [];

    // 라벨: 시트에 적힌 이름 → id (없는 이름은 새 라벨 - 종류마다 한 번에)
    const labelIdsOf = (kind: ItemKind, fallback: string, lines: ReadLine[][], extra: string[][] = []) => {
      const names = [...new Set([...lines.flat().map((l) => realLabels(l.labels, fallback)), ...extra].flat().map(cleanLabelName).filter(Boolean))];
      const made = ensureLabelOps(d.sid, kind, names, labelsOf(d.labels, kind));
      ops.push(...made.ops);
      const map = new Map(names.map((n, i) => [n, made.ids[i]]));
      return (raw: string[]) => [...new Set(raw.map(cleanLabelName).map((n) => map.get(n)).filter((x): x is string => !!x))];
    };
    const eventIds = labelIdsOf('event', '일정', days.map((x) => x.events ?? []));
    const noteIds = labelIdsOf('note', '기록', days.map((x) => x.records ?? []), memoRows.map((m) => m.labels));

    const seen = new Set<string>();
    const lastOrder = new Map<string, string | null>();
    const orderFor = (kind: ItemKind, date: string | null) => {
      const key = `${kind}|${date}`;
      if (!lastOrder.has(key)) {
        let last: string | null = null;
        for (const it of Object.values(d.items)) if (live(it) && it.kind === kind && (it.date ?? null) === date && (last === null || it.order > last)) last = it.order;
        lastOrder.set(key, last);
      }
      const next = orderBetween(lastOrder.get(key) ?? null, null);
      lastOrder.set(key, next);
      return next;
    };

    /** 한 줄 → 고치기 / 새로 */
    const applyLine = (kind: ItemKind, date: string | null, line: { id?: string; content: string; completed: boolean }, labelIds: string[]) => {
      // id 없는 줄(시트에 손으로 더한 줄)은 같은 날·같은 글의 항목이 이미 있으면 그것으로 - 되읽기를 두 번 해도 두 번 들어가지 않게
      const twin = line.id
        ? undefined
        : Object.values(d.items).find((it) => live(it) && it.kind === kind && (it.date ?? null) === date && (it.text ?? '') === line.content && !seen.has(it.id));
      if (twin) line = { ...line, id: twin.id };
      const cur = line.id ? d.items[line.id] : undefined;
      if (line.id && cur) {
        if (seen.has(line.id)) return;
        seen.add(line.id);
        if (!live(cur) || cur.kind !== kind) return void (r.skipped += 1);
        const changes: Record<string, unknown> = {};
        if (line.content !== (cur.text ?? '')) changes.text = line.content;
        // 기간 일정의 완료는 날마다(doneDates) - 시트 한 칸으로 바꾸지 않는다
        if (!cur.endDate && line.completed !== !!cur.done) Object.assign(changes, doneChanges(line.completed));
        if (!sameSet(labelIds, cur.labelIds ?? [])) changes.labelIds = labelIds;
        if (Object.keys(changes).length > 0) {
          ops.push(writeOp.patch(itemPath(d.sid, cur.id), changes, cur));
          r.changed += 1;
        }
        return;
      }
      const at = line.id && VALID_ID.test(line.id) && !seen.has(line.id) ? { sid: d.sid, coll: 'items' as const, id: line.id } : newPath(d.sid, 'items');
      seen.add(at.id);
      ops.push(
        writeOp.create(at, {
          kind,
          date,
          text: line.content,
          labelIds,
          order: orderFor(kind, date),
          ...(line.completed ? { done: true, doneAt: Date.now() } : {}),
        }),
      );
      r.added += 1;
    };

    for (const day of days) {
      for (const line of day.events ?? []) applyLine('event', day.date, line, eventIds(realLabels(line.labels, '일정')));
      for (const line of day.records ?? []) applyLine('note', day.date, line, noteIds(realLabels(line.labels, '기록')));
      if (day.periods) {
        const cells = lessonsOn(day.date, d.lessons).cells;
        const merged: Record<string, unknown> = {};
        for (const [key, cellText] of Object.entries(day.periods)) {
          const cell = cells[Number(key) - 1];
          if (!cell) continue;
          if (cellText.subject === cell.subject && cellText.memo === cell.memo.trim() && cellText.supplies === cell.supplies.trim()) continue;
          const ch = editChanges(cell, cellText);
          if (ch) {
            Object.assign(merged, ch);
            r.lessons += 1;
          }
        }
        if (Object.keys(merged).length > 0) ops.push(writeOp.merge(lessonDayPath(d.sid, day.date), merged, d.lessonDays[day.date] ?? null));
      }
    }

    for (const m of memoRows) applyLine('note', null, { ...(m.id ? { id: m.id } : {}), content: m.text, completed: m.done }, noteIds(m.labels));

    if (include.evaluation) {
      const titles = (await listSheetTitles(token, id)).filter((t) => t.startsWith(EVAL_SHEET_PREFIX));
      const updates = [];
      for (const t of titles) {
        onStep?.(`[${t}]를 읽는 중…`);
        updates.push(...parseEvalRows(await readSheet(token, id, t)));
      }
      for (const ev of Object.values(d.evaluations)) {
        if (!live(ev)) continue;
        const ups = evalUpdatesFor(sheetEvalOf(ev, d.classes), updates);
        if (Object.keys(ups).length === 0) continue;
        const changes = Object.fromEntries(Object.entries(ups).map(([sid, v]) => [`values.${sid}`, Object.keys(v).length > 0 ? v : undefined]));
        ops.push(writeOp.patch({ sid: d.sid, coll: 'evaluations', id: ev.id }, changes, ev));
        r.evaluations += 1;
      }
    }

    onStep?.('앱에 적는 중…');
    for (let i = 0; i < ops.length; i += 400) {
      await batch(ops.slice(i, i + 400), { fail: '시트 내용을 다 적지 못했습니다. 다시 되읽으면 이미 들어간 것은 건너뜁니다.' });
    }
    return r;
  });
}

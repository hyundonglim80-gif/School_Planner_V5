// 구글 시트로 보내고 되읽기 - 순수 셈 (V4 lib/sheetsSync.ts의 칸 모양 그대로, P8-3). 시트 부르기는 data/google/sheets, 묶기는 features/backup/sheets.
//
//   '일정기록' 시트: 날짜 | 일정 | 1교시..N교시 | 기록 | 조사표 | 일정 메타데이터 (수정금지) | 기록 메타데이터 (수정금지)
//     일정·기록 한 줄 = '[v] [라벨, 라벨] 내용'([v] = 완료), 교시 한 칸 = '[과목] 메모 [준비물]', 조사표 칸 = 그날 조사표 제목(읽기만).
//     메타데이터 = 줄마다 V5 항목 id(JSON) - 되읽을 때 같은 항목으로 알아본다.
//   '메모' 시트: 데이터분류 | ID | 내용/이름 | 완료여부(O/X) | 라벨 | 주소/URL | 생성일자(타임스탬프)
//   '조사표_2026-5-2' 시트(학급마다): 머리말 여덟 줄(조사표 하나가 칸 여럿) + 학생 한 명이 한 줄 - 사람이 점수를 고치는 자리.
//
// V5는 **V5만의 시트 파일**에 쓴다(V4·V3가 함께 쓰는 시트를 덮지 않는다 - PLAN 5장 P8-3). 되읽기는 고치고 더하기만 - 시트에서 지운 줄은 앱에서 지우지 않는다.

export const SHEET_SCHEDULE = '일정기록';
export const SHEET_MEMO = '메모';
export const EVAL_SHEET_PREFIX = '조사표_';

export interface SheetsInclude {
  event: boolean;
  class: boolean;
  journal: boolean;
  evaluation: boolean;
  memo: boolean;
}

// ── 한 줄 ──

/** '[v] [회의, 공문] 학년 협의회' */
export function formatItemLine(content: string, labelNames: string[], completed: boolean, fallback: string): string {
  const labelStr = labelNames.length > 0 ? labelNames.join(', ') : fallback;
  return `${completed ? '[v] ' : ''}[${labelStr}] ${content}`;
}

export interface ParsedLine {
  content: string;
  labels: string[];
  completed: boolean;
}

export function parseItemLine(line: string): ParsedLine | null {
  let text = (line || '').trim();
  if (!text) return null;
  let completed = false;
  if (/^\[v\]/i.test(text)) {
    completed = true;
    text = text.slice(3).trim();
  }
  const match = text.match(/^\[(.*?)\]\s*(.*)$/);
  if (!match) return { content: text, labels: [], completed };
  return {
    content: match[2].trim(),
    labels: match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    completed,
  };
}

/** 시트에 적은 라벨 = 라벨이 없을 때 넣은 자리 글자('일정'·'기록')는 라벨이 아니다 */
export const realLabels = (labels: string[], fallback: string) => (labels.length === 1 && labels[0] === fallback ? [] : labels);

export interface PeriodCellText {
  subject: string;
  memo: string;
  supplies: string;
}

/** '[국어] 단원평가 [학습지]' */
export function formatPeriodCell(p: Partial<PeriodCellText> | null | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.subject?.trim()) parts.push(`[${p.subject.trim()}]`);
  if (p.memo?.trim()) parts.push(p.memo.trim());
  if (p.supplies?.trim()) parts.push(`[${p.supplies.trim()}]`);
  return parts.join(' ').trim();
}

export function parsePeriodCell(cell: string): PeriodCellText {
  let text = (cell || '').trim();
  if (!text) return { subject: '', memo: '', supplies: '' };
  let supplies = '';
  const brackets = text.match(/\[.*?\]/g);
  // 묶음이 둘 이상이면 마지막 것이 준비물이다
  if (brackets && brackets.length >= 2) {
    const last = text.match(/\[([^\]]+)\]\s*$/);
    if (last) {
      supplies = last[1].trim();
      text = text.replace(/\[([^\]]+)\]\s*$/, '').trim();
    }
  }
  const first = text.match(/^\[(.*?)\]/);
  if (first) return { subject: first[1].trim(), memo: text.replace(/^\[(.*?)\]\s*/, '').trim(), supplies };
  return { subject: '', memo: text, supplies };
}

// ── '일정기록' 시트 ──

export interface SheetLine {
  id: string;
  text: string;
  labels: string[];
  done: boolean;
}

export interface ScheduleDay {
  date: string;
  events: SheetLine[];
  /** 1교시부터 */
  periods: PeriodCellText[];
  records: SheetLine[];
  /** 그날 조사표 제목 (읽기만) */
  evals: string[];
}

export function buildScheduleRows(days: ScheduleDay[], include: SheetsInclude, periodNames: string[]): string[][] {
  const header = ['날짜'];
  if (include.event) header.push('일정');
  if (include.class) header.push(...periodNames);
  if (include.journal) header.push('기록');
  if (include.evaluation) header.push('조사표');
  if (include.event) header.push('일정 메타데이터 (수정금지)');
  if (include.journal) header.push('기록 메타데이터 (수정금지)');
  const rows: string[][] = [header];
  for (const d of days) {
    const row = [d.date];
    if (include.event) row.push(d.events.map((e) => formatItemLine(e.text, e.labels, e.done, '일정')).join('\n'));
    if (include.class) for (let i = 0; i < periodNames.length; i++) row.push(formatPeriodCell(d.periods[i]));
    if (include.journal) row.push(d.records.map((e) => formatItemLine(e.text, e.labels, e.done, '기록')).join('\n'));
    if (include.evaluation) row.push(d.evals.join('\n'));
    if (include.event) row.push(JSON.stringify(d.events.map((e) => ({ id: e.id }))));
    if (include.journal) row.push(JSON.stringify(d.records.map((e) => ({ id: e.id }))));
    rows.push(row);
  }
  return rows;
}

/** 되읽은 줄 - id가 없으면(시트에서 더한 줄) 새 항목 */
export interface ReadLine extends ParsedLine {
  id?: string;
}

export interface ReadDay {
  date: string;
  events?: ReadLine[];
  records?: ReadLine[];
  /** 교시 n → 칸 (시트에 그 열이 있을 때만) */
  periods?: Record<number, PeriodCellText>;
}

const readMeta = (cell: unknown): Array<{ id?: unknown }> => {
  const text = String(cell ?? '').trim();
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Array<{ id?: unknown }>) : [];
  } catch {
    return [];
  }
};

/** 시트에서 읽은 줄들 → 날마다 (머리말 이름으로 칸을 찾는다 - 교시는 남는 칸을 자리대로) */
export function parseScheduleRows(rows: unknown[][], include: SheetsInclude): ReadDay[] {
  if (!rows || rows.length < 2) return [];
  const header = rows[0].map((h) => String(h ?? ''));
  const findIdx = (test: (h: string) => boolean) => header.findIndex(test);
  const dateIdx = findIdx((h) => h.includes('날짜'));
  const eventIdx = findIdx((h) => h.includes('일정') && !h.includes('메타'));
  const journalIdx = findIdx((h) => h.includes('기록') && !h.includes('메타'));
  const eventMetaIdx = findIdx((h) => h.includes('일정 메타'));
  const journalMetaIdx = findIdx((h) => h.includes('기록 메타'));
  const evalIdx = findIdx((h) => h.trim() === '조사표');
  if (dateIdx === -1) return [];
  const known = new Set([dateIdx, eventIdx, journalIdx, eventMetaIdx, journalMetaIdx, evalIdx].filter((i) => i !== -1));
  const periodCols: number[] = [];
  for (let i = 0; i < header.length; i++) if (!known.has(i)) periodCols.push(i);

  const toLines = (text: unknown, metaCell: unknown): ReadLine[] => {
    const meta = readMeta(metaCell);
    return String(text ?? '')
      .split('\n')
      .map((line) => parseItemLine(line))
      .filter((p): p is ParsedLine => p !== null)
      .map((p, i) => {
        const id = meta[i]?.id;
        return typeof id === 'string' && id.trim() ? { ...p, id: id.trim() } : p;
      });
  };

  const out: ReadDay[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const date = String(row[dateIdx] ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day: ReadDay = { date };
    if (include.event && eventIdx !== -1) day.events = toLines(row[eventIdx], eventMetaIdx !== -1 ? row[eventMetaIdx] : '');
    if (include.journal && journalIdx !== -1) day.records = toLines(row[journalIdx], journalMetaIdx !== -1 ? row[journalMetaIdx] : '');
    if (include.class && periodCols.length > 0) {
      day.periods = {};
      periodCols.forEach((col, i) => (day.periods![i + 1] = parsePeriodCell(String(row[col] ?? ''))));
    }
    out.push(day);
  }
  return out;
}

// ── '조사표_학급' 시트 ──

const COL_GROUP_NAME = '조이름';
const COL_GROUP_SCORE = '조별결과';
const COL_INDIV_SCORE = '개별결과';
const COL_REASON = '미평가사유(메모)';
const COL_CHECK = '체크결과';
const COL_MEMO = '메모내용';

export interface SheetEval {
  id: string;
  date: string;
  period: number | null;
  classId: string;
  title: string;
  type: 'eval' | 'check' | 'memo';
  subject?: string;
  indiv?: boolean;
  group?: boolean;
  students: Array<{ sid: string; num: number; name: string; gender?: string }>;
  values: Record<string, { indiv?: string; group?: string; groupName?: string; checked?: boolean; reason?: string; memo?: string }>;
}

export type EvalValue = SheetEval['values'][string];

export const evalSheetNameOf = (classId: string) => `${EVAL_SHEET_PREFIX}${classId || '기타'}`;

function columnsOf(ev: SheetEval): string[] {
  if (ev.type === 'eval') {
    const cols: string[] = [];
    if (ev.group) cols.push(COL_GROUP_NAME, COL_GROUP_SCORE);
    if (ev.indiv || !ev.group) cols.push(COL_INDIV_SCORE);
    cols.push(COL_REASON);
    return cols;
  }
  if (ev.type === 'check') return [COL_CHECK, COL_REASON];
  return [COL_MEMO];
}

/** 학급 탭 하나 (조사표는 날짜·교시 차례). 학생은 번호와 이름을 함께 열쇠로(번호를 이어받은 학생을 한 줄로 묶지 않게) */
export function buildEvalRows(evals: SheetEval[]): string[][] {
  const studentMap = new Map<string, { num: number; name: string; gender?: string }>();
  for (const ev of evals) for (const st of ev.students) if (!studentMap.has(`${st.num} ${st.name}`)) studentMap.set(`${st.num} ${st.name}`, st);
  const students = [...studentMap.values()].sort((a, b) => a.num - b.num || a.name.localeCompare(b.name));
  const rows: string[][] = [
    ['상위 항목(조사표 제목)', '', ''],
    ['조사표 ID (수정금지)', '', ''],
    ['하위 항목(날짜)', '', ''],
    ['하위 항목(교시)', '', ''],
    ['하위 항목(유형)', '', ''],
    ['하위 항목(교과)', '', ''],
    ['하위 항목(방식)', '', ''],
    ['번호', '이름', '성별'],
  ];
  for (const ev of evals) {
    const cols = columnsOf(ev);
    const spread = (v: string) => [v, ...Array<string>(cols.length - 1).fill('')];
    rows[0].push(...spread(ev.title));
    rows[1].push(...spread(ev.id));
    rows[2].push(...spread(ev.date));
    rows[3].push(...spread(ev.period ? `${ev.period}교시` : ''));
    rows[4].push(...spread(ev.type === 'eval' ? '평가' : ev.type === 'check' ? '체크' : '메모'));
    rows[5].push(...spread(ev.subject ?? ''));
    rows[6].push(...spread(ev.type === 'eval' ? [ev.indiv || !ev.group ? '개인' : '', ev.group ? '조별' : ''].filter(Boolean).join(', ') : ''));
    rows[7].push(...cols);
  }
  for (const st of students) {
    const row = [String(st.num), st.name, st.gender ?? ''];
    for (const ev of evals) {
      const mine = ev.students.find((s) => s.num === st.num && s.name === st.name);
      const v: EvalValue = (mine && ev.values[mine.sid]) || {};
      const blank = !mine;
      if (ev.type === 'eval') {
        if (ev.group) row.push(blank ? '' : (v.groupName ?? ''), blank ? '' : (v.group ?? ''));
        if (ev.indiv || !ev.group) row.push(blank ? '' : (v.indiv ?? ''));
        row.push(blank ? '' : (v.reason ?? ''));
      } else if (ev.type === 'check') {
        row.push(blank ? '' : v.checked === true ? 'O' : v.checked === false ? 'X' : '', blank ? '' : (v.reason ?? ''));
      } else row.push(blank ? '' : (v.memo ?? ''));
    }
    rows.push(row);
  }
  return rows;
}

export interface EvalCellUpdate {
  evalId: string;
  num: number;
  name: string;
  col: string;
  value: string;
}

/** 학급 탭 → 학생별 칸 값 (id는 첫 칸에만 - 빈 칸은 바로 앞 조사표에 딸린다) */
export function parseEvalRows(rows: unknown[][]): EvalCellUpdate[] {
  const out: EvalCellUpdate[] = [];
  if (!rows || rows.length < 8) return out;
  const cell = (r: unknown[], c: number) => String(r[c] ?? '').trim();
  const idRow = rows.find((r) => cell(r, 0) === '조사표 ID (수정금지)');
  const headerRow = rows.find((r) => cell(r, 0) === '번호' && cell(r, 1) === '이름');
  if (!idRow || !headerRow) return out;
  const colMap: Record<number, { evalId: string; col: string }> = {};
  let current = '';
  for (let c = 3; c < headerRow.length; c++) {
    if (cell(idRow, c)) current = cell(idRow, c);
    if (current) colMap[c] = { evalId: current, col: cell(headerRow, c) };
  }
  for (const row of rows.slice(rows.indexOf(headerRow) + 1)) {
    const num = parseInt(cell(row, 0), 10);
    if (isNaN(num)) continue;
    const name = cell(row, 1);
    for (let c = 3; c < Math.max(row.length, headerRow.length); c++) {
      const m = colMap[c];
      if (m) out.push({ evalId: m.evalId, num, name, col: m.col, value: cell(row, c) });
    }
  }
  return out;
}

/**
 * 표에서 읽은 값 → 조사표 하나의 학생 칸 (바뀐 학생만: sid → 새 값). 짝이 없는 조사표·학생은 버린다.
 * 학생은 그 조사표 명단을 따라 맞춘다 - 번호와 이름이 같은 줄, 그 번호를 쓰는 줄이 하나뿐이면 이름이 달라도(시트에서 고쳤을 수 있다).
 */
export function evalUpdatesFor(ev: SheetEval, updates: readonly EvalCellUpdate[]): Record<string, EvalValue> {
  const mine = updates.filter((u) => u.evalId === ev.id);
  if (mine.length === 0) return {};
  const byNum = new Map<number, Map<string, Record<string, string>>>();
  for (const u of mine) {
    if (!byNum.has(u.num)) byNum.set(u.num, new Map());
    const names = byNum.get(u.num)!;
    if (!names.has(u.name)) names.set(u.name, {});
    names.get(u.name)![u.col] = u.value;
  }
  const out: Record<string, EvalValue> = {};
  for (const st of ev.students) {
    const names = byNum.get(st.num);
    if (!names) continue;
    const cells = names.get(st.name) ?? (names.size === 1 ? [...names.values()][0] : null);
    if (!cells) continue;
    // 빈 글자 칸은 없는 것과 같다 (견줄 때도)
    const before = Object.fromEntries(Object.entries(ev.values[st.sid] ?? {}).filter(([, v]) => v !== '' && v !== undefined)) as EvalValue;
    const next: EvalValue = { ...before };
    const set = (k: keyof EvalValue, v: string | undefined) => {
      if (v === undefined) return;
      if (v === '') delete next[k];
      else (next as Record<string, unknown>)[k] = v;
    };
    if (ev.type === 'eval') {
      set('groupName', cells[COL_GROUP_NAME]);
      set('group', cells[COL_GROUP_SCORE]);
      set('indiv', cells[COL_INDIV_SCORE]);
      set('reason', cells[COL_REASON]);
    } else if (ev.type === 'check') {
      const c = cells[COL_CHECK];
      if (c !== undefined) {
        if (c.toUpperCase() === 'O') next.checked = true;
        else if (c.toUpperCase() === 'X') next.checked = false;
        else delete next.checked;
      }
      set('reason', cells[COL_REASON]);
    } else set('memo', cells[COL_MEMO]);
    if (JSON.stringify(next) !== JSON.stringify(before)) out[st.sid] = next;
  }
  return out;
}

// ── '메모' 시트 ──

export interface SheetMemo {
  id: string;
  text: string;
  done: boolean;
  labels: string[];
  url: string;
  createdAt: number;
}

export function buildMemoRows(memos: SheetMemo[]): string[][] {
  const rows: string[][] = [['데이터분류', 'ID', '내용/이름', '완료여부(O/X)', '라벨', '주소/URL', '생성일자(타임스탬프)']];
  for (const m of memos) rows.push(['MEMO', m.id, m.text, m.done ? 'O' : 'X', m.labels.join(','), m.url, String(m.createdAt || '')]);
  return rows;
}

/** 메모 시트 → 메모 (V3가 같은 시트에 담던 링크(LINK) 줄은 뺀다). id가 비면 새 메모 */
export function parseMemoRows(rows: unknown[][]): Array<Omit<SheetMemo, 'url' | 'createdAt'>> {
  if (!rows || rows.length < 2) return [];
  const out: Array<Omit<SheetMemo, 'url' | 'createdAt'>> = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (String(row[0] ?? '').trim().toUpperCase() !== 'MEMO') continue;
    const text = String(row[2] ?? '').trim();
    if (!text) continue;
    out.push({
      id: String(row[1] ?? '').trim(),
      text,
      done: String(row[3] ?? '').trim().toUpperCase() === 'O',
      labels: String(row[4] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return out;
}

/** 시트 주소/id → id */
export function spreadsheetIdOf(input: string): string | null {
  const s = input.trim();
  const m = s.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(s) ? s : null;
}

export const sheetUrlOf = (spreadsheetId: string) => `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

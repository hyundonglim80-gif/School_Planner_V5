// V4 lib/journalEntries.ts·lib/moveEntry.ts journalLabelNames·lib/holiday.ts isHolidayEvent·lib/eventDue.ts dueOf·lib/periodBars.ts periodPieceOf에서 옮긴 읽기
// (DESIGN 8-1 '옛 모양 읽기는 여기에만'). V5 본체는 이것을 import하지 않는다(boundary.test).

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** 기록 문서(journals/{날짜})의 entries. id 없는 옛 기록에는 V4 화면과 같은 `jr_차례`를 붙인다 */
export function readJournalEntries(data: unknown): Record<string, unknown>[] {
  const raw = isObj(data) && Array.isArray(data.entries) ? (data.entries as unknown[]) : [];
  return raw.map((j, idx) =>
    isObj(j) && j.id !== undefined && j.id !== null && j.id !== '' ? j : { ...(isObj(j) ? j : {}), id: 'jr_' + idx, __idless: true },
  );
}

/** 기록 항목의 라벨 이름 (labelIds·label을 라벨 목록으로 푼다 - V4 DayJournal과 같은 규칙) */
export function journalLabelNames(entry: Record<string, unknown>, journalLabels: ReadonlyArray<{ id: string; name: string }>): string[] {
  const keys = [...(Array.isArray(entry.labelIds) ? entry.labelIds : []), ...(entry.label ? String(entry.label).split(',') : [])];
  const names: string[] = [];
  for (const key of keys) {
    const k = String(key ?? '').trim();
    if (!k) continue;
    const found = journalLabels.find((l) => l.id === k || l.name === k);
    if (found && !names.includes(found.name)) names.push(found.name);
  }
  return names;
}

const HOLIDAY_LABEL_NAMES = ['공휴일', '휴일'];

/** 공휴일 가져오기로 넣은 일정 (V4는 목록에서 감추고 날짜 옆 이름으로만 보였다) */
export function isHolidayEvent(ev: unknown): boolean {
  if (!isObj(ev)) return false;
  const names: string[] = [];
  if (ev.label) names.push(...String(ev.label).split(',').map((x) => x.trim()));
  if (Array.isArray(ev.labelIds)) names.push(...ev.labelIds.map((x) => String(x)));
  return names.some((n) => HOLIDAY_LABEL_NAMES.includes(n));
}

export const isDueDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** settings/v4_eventDue의 dues: { [이월 사슬 id]: 'YYYY-MM-DD' } */
export function sanitizeDueMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (isDueDate(v)) out[k] = v;
  return out;
}

/** 일정의 기한: 일정의 due → ''이면 뗀 것 → 이월 사슬의 기한 (V4 lib/eventDue dueOf) */
export function dueOf(ev: Record<string, unknown>, map: Record<string, string>): string {
  if (isDueDate(ev.due)) return ev.due;
  if (ev.due === '') return '';
  const chain = typeof ev.forwardChainId === 'string' ? ev.forwardChainId : '';
  return chain && isDueDate(map[chain]) ? map[chain] : '';
}

const PIECE_SUFFIX = /^(.*\S)\s*\((\d+)\/(\d+)\)\s*$/s;

/** 기간 일정의 조각 ('기말고사 (2/5)' + groupId)이면 그 정보 (V4 lib/periodBars periodPieceOf) */
export function periodPieceOf(ev: Record<string, unknown>, content: string): { key: string; base: string; index: number; total: number } | null {
  const groupId = ev.groupId;
  if (!groupId) return null;
  const m = String(content || '').match(PIECE_SUFFIX);
  if (!m) return null;
  const index = Number(m[2]);
  const total = Number(m[3]);
  if (!(total >= 2) || !(index >= 1) || index > total) return null;
  const base = m[1].trim();
  return { key: `${groupId}|${base}|${total}`, base, index, total };
}

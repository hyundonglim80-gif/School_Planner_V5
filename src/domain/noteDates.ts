// 메모의 날짜 링크 (P10-3 - 메모 하나로). 메모 하나에 날짜를 여러 개 달면 그 날마다 하루 '메모' 칸에 보인다.
//
// - 자료: `dates`(날짜 링크, 차례대로·겹침 없이) + `date`(= 가장 이른 날, 없으면 null - 색인·처음 받기 순서용).
//   **날짜가 둘 이상일 때만** `dates`를 적는다 - 하나면 `date`만(옛 기록과 같은 모양, 다시 가져오기 지문도 그대로).
// - 옛 기록(날짜 하나 `date`)은 고치지 않아도 '날짜 링크 하나인 메모'로 읽는다 - 자료 옮기기 없음(PLAN 5장 P10).
import { isValidDateStr } from './dateUtils';

type YMD = string;

export interface Dated {
  date?: YMD | null;
  dates?: readonly YMD[];
}

/** 그 메모의 날짜 링크 (차례대로). 옛 기록은 date 하나 */
export function noteDates(n: Dated): YMD[] {
  if (n.dates && n.dates.length > 0) return [...n.dates];
  return n.date ? [n.date] : [];
}

/** 맞는 날짜만·겹침 없이·차례대로 */
export function cleanDates(list: readonly string[]): YMD[] {
  return [...new Set(list.filter((d) => isValidDateStr(d)))].sort();
}

/** 날짜 링크 → 적을 칸 (date = 가장 이른 날, dates = 둘 이상일 때만) */
export function datesFields(list: readonly string[]): { date: YMD | null; dates?: YMD[] } {
  const clean = cleanDates(list);
  return clean.length > 1 ? { date: clean[0], dates: clean } : { date: clean[0] ?? null };
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/** 고친 날짜 링크 → 바뀐 칸만 (같으면 빈 객체). dates를 걷을 때는 undefined(저장 도우미가 지운다) */
export function datesChanges(item: Dated, list: readonly string[]): { date?: YMD | null; dates?: YMD[] | undefined } {
  const next = datesFields(list);
  if (same(noteDates(item), noteDates(next))) return {};
  const out: { date?: YMD | null; dates?: YMD[] | undefined } = {};
  if ((item.date ?? null) !== next.date) out.date = next.date;
  if (next.dates) out.dates = next.dates;
  else if (item.dates) out.dates = undefined;
  return out;
}

/** 그 날에 이은 메모인가 */
export const hasNoteDate = (n: Dated, date: YMD) => noteDates(n).includes(date);

/** 기간 [from, to] 안의 날짜 링크 */
export const noteDatesIn = (n: Dated, from: YMD, to: YMD) => noteDates(n).filter((d) => from <= d && d <= to);

/** 날짜 칩에 날짜 하나 더하기·빼기 (차례대로) */
export const addNoteDate = (list: readonly string[], date: YMD) => cleanDates([...list, date]);
export const removeNoteDate = (list: readonly string[], date: YMD) => list.filter((d) => d !== date);

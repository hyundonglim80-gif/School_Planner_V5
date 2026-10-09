// 교시 이름·시각 (V4 lib/periodTimes.ts - V4 테스트째). 하루 화면에서 '지금 몇 교시'를 짚고, 쉬는 시간에는 다음 교시를 알려 준다.
//
// V5 저장: 계정에 하나인 설정 `settings/common.periods` = [{ n, name, start, end }] (V4 '수업 시간 명칭' + v4_periodTimes를 하나로 - DESIGN 4-5).
// 교시 수 = 목록 길이. 시각을 적지 않은 교시는 없는 것으로 본다 - 아무것도 적지 않았으면 화면에 아무것도 보이지 않는다.

export interface PeriodTime {
  /** "HH:MM" (24시간) */
  start: string;
  end: string;
}

/** 교시 번호("1"…) → 시각 */
export type PeriodTimes = Record<string, PeriodTime>;

/** "9:05"·"09:05"·"0905"·"905" → 545 (분). 알아볼 수 없으면 null */
export function toMinutes(text: string | undefined | null): number | null {
  const t = String(text ?? '').trim();
  if (!t) return null;
  let h: number;
  let m: number;
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  const digits = /^(\d{3,4})$/.exec(t);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (digits) {
    h = Number(t.slice(0, t.length - 2));
    m = Number(t.slice(-2));
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 545 → "09:05" */
export function fromMinutes(total: number): string {
  const n = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

/** 시작·끝을 모두 알아볼 수 있고 끝이 시작보다 늦은 교시만 남겨, 시작 순으로 */
export function validPeriods(times: PeriodTimes | undefined | null, count?: number) {
  const list: Array<{ period: number; start: number; end: number }> = [];
  for (const [key, t] of Object.entries(times || {})) {
    const period = Number(key);
    if (!Number.isInteger(period) || period < 1) continue;
    if (count !== undefined && period > count) continue;
    const start = toMinutes(t?.start);
    const end = toMinutes(t?.end);
    if (start === null || end === null || end <= start) continue;
    list.push({ period, start, end });
  }
  return list.sort((a, b) => a.start - b.start);
}

/** 화면에 적는 시각 범위. 시각이 없거나 알아볼 수 없으면 '' */
export function periodRangeLabel(times: PeriodTimes | undefined | null, period: number): string {
  const t = times?.[String(period)];
  const s = toMinutes(t?.start);
  const e = toMinutes(t?.end);
  if (s === null) return '';
  return e === null || e <= s ? fromMinutes(s) : `${fromMinutes(s)}~${fromMinutes(e)}`;
}

export type PeriodState =
  /** 첫 교시 전. next 교시까지 minutes분 */
  | { kind: 'before'; next: number; minutes: number }
  /** period 교시 중. 끝나기까지 minutesLeft분 */
  | { kind: 'during'; period: number; minutesLeft: number }
  /** 쉬는 시간(점심 포함). next 교시까지 minutes분 */
  | { kind: 'break'; next: number; minutes: number }
  /** 마지막 교시가 끝났다 */
  | { kind: 'after' };

/** 그 시각에 몇 교시인가. 교시 시각을 하나도 적지 않았으면 null */
export function periodStateAt(times: PeriodTimes | undefined | null, now: Date, count?: number): PeriodState | null {
  const list = validPeriods(times, count);
  if (list.length === 0) return null;
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < list[0].start) return { kind: 'before', next: list[0].period, minutes: list[0].start - m };
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (m >= p.start && m < p.end) return { kind: 'during', period: p.period, minutesLeft: p.end - m };
    const nextP = list[i + 1];
    if (nextP && m >= p.end && m < nextP.start) return { kind: 'break', next: nextP.period, minutes: nextP.start - m };
  }
  return { kind: 'after' };
}

export interface FillOptions {
  /** 몇 교시까지 */
  count: number;
  /** 1교시 시작 "HH:MM" */
  firstStart: string;
  /** 수업 길이(분) - 초등 40, 중학교 45, 고등학교 50이 흔하다 */
  classMinutes: number;
  /** 쉬는 시간(분) */
  breakMinutes: number;
  /** 몇 교시 뒤에 점심인가 (0이면 점심 없음) */
  lunchAfter: number;
  /** 점심 시간(분) */
  lunchMinutes: number;
}

/** 1교시 시작과 수업·쉬는 시간·점심으로 모든 교시 시각을 채운다. 1교시 시작을 알아볼 수 없으면 null */
export function fillPeriodTimes(o: FillOptions): PeriodTimes | null {
  let cur = toMinutes(o.firstStart);
  if (cur === null || o.count < 1 || o.classMinutes < 1) return null;
  const out: PeriodTimes = {};
  for (let p = 1; p <= o.count; p++) {
    out[String(p)] = { start: fromMinutes(cur), end: fromMinutes(cur + o.classMinutes) };
    cur += o.classMinutes + (p === o.lunchAfter ? Math.max(0, o.lunchMinutes) : Math.max(0, o.breakMinutes));
  }
  return out;
}

// ── V5: 설정 칸 periods ──

/** 교시 하나 (n = 1부터 차례) */
export interface PeriodDef {
  n: number;
  name: string;
  /** "HH:MM" 또는 '' */
  start: string;
  end: string;
}

export const MAX_PERIODS = 12;

export const defaultPeriodName = (n: number) => `${n}교시`;

/** 처음 교시 - 1~6교시, 시각 없음 (V4 DEFAULT_NAMES) */
export const DEFAULT_PERIODS: PeriodDef[] = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, name: defaultPeriodName(i + 1), start: '', end: '' }));

/** 설정 문서 값 → 교시 목록 (틀린 모양이면 undefined = 기본값). n은 차례대로 다시 매긴다 */
export function readPeriods(v: unknown): PeriodDef[] | undefined {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_PERIODS) return undefined;
  return v.map((p, i) => {
    const r = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
    return { n: i + 1, name: str(r.name) || defaultPeriodName(i + 1), start: str(r.start), end: str(r.end) };
  });
}

/** 교시 목록 → 시각 표 (위 함수들이 받는 모양) */
export function timesOf(periods: readonly PeriodDef[]): PeriodTimes {
  const out: PeriodTimes = {};
  for (const p of periods) if (p.start || p.end) out[String(p.n)] = { start: p.start, end: p.end };
  return out;
}

/** n교시의 이름 (목록 밖이면 'n교시') */
export function periodLabel(periods: readonly PeriodDef[], n: number): string {
  return periods[n - 1]?.name || defaultPeriodName(n);
}

/** 교시 하나 더하기·빼기 (끝에서 - 1~12교시) */
export function addPeriod(periods: readonly PeriodDef[]): PeriodDef[] {
  if (periods.length >= MAX_PERIODS) return [...periods];
  const n = periods.length + 1;
  return [...periods, { n, name: defaultPeriodName(n), start: '', end: '' }];
}
export const removePeriod = (periods: readonly PeriodDef[]): PeriodDef[] => (periods.length <= 1 ? [...periods] : periods.slice(0, -1));

// V4 설정 → V5 settings (DESIGN 8-3). 순수 함수 - 읽기는 read.ts, 적기는 run.ts.
//
//   V4 settings/v4_preferences_pc     → settings/pc       (칸 이름이 같다 - 단축키 id도 그대로라 바꾼 키가 이어진다)
//   V4 settings/v4_preferences_mobile → settings/mobile
//   V4 settings/v4_preferences        → 위 둘이 없을 때 (기기별로 나누기 전의 한 벌 - V4도 그것을 옮겨 왔다)
//   V4 forwardLookbackDays(기기마다)   → settings/common.forwardDays (계정에 하나 - PC 값 먼저)
//   V4 v4_teaching·v4_classBell·v4_school → common.teaching·classBell·school (P6-4 - 모양이 같다)
//   V4 timetable_v5.currentNames(없으면 첫 표의 names) + v4_periodTimes.times → common.periods (교시 이름·시각)
//   V4 timetable_v5.semesterConfig(한 벌) → common.terms[여름 방학이 든 학년도] (방학만 - 학기는 셈한다)
// 자동 백업은 V5에 그 칸이 생기는 세션이 이 표에 더한다(COMMON_FROM_V4). D-Day·개인 공휴일은 P5-3, 휴지통 자동 비우기는 P5-4, 관찰 문구는 P7-5.
//
// **칸마다** 견준다 - 설정 문서는 기본값과 다른 칸만 적고(DESIGN 4-8), 사용자가 V5에서 몇 칸만 바꿨을 수 있다.
//   prev = 가져오기가 지난번에 그 칸에 적은 값(기록 settings - 없으면 '적은 적 없음' = 기본값)
//   지금 V5 값 ≠ prev → V5에서 바꾼 칸 → 둔다(V4 값이 다르면 '둠')
//   그 밖 → V4 값으로(다르면 '바뀜', 기본값이면 칸을 뺀다)
// V4에 그 문서가 없으면 그 문서는 건너뛴다(가져올 것이 없다 - V5 값을 기본값으로 되돌리지 않는다).
import { COMMON_SETTINGS, DEVICE_PREFS } from '../../app/prefs';
import { readSettings, sparseSettings, type SettingsSpec } from '../../domain/settings';
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { DocPath } from '../../data/types';
import { sameValue } from './hash';
import { emptyCounts, tally, type ImportCounts } from './plan';

type Fields = Record<string, unknown>;

/** 읽어 온 V4 설정 문서들 (없는 문서는 undefined) */
export interface V4PrefDocs {
  pc?: unknown;
  mobile?: unknown;
  legacy?: unknown;
  /** settings/preferences - V3·V4가 함께 쓰는 문서 (dDayList·selectedDDayId) */
  shared?: unknown;
  /** settings/holidays - V3가 사람마다 받아 둔 공휴일 표 ({ map: { 날짜: 이름 } }) */
  holidays?: unknown;
  /** settings/v4_trash - 휴지통 자동 비우기 ({ retentionDays }) */
  trash?: unknown;
  /** settings/v4_teaching·v4_classBell·v4_school (P6-4) */
  teaching?: unknown;
  classBell?: unknown;
  school?: unknown;
  /** settings/v4_observationPhrases ({ phrases }) - P7-5 */
  phrases?: unknown;
  /** settings/timetable_v5 (교시 이름·방학) · v4_periodTimes (교시 시각) */
  timetable?: unknown;
  periodTimes?: unknown;
}

export type SettingsDocId = 'pc' | 'mobile' | 'common';

const obj = (v: unknown): Fields | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Fields) : undefined);

/** V4 문서들 → V5 common 칸의 V4 값 (칸 이름이 다른 것). 칸이 생기는 세션이 더한다 */
const COMMON_FROM_V4: Record<string, (v4: V4PrefDocs) => unknown> = {
  forwardDays: (v4) => [v4.pc, v4.legacy, v4.mobile].map((d) => obj(d)?.forwardLookbackDays).find((v) => v !== undefined && v !== null),
  ddays: (v4) => obj(v4.shared)?.dDayList,
  ddayPick: (v4) => obj(v4.shared)?.selectedDDayId,
  myHolidays: (v4) => obj(v4.holidays)?.map,
  trashDays: (v4) => obj(v4.trash)?.retentionDays,
  teaching: (v4) => obj(v4.teaching),
  classBell: (v4) => obj(v4.classBell),
  school: (v4) => obj(v4.school),
  periods: (v4) => periodsFromV4(v4.timetable, v4.periodTimes),
  terms: (v4) => termsFromV4(v4.timetable),
  phrases: (v4) => obj(v4.phrases)?.phrases,
};

/** 교시 이름(timetable_v5.currentNames, 없으면 첫 표) + 시각(v4_periodTimes.times) → V5 교시. 둘 다 없으면 undefined */
export function periodsFromV4(timetable: unknown, periodTimes: unknown): Array<{ n: number; name: string; start: string; end: string }> | undefined {
  const t = obj(timetable);
  const firstTemplate = obj(Object.values(obj(t?.templates) ?? {})[0]);
  const names = (Array.isArray(t?.currentNames) ? t.currentNames : Array.isArray(firstTemplate?.names) ? firstTemplate.names : null) as unknown[] | null;
  const times = obj(obj(periodTimes)?.times);
  if (!names && !times) return undefined;
  const count = Math.max(names?.length ?? 0, ...Object.keys(times ?? {}).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12), 0) || 6;
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const time = obj(times?.[String(n)]);
    const name = typeof names?.[i] === 'string' && (names[i] as string).trim() ? (names[i] as string).trim() : `${n}교시`;
    return { n, name, start: typeof time?.start === 'string' ? time.start : '', end: typeof time?.end === 'string' ? time.end : '' };
  });
}

/** V4 방학 설정 한 벌 → { 학년도: { summer, winter } } (여름 방학이 든 학년도). 없으면 undefined */
export function termsFromV4(timetable: unknown): Record<string, unknown> | undefined {
  const c = obj(obj(timetable)?.semesterConfig);
  const d = (k: string) => (typeof c?.[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c[k] as string) ? (c[k] as string) : '');
  if (!c || !d('summerStart')) return undefined;
  const span = (a: string, b: string) => (d(a) && d(b) ? { from: d(a), to: d(b) } : undefined);
  const y = Number(d('summerStart').slice(0, 4)) - (Number(d('summerStart').slice(5, 7)) >= 3 ? 0 : 1);
  const summer = span('summerStart', 'summerEnd');
  const winter = span('winterStart', 'winterEnd');
  return { [String(y)]: { ...(summer ? { summer } : {}), ...(winter ? { winter } : {}) } };
}

/** V4 문서들 → V5 설정 문서마다 V4가 보던 값(문서 모양 - 아직 다듬지 않은 것). V4에 없으면 null */
export function v4SettingsDocs(v4: V4PrefDocs): Record<SettingsDocId, Fields | null> {
  const pc = obj(v4.pc) ?? obj(v4.legacy) ?? null;
  const mobile = obj(v4.mobile) ?? obj(v4.legacy) ?? null;
  const common: Fields = {};
  for (const [field, from] of Object.entries(COMMON_FROM_V4)) {
    const v = from(v4);
    if (v !== undefined) common[field] = v;
  }
  return { pc, mobile, common: Object.keys(common).length > 0 ? common : null };
}

const SPECS: Record<SettingsDocId, SettingsSpec<Record<string, unknown>>> = {
  pc: DEVICE_PREFS as unknown as SettingsSpec<Record<string, unknown>>,
  mobile: DEVICE_PREFS as unknown as SettingsSpec<Record<string, unknown>>,
  common: COMMON_SETTINGS as unknown as SettingsSpec<Record<string, unknown>>,
};

export interface SettingsPlan {
  ops: WriteOp[];
  /** 칸 수 (V4·V5 어느 쪽에도 값이 없는 칸은 세지 않는다) */
  counts: ImportCounts;
  /** 이번에 기록에 남길 '가져오기가 적은 값' (문서마다) */
  written: Record<string, Fields>;
}

/**
 * V4 설정 → 쓰기 묶음.
 *   current = 지금 V5 설정 문서들 (없으면 null - 서버에서 읽은 것)
 *   prev    = 기록의 settings (가져오기가 지난번에 칸마다 적은 값)
 */
export function planSettings(
  sid: string,
  v4: V4PrefDocs,
  current: Partial<Record<SettingsDocId, Fields | null>>,
  prev: Record<string, Fields> = {},
): SettingsPlan {
  const ops: WriteOp[] = [];
  const counts = emptyCounts();
  const written: Record<string, Fields> = { ...prev };
  const fromV4 = v4SettingsDocs(v4);

  for (const id of ['pc', 'mobile', 'common'] as const) {
    const src = fromV4[id];
    if (!src) continue;
    const spec = SPECS[id];
    const want = sparseSettings(spec, readSettings(spec, src)) as Fields;
    const curDoc = current[id] ?? null;
    const cur = sparseSettings(spec, readSettings(spec, curDoc)) as Fields;
    const before = prev[id] ?? {};
    const next: Fields = {};
    const wrote: Fields = {};
    for (const field of Object.keys(spec)) {
      const c = cur[field];
      const p = before[field];
      const w = want[field];
      if (!sameValue(c, p)) {
        // V5에서 바꾼 칸
        if (c !== undefined) next[field] = c;
        if (p !== undefined) wrote[field] = p;
        if (!sameValue(w, c)) tally(counts, 'kept');
        else tally(counts, 'same');
        continue;
      }
      if (w !== undefined) {
        next[field] = w;
        wrote[field] = w;
      }
      if (!sameValue(w, c)) tally(counts, 'changed');
      else if (w !== undefined) tally(counts, 'same');
    }
    written[id] = wrote;
    if (!sameValue(next, cur)) {
      const at: DocPath<'settings'> = { sid, coll: 'settings', id };
      ops.push(writeOp.put(at, next, curDoc));
    }
  }
  return { ops, counts, written };
}

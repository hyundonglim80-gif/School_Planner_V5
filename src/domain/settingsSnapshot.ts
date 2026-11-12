// 내 '초기화 설정' 묶음 (P33-2 - PLAN 5장 'P33' ④~⑧). 지금 보기·쓰는 법 설정을 한 묶음으로 저장해 두고, '초기화'가 그 값으로 간다.
//
//   묶음 = { common, pc?: { prefs, local, at }, mobile?: … } - 칸마다 **기본값과 다른 것만**(설정 문서와 같은 규칙 - 없는 칸 = 앱 기본값).
//     common = 계정 칸 가운데 보기·쓰는 법(이월 기간·휴지통·알림 소리·색 테마·색약 배려·꾸미기)
//     prefs  = 기기 칸(설정 문서 pc|mobile) - 글자 크기·창 위치·시작 화면·단축키 넷·주말/일정/학급 표시·스크롤 이동
//     local  = 이 기기에만 두는 것 - 화면 비율(한눈에 경계선 셋·오른쪽/왼쪽 칸 폭)·밝기·고대비·부드럽게·머리줄 접기·메모 카드/목록·정렬·년간 보기·작년 이맘때
//   빼는 것 = 사람마다 다른 자료(학교·교사 유형·교시·방학·수업 종·D-Day·개인 공휴일·사진 폴더·관찰 문구·자동 백업·띠 닫음·새 학년도)와 학기 칩(때를 따른다).
//   기기 종류마다 따로(⑤): PC에서 저장하면 PC 몫 + 계정 몫만 바뀌고 휴대폰 몫은 그대로.
//
//   '초기화'가 가는 값(⑧) = 내 묶음 → 없으면 관리자 묶음(P33-3 sharedConfig/initialSettings) → 없으면 앱 기본값. 몫마다 고른다 -
//   칸마다 고르면 안 된다: 내 묶음은 앱 기본과 같은 칸을 적지 않으므로, 빠진 칸을 관리자 값으로 채우면 일부러 기본으로 둔 칸이 바뀐다.
//
// 기기·계정 칸의 표(DEVICE_PREFS·COMMON_SETTINGS)는 app/prefs가 가진다 - 여기는 받은 표에서 고른 칸만 쓴다(순수 - 서버·store 없이 시험).
import { boolField, customField, oneOfField, readSettings, sparseSettings, type SettingsSpec } from './settings';

export type DeviceSort = 'pc' | 'mobile';
export type Fields = Record<string, unknown>;

/** 묶음에 드는 기기 칸 (설정 문서 pc|mobile). 학기 칩(semesterFilter·At)은 때를 따라 뺀다 */
export const RESET_DEVICE_KEYS = [
  'fontSizes',
  'popupStyle',
  'startupScope',
  'shortcutOverrides',
  'tabShortcuts',
  'customShortcuts',
  'pressTargets',
  'showWeekend',
  'showEvents',
  'showClass',
  'enableScrollNav',
] as const;

/** 묶음에 드는 계정 칸 (설정 문서 common) - 보기·쓰는 법만 */
export const RESET_COMMON_KEYS = ['forwardDays', 'trashDays', 'alarmSound', 'palette', 'cvd', 'decor'] as const;

/** 메모 화면 정렬 기준 (features/memo/memoSort MEMO_SORT_OPTIONS와 같다 - 시험이 견준다) */
export const MEMO_SORT_KEYS = ['manual', 'modified', 'created', 'title', 'label', 'date', 'size'] as const;

/** 이 기기에만 두는 것 (계정에 올리지 않는다 - 각 store의 localStorage) */
export interface LocalPrefs {
  /** 한눈에 경계선 셋 (app/boardPrefs - %, null = 기본) */
  boardMain: number | null;
  boardDay: number | null;
  boardMemo: number | null;
  /** 오른쪽 칸·왼쪽 클립보드 칸 폭 (app/layoutPrefs - px, null = 기본) */
  rightPanelWidth: number | null;
  leftPanelWidth: number | null;
  /** 화면 밝기 (app/theme - 정하지 않았으면 어둡게) */
  theme: 'light' | 'dark' | 'system';
  /** 고대비·어둡게를 부드럽게 (app/viewAids) */
  contrast: boolean;
  dim: boolean;
  /** 머리줄 접기 (app/headerFold) */
  headerFold: boolean;
  /** 메모 화면 카드/목록·정렬 (features/memo) */
  memoView: 'card' | 'list';
  memoSortKey: (typeof MEMO_SORT_KEYS)[number];
  memoSortDir: 'asc' | 'desc';
  /** 년간 보기 (features/year/prefs) */
  yearView: 'sheet' | 'detail';
  /** 주간 작년 이맘때 (features/week/prefs) */
  lastYear: boolean;
}

const ratioField = customField<number | null>(null, (v) => (v === null ? null : typeof v === 'number' && v >= 5 && v <= 95 ? v : undefined));
const widthField = customField<number | null>(null, (v) =>
  v === null ? null : typeof v === 'number' && Number.isFinite(v) && v >= 100 && v <= 10000 ? Math.round(v) : undefined,
);

export const LOCAL_PREFS: SettingsSpec<LocalPrefs> = {
  boardMain: ratioField,
  boardDay: ratioField,
  boardMemo: ratioField,
  rightPanelWidth: widthField,
  leftPanelWidth: widthField,
  theme: oneOfField<LocalPrefs['theme']>('dark', ['light', 'dark', 'system']),
  contrast: boolField(false),
  dim: boolField(false),
  headerFold: boolField(false),
  memoView: oneOfField<LocalPrefs['memoView']>('card', ['card', 'list']),
  memoSortKey: oneOfField<LocalPrefs['memoSortKey']>('manual', MEMO_SORT_KEYS),
  memoSortDir: oneOfField<LocalPrefs['memoSortDir']>('asc', ['asc', 'desc']),
  yearView: oneOfField<LocalPrefs['yearView']>('sheet', ['sheet', 'detail']),
  lastYear: boolField(false),
};

export interface DeviceSnapshot {
  /** 기기 칸 (기본과 다른 것만) */
  prefs: Fields;
  /** 이 기기에만 두는 것 (기본과 다른 것만) */
  local: Fields;
  /** 저장한 때 (ms - 보여 주기만) */
  at: number;
}

export interface SettingsSnapshot {
  /** 계정 칸 (기본과 다른 것만) */
  common: Fields;
  /** 계정 칸을 저장한 때 (ms) */
  at: number;
  pc?: DeviceSnapshot;
  mobile?: DeviceSnapshot;
}

/** 기기·계정 칸의 표 (app/prefs DEVICE_PREFS·COMMON_SETTINGS) */
export interface SnapshotSpecs {
  device: SettingsSpec<Fields>;
  common: SettingsSpec<Fields>;
}

/** 표에서 고른 칸만 (표에 없는 칸은 빠진다) */
function subSpec(spec: SettingsSpec<Fields>, keys: readonly string[]): SettingsSpec<Fields> {
  const out: SettingsSpec<Fields> = {};
  for (const k of keys) if (spec[k]) out[k] = spec[k];
  return out;
}

const deviceSpec = (specs: SnapshotSpecs) => subSpec(specs.device, RESET_DEVICE_KEYS);
const commonSpec = (specs: SnapshotSpecs) => subSpec(specs.common, RESET_COMMON_KEYS);
const localSpec = LOCAL_PREFS as unknown as SettingsSpec<Fields>;

/** 지금 값 (모든 칸) */
export interface CurrentValues {
  device: Fields;
  common: Fields;
  local: LocalPrefs;
}

/** 고른 칸만 · 그 표에서 기본과 다른 것만 (sparseSettings - 문서와 같은 규칙) */
const sparsePick = (spec: SettingsSpec<Fields>, values: Fields): Fields => sparseSettings(spec, readSettings(spec, values));

/**
 * 지금 값을 이 기기 종류 묶음에 넣는다 - 계정 몫과 이 기기 종류 몫만 바꾸고 다른 종류 몫은 그대로(⑤).
 * 지금 값도 읽기를 지나게 한다(틀린 값이 섞여 있으면 기본으로 - 묶음에 적지 않는다).
 */
export function saveIntoSnapshot(prev: SettingsSnapshot | null, kind: DeviceSort, specs: SnapshotSpecs, now: CurrentValues, at: number): SettingsSnapshot {
  const part: DeviceSnapshot = {
    prefs: sparsePick(deviceSpec(specs), now.device),
    local: sparsePick(localSpec, now.local as unknown as Fields),
    at,
  };
  const out: SettingsSnapshot = { common: sparsePick(commonSpec(specs), now.common), at };
  const other: DeviceSort = kind === 'pc' ? 'mobile' : 'pc';
  if (prev?.[other]) out[other] = prev[other];
  out[kind] = part;
  return out;
}

const isObj = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v);
const atOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function readDevicePart(v: unknown, specs: SnapshotSpecs): DeviceSnapshot | undefined {
  if (!isObj(v)) return undefined;
  return {
    prefs: sparsePick(deviceSpec(specs), isObj(v.prefs) ? v.prefs : {}),
    local: sparsePick(localSpec, isObj(v.local) ? v.local : {}),
    at: atOf(v.at),
  };
}

/** 문서 → 묶음. 모르는 칸·틀린 값은 버린다(그 칸은 앱 기본). 묶음 모양이 아니면(계정 몫이 없다) null */
export function readSnapshot(data: unknown, specs: SnapshotSpecs): SettingsSnapshot | null {
  if (!isObj(data) || !isObj(data.common)) return null;
  const out: SettingsSnapshot = { common: sparsePick(commonSpec(specs), data.common), at: atOf(data.at) };
  for (const kind of ['pc', 'mobile'] as const) {
    const part = readDevicePart(data[kind], specs);
    if (part) out[kind] = part;
  }
  return out;
}

/** 묶음 → 문서에 적을 것 (빈 몫은 적지 않는다) */
export function snapshotDoc(s: SettingsSnapshot): Fields {
  const out: Fields = { common: s.common, at: s.at };
  for (const kind of ['pc', 'mobile'] as const) if (s[kind]) out[kind] = s[kind];
  return out;
}

export type ResetSource = 'mine' | 'admin' | 'app';

/** '초기화'가 가는 값 (모든 칸이 찬 값) + 어디서 왔나 */
export interface ResetValues {
  device: Fields;
  common: Fields;
  local: LocalPrefs;
  /** 기기 몫(prefs·local)이 어디서 왔나 */
  deviceFrom: ResetSource;
  /** 계정 몫이 어디서 왔나 */
  commonFrom: ResetSource;
}

/**
 * 그 기기 종류가 '초기화'로 갈 값 (⑧): 몫마다 내 것 → 관리자 것 → 앱 기본.
 * 기기 몫(prefs + local)은 그 기기 종류 몫이 있는 묶음, 계정 몫은 묶음이 있으면 그 묶음의 것.
 */
export function resolveResetValues(kind: DeviceSort, specs: SnapshotSpecs, mine: SettingsSnapshot | null, admin: SettingsSnapshot | null): ResetValues {
  const devicePart = mine?.[kind] ? { from: 'mine' as const, part: mine[kind] } : admin?.[kind] ? { from: 'admin' as const, part: admin[kind] } : null;
  const commonPart = mine ? { from: 'mine' as const, part: mine.common } : admin ? { from: 'admin' as const, part: admin.common } : null;
  return {
    device: readSettings(deviceSpec(specs), devicePart?.part.prefs ?? {}),
    local: readSettings(LOCAL_PREFS, devicePart?.part.local ?? {}),
    common: readSettings(commonSpec(specs), commonPart?.part ?? {}),
    deviceFrom: devicePart?.from ?? 'app',
    commonFrom: commonPart?.from ?? 'app',
  };
}

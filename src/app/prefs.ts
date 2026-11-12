// 계정에 붙여 두는 설정 (DESIGN 4-8, V4 lib/preferenceSync.ts). 값이 사는 곳은 그대로 두고(화면 토글은 nav, 글자 크기·창 위치는
// layoutPrefs, 바꾼 키는 keys) 여기서 어느 값을 어느 문서에 두는지만 정한다. 이 기기 사본은 각 store의 localStorage다 -
// 열자마자 그 값으로 그리고(글자 크기가 튀지 않게), 서버 값이 오면 바꾼다.
//
//   pc / mobile : 기기 종류마다. 휴대폰에서 글자를 키우거나 주말을 감춘 것이 PC까지 따라오면 곤란하다(V4).
//   common      : 계정에 하나. 그 기능을 옮기는 세션이 칸을 더한다(이월 기간 P3-3, 교사 유형 P6-1 …).
//
// 넣지 않는 것: 지금 보는 화면·날짜(설정이 아니라 '어디까지 봤나'), 화면 밝기(기기마다 다르게 쓴다 - V4 그대로. 색 테마는 common - P20-1),
// 오른쪽 칸 폭(이 기기 화면 크기에 따른다).
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { readFontSizes, type FontSizes } from '../domain/fontScale';
import { DEFAULT_DECOR } from '../domain/decor';
import { DEFAULT_PALETTE } from '../domain/palette';
import {
  readCustomBindings,
  readShortcutOverrides,
  readTabBindings,
  type CustomBindings,
  type ShortcutOverrides,
  type TabBindings,
} from '../domain/shortcuts';
import { readDDayList, type DDay } from '../domain/dday';
import { DEFAULT_PERIODS, readPeriods, type PeriodDef } from '../domain/periodTimes';
import { readTerms, type SchoolTerms } from '../domain/semester';
import { sanitizeTeachingMode, type TeachingMode } from '../domain/teachingMode';
import { DEFAULT_BELL, sanitizeBell, type ClassBellSettings } from '../domain/classBell';
import { DEFAULT_PHRASES, sanitizePhrases } from '../domain/observationPhrases';
import { sanitizeSchool, type SchoolSetting } from '../domain/schoolSetting';
import { DEFAULT_AUTO_BACKUP, sanitizeAutoBackup, type AutoBackupSettings } from '../domain/autoBackup';
import { ALARM_SOUND_SECONDS, DEFAULT_ALARM_SOUND } from '../domain/eventAlarm';
import {
  boolField,
  customField,
  intField,
  oneOfField,
  readSettings,
  sparseSettings,
  type SettingField,
  type SettingsSpec,
} from '../domain/settings';
import { settingsPort, startSettingsSync, type SettingsBinding, type SettingsData } from '../data/settingsSync';
import { legacyFontPages, setFontSizes, useLayoutPrefs, type PopupStyle } from './layoutPrefs';
import { addPressTargets, setCustomShortcuts, setShortcutOverrides, setTabShortcuts, useShortcutOverrides } from './keys';
import { prunePressTargets, readPressTargets, type PressTargets } from '../domain/pressTarget';
import { isKnownTabShortcut } from './tabShortcuts';
import { useNav, type SemesterFilter, type StartupScope, STARTUP_SCOPES } from './nav';
import { detectDeviceKind, type DeviceKind } from './deviceKind';

// PC인가 휴대폰인가는 app/deviceKind에 (창 목록도 본다)
export { detectDeviceKind, type DeviceKind };

// ── 기기 종류마다 (pc / mobile) ──

export interface DevicePrefs {
  /** 글자 크기 - 화면마다 %(메모 요청 #145, 100은 적지 않는다). 옛 문서의 다섯 단계 fontScale은 readDevicePrefs가 옮긴다 */
  fontSizes: FontSizes;
  popupStyle: PopupStyle;
  startupScope: StartupScope;
  shortcutOverrides: ShortcutOverrides;
  /** 창 안 탭 키 (P18-2 - 키를 준 탭만). shortcutOverrides와 칸을 나눈다 - 옛 판은 모르는 칸을 읽지 않는다 */
  tabShortcuts: TabBindings;
  /**
   * 내가 만든 그 밖의 키 (P28 - 환경설정 값 'opt.…'·단추 'press.…', 키를 준 것만). tabShortcuts와 칸을 나눈다 -
   * 옛 판(P28 전)은 tabShortcuts를 '있는 탭'으로 걸러 다시 쓰므로 거기 두면 지워진다. 이 칸은 모양만 보고 모르는 id도 남긴다.
   */
  customShortcuts: CustomBindings;
  /** 단추 대신 누르기(P28-3)의 그 단추 - 'press.…' → 자리·찾기·이름 (키가 있는 것만 올린다) */
  pressTargets: PressTargets;
  showWeekend: boolean;
  showEvents: boolean;
  showClass: boolean;
  semesterFilter: SemesterFilter;
  /** 학기 칩을 고른 때의 학기 열쇠 (P26-3 - 학기가 바뀌면 따라간다) */
  semesterFilterAt: string;
  enableScrollNav: boolean;
}

const overridesField: SettingField<ShortcutOverrides> = { def: {}, read: readShortcutOverrides };
const tabShortcutsField: SettingField<TabBindings> = { def: {}, read: (v) => readTabBindings(v, isKnownTabShortcut) };
const customShortcutsField: SettingField<CustomBindings> = { def: {}, read: readCustomBindings };
const pressTargetsField: SettingField<PressTargets> = { def: {}, read: readPressTargets };

export const DEVICE_PREFS: SettingsSpec<DevicePrefs> = {
  fontSizes: customField<FontSizes>({}, readFontSizes),
  popupStyle: oneOfField<PopupStyle>('side', ['side', 'center', 'popup']),
  startupScope: oneOfField<StartupScope>('last', STARTUP_SCOPES),
  shortcutOverrides: overridesField,
  tabShortcuts: tabShortcutsField,
  customShortcuts: customShortcutsField,
  pressTargets: pressTargetsField,
  showWeekend: boolField(true),
  showEvents: boolField(true),
  showClass: boolField(true),
  semesterFilter: oneOfField<SemesterFilter>('all', ['all', 1, 2]),
  semesterFilterAt: customField<string>('', (v) => (typeof v === 'string' && /^(\d{4}-[12])?$/.test(v) ? v : undefined)),
  enableScrollNav: boolField(false),
};

/** 지금 이 기기의 기기 칸 값 (초기화 설정 묶음도 여기서 모은다 - app/settingsSnapshot) */
export function currentDevicePrefs(): DevicePrefs {
  const { fontSizes, popupStyle } = useLayoutPrefs.getState();
  const { startupScope, showWeekend, showEvents, showClass, semesterFilter, semesterFilterAt, enableScrollNav } = useNav.getState();
  return {
    fontSizes,
    popupStyle,
    startupScope,
    shortcutOverrides: useShortcutOverrides.getState().overrides,
    tabShortcuts: useShortcutOverrides.getState().tabs,
    customShortcuts: useShortcutOverrides.getState().custom,
    pressTargets: prunePressTargets(useShortcutOverrides.getState().press, useShortcutOverrides.getState().custom),
    showWeekend,
    showEvents,
    showClass,
    semesterFilter,
    semesterFilterAt,
    enableScrollNav,
  };
}

/** 기기 칸 값을 이 기기 store에 입힌다 (바뀐 것만 - 초기화도 같은 길로 입혀 계정 맞추기가 1초 뒤 올린다) */
export function applyDevicePrefs(p: DevicePrefs) {
  const now = currentDevicePrefs();
  if (JSON.stringify(p.fontSizes) !== JSON.stringify(now.fontSizes)) setFontSizes(p.fontSizes);
  if (p.popupStyle !== now.popupStyle) useLayoutPrefs.setState({ popupStyle: p.popupStyle });
  if (JSON.stringify(p.shortcutOverrides) !== JSON.stringify(now.shortcutOverrides)) setShortcutOverrides(p.shortcutOverrides);
  if (JSON.stringify(p.tabShortcuts) !== JSON.stringify(now.tabShortcuts)) setTabShortcuts(p.tabShortcuts);
  // 단추 적은 것은 더하기만 - 이 기기에서 해제한 것(되돌리기)·고르는 중인 것을 지우지 않는다. 키가 없으면 쓰이지 않는다
  if (JSON.stringify(p.pressTargets) !== JSON.stringify(now.pressTargets)) addPressTargets(p.pressTargets);
  if (JSON.stringify(p.customShortcuts) !== JSON.stringify(now.customShortcuts)) setCustomShortcuts(p.customShortcuts);
  const navKeys = ['startupScope', 'showWeekend', 'showEvents', 'showClass', 'semesterFilter', 'semesterFilterAt', 'enableScrollNav'] as const;
  const navChanges = Object.fromEntries(navKeys.filter((k) => p[k] !== now[k]).map((k) => [k, p[k]]));
  if (Object.keys(navChanges).length > 0) useNav.setState(navChanges);
}

/**
 * 기기 설정 문서 읽기. 옛 문서(11-11 전·V4 가져오기)의 글자 크기 다섯 단계(fontScale)는 화면마다 같은 %로 옮긴다(메모 요청 #145) -
 * 이 판이 문서를 다시 적으면(통째로) fontScale 칸은 빠진다.
 */
export function readDevicePrefs(data: unknown): DevicePrefs {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  if (d.fontSizes === undefined && d.fontScale !== undefined) {
    const { fontScale, ...rest } = d;
    const fontSizes = legacyFontPages(fontScale);
    return readSettings(DEVICE_PREFS, fontSizes ? { ...rest, fontSizes } : rest);
  }
  return readSettings(DEVICE_PREFS, d);
}

const deviceBinding: SettingsBinding = {
  local: () => sparseSettings(DEVICE_PREFS, currentDevicePrefs()),
  apply: (data) => applyDevicePrefs(readDevicePrefs(data)),
  subscribe: (onChange) => {
    const subs = [useLayoutPrefs.subscribe(onChange), useNav.subscribe(onChange), useShortcutOverrides.subscribe(onChange)];
    return () => subs.forEach((u) => u());
  },
};

// ── 계정에 하나 (common) ──

export interface CommonSettings {
  /** 이월: 며칠 전까지 거슬러 볼지 (V4 forwardLookbackDays, 1~60) - P3-3이 쓴다 */
  forwardDays: number;
  /** D-Day 목록 (V4 settings/preferences.dDayList - P5-3, 지운 것은 deletedAt) */
  ddays: DDay[];
  /** 머리줄에 세울 D-Day (V4 selectedDDayId) */
  ddayPick: string | null;
  /** 개인 공휴일 '날짜' → 이름 (V3가 사람마다 받아 둔 settings/holidays 표 - 공유 표 위에 덮는다, P5-3) */
  myHolidays: Record<string, string>;
  /** 휴지통 자동 비우기 (일, 0 = 끄기 - 기본 끄기, V4 사용자 결정, P5-4) */
  trashDays: number;
  /** 교사 유형 (V4 v4_teaching - P6-1). null = 아직 고르지 않음(초등 담임으로 보고 하루 화면에 고르라는 띠) */
  teaching: TeachingMode | null;
  /** 교시 이름·시각 (V4 '수업 시간 명칭' + v4_periodTimes - P6-1). 교시 수 = 길이 */
  periods: PeriodDef[];
  /** 학년도마다 방학 (V4 timetable_v5.semesterConfig - P6-1, 학기는 방학에서 셈한다) */
  terms: SchoolTerms;
  /** 수업 종 (V4 v4_classBell - P6-3). 이 기기에서 울릴지는 이 기기에만(domain/classBell BELL_MUTE_KEY) */
  classBell: ClassBellSettings;
  /** 우리 학교 (V4 v4_school - P6-3). null = 고르지 않음(나이스 급식·학사일정을 부르지 않는다) */
  school: SchoolSetting | null;
  /** 학생 사진 폴더 (V4 backup_config.studentPhotoFolder* - P7-1). 학급마다 따로 고른 폴더 + 옛 위쪽 폴더 */
  photoFolders: PhotoFolders;
  /** 관찰 문구 단추 (V4 v4_observationPhrases - P7-3). 자리표 학생 칸·학생 기록이 함께 쓴다 */
  phrases: string[];
  /** 드라이브 자동 백업 (V4 v4_autoBackup - P8-3). 마지막 백업은 settings/backupLog(백업이 적는다) */
  autoBackup: AutoBackupSettings;
  /** 새 학년도 준비를 끝냈다고(띠 닫기) 누른 학년도 (P9-2 - 0 = 없음). 그 학년도에는 띠를 다시 띄우지 않는다 */
  newYearDone: number;
  /** 처음 띠 '다음: ⏰ 시간표 → 🏫 학급'을 닫았다 (P22-7 - 다른 기기에서도 다시 띄우지 않는다) */
  firstStepsDone: boolean;
  /** 앱 안 ⏰ 알림 소리 길이(초 - 0 = 한 번, -1 = 확인할 때까지, 기본 10초 = 3초마다 3번 - P10-1). 기기 알림(서버 푸시) 소리는 기기가 정한다 */
  alarmSound: number;
  /** 색 테마 id (P20-1 - domain/palettes.json, PC·휴대폰 같게). 화면에 입히는 것은 app/palette(모르는 id는 기본으로 그린다) */
  palette: string;
  /** 색약 배려 (P20-2 - 사람을 따른다, PC·휴대폰 같게). 화면에 입히는 것은 app/viewAids */
  cvd: boolean;
  /** 꾸미기 (P20-3 - domain/decor, PC·휴대폰 같게). 모르는 값은 끄기로 그린다(sanitizeDecor) */
  decor: string;
}

export interface PhotoFolderConfig {
  id: string;
  name: string;
}
export interface PhotoFolders {
  /** 예전에 고른 위쪽 폴더 (새로 고르는 길은 없다 - 읽기만) */
  root: PhotoFolderConfig | null;
  /** '2026-3-1' → 그 학급을 위해 따로 고른 폴더 */
  byClass: Record<string, PhotoFolderConfig>;
}
export const EMPTY_FOLDERS: PhotoFolders = { root: null, byClass: {} };

const readFolder = (v: unknown): PhotoFolderConfig | null =>
  v && typeof v === 'object' && typeof (v as PhotoFolderConfig).id === 'string' && (v as PhotoFolderConfig).id
    ? { id: (v as PhotoFolderConfig).id, name: typeof (v as PhotoFolderConfig).name === 'string' ? (v as PhotoFolderConfig).name : '' }
    : null;
const readPhotoFolders = (v: unknown): PhotoFolders | undefined => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const byClass: Record<string, PhotoFolderConfig> = {};
  for (const [k, f] of Object.entries((o.byClass as Record<string, unknown>) ?? {})) {
    const r = readFolder(f);
    if (r) byClass[k] = r;
  }
  return { root: readFolder(o.root), byClass };
};

/** 휴지통 자동 비우기에서 고를 수 있는 날 (0 = 끄기) */
export const TRASH_DAYS = [0, 7, 14, 30, 60, 90] as const;

const readHolidayMap = (v: unknown): Record<string, string> | undefined => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [d, name] of Object.entries(v as Record<string, unknown>)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof name === 'string' && name.trim()) out[d] = name.trim();
  return out;
};

export const COMMON_SETTINGS: SettingsSpec<CommonSettings> = {
  forwardDays: intField(14, 1, 60),
  ddays: customField<DDay[]>([], readDDayList),
  ddayPick: customField<string | null>(null, (v) => (typeof v === 'string' && v ? v : v === null ? null : undefined)),
  myHolidays: customField<Record<string, string>>({}, readHolidayMap),
  trashDays: customField<number>(0, (v) => ((TRASH_DAYS as readonly number[]).includes(Number(v)) ? Number(v) : undefined)),
  teaching: customField<TeachingMode | null>(null, (v) => (v && typeof v === 'object' && !Array.isArray(v) ? sanitizeTeachingMode(v) : undefined)),
  periods: customField<PeriodDef[]>(DEFAULT_PERIODS, readPeriods),
  terms: customField<SchoolTerms>({}, readTerms),
  classBell: customField<ClassBellSettings>(DEFAULT_BELL, (v) => (v && typeof v === 'object' && !Array.isArray(v) ? sanitizeBell(v) : undefined)),
  school: customField<SchoolSetting | null>(null, (v) => (v === null ? null : (sanitizeSchool(v) ?? undefined))),
  photoFolders: customField<PhotoFolders>(EMPTY_FOLDERS, readPhotoFolders),
  phrases: customField<string[]>(DEFAULT_PHRASES, (v) => (Array.isArray(v) ? sanitizePhrases(v) : undefined)),
  autoBackup: customField<AutoBackupSettings>(DEFAULT_AUTO_BACKUP, sanitizeAutoBackup),
  newYearDone: intField(0, 0, 9999),
  firstStepsDone: boolField(false),
  alarmSound: oneOfField<number>(DEFAULT_ALARM_SOUND, ALARM_SOUND_SECONDS),
  // 모르는 id도 그대로 둔다 - 새 테마를 고른 계정을 옛 앱(새 테마를 모른다)이 기본으로 되돌려 올리지 않게
  palette: customField<string>(DEFAULT_PALETTE, (v) => (typeof v === 'string' && /^[a-z]{1,20}$/.test(v) ? v : undefined)),
  cvd: boolField(false),
  // 팔레트처럼 모르는 값도 그대로 둔다 - 새 꾸미기를 고른 계정을 옛 앱이 끄기로 되돌려 올리지 않게
  decor: customField<string>(DEFAULT_DECOR, (v) => (typeof v === 'string' && /^[a-z]{1,20}$/.test(v) ? v : undefined)),
};

/** 계정에 하나인 설정. 이 기기 사본(sp5-common)으로 먼저 그리고 서버 값으로 바꾼다. */
export const useCommonSettings = create<CommonSettings>()(
  persist((): CommonSettings => readSettings(COMMON_SETTINGS, {}), { name: 'sp5-common' }),
);

export function setCommonSetting<K extends keyof CommonSettings>(key: K, value: CommonSettings[K]) {
  useCommonSettings.setState({ [key]: value } as Pick<CommonSettings, K>);
}


/** 계정 설정(common)을 서버에서 한 번 받았나 - '교사 유형을 골라 주세요' 띠처럼 '아직 없음'을 알리는 것은 받은 뒤에만 */
export const useCommonLoaded = create<{ loaded: boolean }>(() => ({ loaded: false }));

const commonBinding: SettingsBinding = {
  local: () => sparseSettings(COMMON_SETTINGS, useCommonSettings.getState()),
  apply: (data) => useCommonSettings.setState(readSettings(COMMON_SETTINGS, data)),
  subscribe: (onChange) => useCommonSettings.subscribe(onChange),
  ready: () => useCommonLoaded.setState({ loaded: true }),
};

// ── 맞추기 ──

/** 이 기기 사본이 어느 계정 것인가. 다른 계정으로 들어오면 앞 사람 설정을 새 계정에 올리지 않게 기본값으로 비운다. */
const OWNER_KEY = 'sp5-settings-owner';

function claimLocalCopy(uid: string) {
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
    localStorage.setItem(OWNER_KEY, uid);
  } catch {
    return;
  }
  // 처음(주인 없음)이면 이 기기 값을 이 계정 것으로 받아들인다
  if (owner && owner !== uid) {
    deviceBinding.apply({});
    commonBinding.apply({});
  }
}

// ── 새 사용자 처음 설정 (P33-3 - PLAN 5장 'P33' ⑨) ──

/** 관리자 '처음 설정'의 이 기기 종류 몫 (app/settingsSnapshot loadInitialSeed) */
export interface InitialSeed {
  /** 계정 칸 (보기·쓰는 법만 - 기본과 다른 것) */
  common: SettingsData;
  /** 이 기기 종류 칸 (그 몫이 없으면 null) */
  device: SettingsData | null;
  /** 이 기기에만 두는 값(화면 비율·밝기 …) 가운데 기본 그대로인 것에 입힌다 */
  applyLocal(): void;
}

/**
 * 처음 설정을 받는 함수 - 서버가 설정 문서가 없다고 할 때만 부른다(두 문서가 한 번 받은 것을 함께 쓴다).
 * 모으는 코드(settingsSnapshot)는 나눠 받는다 - 처음 쓰는 사람만 필요하고, 그 파일이 이 파일을 부른다(고리를 만들지 않게).
 */
function initialSeedLoader(): () => Promise<InitialSeed | null> {
  let p: Promise<InitialSeed | null> | null = null;
  return () => (p ??= import('./settingsSnapshot').then((m) => m.loadInitialSeed(detectDeviceKind())));
}

let running: (() => Promise<void>) | null = null;

/**
 * 로그인한 동안 설정 문서 둘(common + 이 기기 종류)을 맞춘다. 끊는 함수를 돌려준다(두 번 불러도 한 번만 끊는다).
 * 서버가 문서가 없다고 하면(새 사용자·처음 휴대폰) 관리자 '처음 설정'을 먼저 깐다 - 계정 문서가 없을 때는 이 기기 값도.
 */
export function startPrefsSync(uid: string): () => Promise<void> {
  claimLocalCopy(uid);
  useCommonLoaded.setState({ loaded: false });
  const loadSeed = initialSeedLoader();
  let applyLocal: (() => void) | null = null;
  const stops = [
    startSettingsSync(settingsPort(uid, 'common'), {
      ...commonBinding,
      seed: async () => {
        const s = await loadSeed();
        applyLocal = s?.applyLocal ?? null;
        return s?.common ?? null;
      },
      seeded: () => applyLocal?.(),
    }),
    startSettingsSync(settingsPort(uid, detectDeviceKind()), { ...deviceBinding, seed: async () => (await loadSeed())?.device ?? null }),
  ];
  let done: Promise<void> | null = null;
  const stop = () => {
    if (running === stop) running = null;
    done ??= Promise.all(stops.map((s) => s())).then(() => {});
    return done;
  };
  running = stop;
  return stop;
}

/** 로그아웃 앞에서: 1초 뒤 올리려고 기다리던 설정을 지금 올리고 끊는다 */
export function stopPrefsSync(): Promise<void> {
  return running?.() ?? Promise.resolve();
}

export function usePrefsSync(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;
    const stop = startPrefsSync(uid);
    return () => void stop();
  }, [uid]);
}

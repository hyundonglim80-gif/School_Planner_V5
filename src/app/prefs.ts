// 계정에 붙여 두는 설정 (DESIGN 4-8, V4 lib/preferenceSync.ts). 값이 사는 곳은 그대로 두고(화면 토글은 nav, 글자 크기·창 위치는
// layoutPrefs, 바꾼 키는 keys) 여기서 어느 값을 어느 문서에 두는지만 정한다. 이 기기 사본은 각 store의 localStorage다 -
// 열자마자 그 값으로 그리고(글자 크기가 튀지 않게), 서버 값이 오면 바꾼다.
//
//   pc / mobile : 기기 종류마다. 휴대폰에서 글자를 키우거나 주말을 감춘 것이 PC까지 따라오면 곤란하다(V4).
//   common      : 계정에 하나. 그 기능을 옮기는 세션이 칸을 더한다(이월 기간 P3-3, 교사 유형 P6-1 …).
//
// 넣지 않는 것: 지금 보는 화면·날짜(설정이 아니라 '어디까지 봤나'), 화면 밝기(기기마다 다르게 쓴다 - V4 그대로),
// 오른쪽 칸 폭(이 기기 화면 크기에 따른다).
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_FONT_SCALE, FONT_SCALES, type FontScale } from '../domain/fontScale';
import { readShortcutOverrides, type ShortcutOverrides } from '../domain/shortcuts';
import { readDDayList, type DDay } from '../domain/dday';
import { DEFAULT_PERIODS, readPeriods, type PeriodDef } from '../domain/periodTimes';
import { readTerms, type SchoolTerms } from '../domain/semester';
import { sanitizeTeachingMode, type TeachingMode } from '../domain/teachingMode';
import { DEFAULT_BELL, sanitizeBell, type ClassBellSettings } from '../domain/classBell';
import { DEFAULT_PHRASES, sanitizePhrases } from '../domain/observationPhrases';
import { sanitizeSchool, type SchoolSetting } from '../domain/schoolSetting';
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
import { settingsPort, startSettingsSync, type SettingsBinding } from '../data/settingsSync';
import { setFontScale, useLayoutPrefs, type PopupStyle } from './layoutPrefs';
import { setShortcutOverrides, useShortcutOverrides } from './keys';
import { useNav, type SemesterFilter, type StartupScope, STARTUP_SCOPES } from './nav';

export type DeviceKind = 'pc' | 'mobile';

/**
 * 이 기기가 PC인가 휴대폰인가 (V4 detectDeviceKind).
 * ⚠️ 화면 폭으로 가르면 PC에서 창을 좁히기만 해도 휴대폰 설정으로 넘어간다. 주 입력이 손가락인지, 휴대폰 브라우저인지로 본다(태블릿은 휴대폰 쪽).
 */
export function detectDeviceKind(): DeviceKind {
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return 'mobile';
  } catch {
    /* matchMedia가 없는 환경 */
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'pc';
}

// ── 기기 종류마다 (pc / mobile) ──

export interface DevicePrefs {
  fontScale: FontScale;
  popupStyle: PopupStyle;
  startupScope: StartupScope;
  shortcutOverrides: ShortcutOverrides;
  showWeekend: boolean;
  showEvents: boolean;
  showClass: boolean;
  semesterFilter: SemesterFilter;
  enableScrollNav: boolean;
}

const overridesField: SettingField<ShortcutOverrides> = { def: {}, read: readShortcutOverrides };

export const DEVICE_PREFS: SettingsSpec<DevicePrefs> = {
  fontScale: oneOfField<FontScale>(
    DEFAULT_FONT_SCALE,
    FONT_SCALES.map((s) => s.id),
  ),
  popupStyle: oneOfField<PopupStyle>('side', ['side', 'center']),
  startupScope: oneOfField<StartupScope>('last', STARTUP_SCOPES),
  shortcutOverrides: overridesField,
  showWeekend: boolField(true),
  showEvents: boolField(true),
  showClass: boolField(true),
  semesterFilter: oneOfField<SemesterFilter>('all', ['all', 1, 2]),
  enableScrollNav: boolField(false),
};

function currentDevicePrefs(): DevicePrefs {
  const { fontScale, popupStyle } = useLayoutPrefs.getState();
  const { startupScope, showWeekend, showEvents, showClass, semesterFilter, enableScrollNav } = useNav.getState();
  return {
    fontScale,
    popupStyle,
    startupScope,
    shortcutOverrides: useShortcutOverrides.getState().overrides,
    showWeekend,
    showEvents,
    showClass,
    semesterFilter,
    enableScrollNav,
  };
}

function applyDevicePrefs(p: DevicePrefs) {
  const now = currentDevicePrefs();
  if (p.fontScale !== now.fontScale) setFontScale(p.fontScale);
  if (p.popupStyle !== now.popupStyle) useLayoutPrefs.setState({ popupStyle: p.popupStyle });
  if (JSON.stringify(p.shortcutOverrides) !== JSON.stringify(now.shortcutOverrides)) setShortcutOverrides(p.shortcutOverrides);
  const navKeys = ['startupScope', 'showWeekend', 'showEvents', 'showClass', 'semesterFilter', 'enableScrollNav'] as const;
  const navChanges = Object.fromEntries(navKeys.filter((k) => p[k] !== now[k]).map((k) => [k, p[k]]));
  if (Object.keys(navChanges).length > 0) useNav.setState(navChanges);
}

const deviceBinding: SettingsBinding = {
  local: () => sparseSettings(DEVICE_PREFS, currentDevicePrefs()),
  apply: (data) => applyDevicePrefs(readSettings(DEVICE_PREFS, data)),
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

let running: (() => Promise<void>) | null = null;

/** 로그인한 동안 설정 문서 둘(common + 이 기기 종류)을 맞춘다. 끊는 함수를 돌려준다(두 번 불러도 한 번만 끊는다). */
export function startPrefsSync(uid: string): () => Promise<void> {
  claimLocalCopy(uid);
  useCommonLoaded.setState({ loaded: false });
  const stops = [
    startSettingsSync(settingsPort(uid, 'common'), commonBinding),
    startSettingsSync(settingsPort(uid, detectDeviceKind()), deviceBinding),
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

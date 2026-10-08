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
import {
  boolField,
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
}

export const COMMON_SETTINGS: SettingsSpec<CommonSettings> = {
  forwardDays: intField(14, 1, 60),
};

/** 계정에 하나인 설정. 이 기기 사본(sp5-common)으로 먼저 그리고 서버 값으로 바꾼다. */
export const useCommonSettings = create<CommonSettings>()(
  persist((): CommonSettings => readSettings(COMMON_SETTINGS, {}), { name: 'sp5-common' }),
);

export function setCommonSetting<K extends keyof CommonSettings>(key: K, value: CommonSettings[K]) {
  useCommonSettings.setState({ [key]: value } as Pick<CommonSettings, K>);
}

const commonBinding: SettingsBinding = {
  local: () => sparseSettings(COMMON_SETTINGS, useCommonSettings.getState()),
  apply: (data) => useCommonSettings.setState(readSettings(COMMON_SETTINGS, data)),
  subscribe: (onChange) => useCommonSettings.subscribe(onChange),
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

/** 로그인한 동안 설정 문서 둘(common + 이 기기 종류)을 맞춘다. 끊는 함수를 돌려준다. */
export function startPrefsSync(uid: string): () => void {
  claimLocalCopy(uid);
  const stops = [
    startSettingsSync(settingsPort(uid, 'common'), commonBinding),
    startSettingsSync(settingsPort(uid, detectDeviceKind()), deviceBinding),
  ];
  return () => stops.forEach((s) => s());
}

export function usePrefsSync(uid: string | undefined) {
  useEffect(() => (uid ? startPrefsSync(uid) : undefined), [uid]);
}

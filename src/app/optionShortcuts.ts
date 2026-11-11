// 환경설정 값 단축키 (P28-2 - 11-09 사용자 '창 위치 오른쪽 칸/팝업창처럼 값을 바꾸는 단추도 단축키로', PLAN 5장 'P28 물음 넷').
//   id: 'opt.<이름>.<값>' = 그 값 고르기 (예 'opt.popupStyle.popup' = 창 위치 → 팝업창) · 켜기/끄기는 'opt.<이름>' (예 'opt.contrast').
//   누르면 창을 열지 않고 값만 바꾸고 안내('⚙️ 창 위치: 팝업창'). 이미 그 값이면 앞 값으로 돌아간다(앞 값 = 이 기기에 적은 것 →
//   없으면 기본값 → 그것도 같으면 목록의 다른 값) - 같은 키로 번갈아. 켜기/끄기는 늘 뒤집는다.
//   화면 표시의 주말·일정·수업은 같은 일을 하는 단축키(toggleWeekend …)가 이미 있어 그것을 고른다(OPTION_ALIAS - 같은 일이 두 줄이 되지 않게).
// 고르는 값 목록은 여기 한 곳 - 환경설정 탭(ViewTab 등)도 여기서 읽는다. 키는 기기 칸 customShortcuts(app/prefs).
// 단추에 다는 표시(data-shortcut-target)·툴팁은 useOptionTarget, 키 처리는 app/keys → app/customShortcuts.
import { useMemo } from 'react';
import { PALETTES, sanitizePalette, DEFAULT_PALETTE } from '../domain/palette';
import { sanitizeDecor, type DecorChoice } from '../domain/decor';
import { ALARM_SOUND_CHOICES, DEFAULT_ALARM_SOUND } from '../domain/eventAlarm';
import { DEFAULT_AUTO_BACKUP, INTERVAL_CHOICES, KEEP_CHOICES } from '../domain/autoBackup';
import { formatBinding, type CustomShortcutId, type ShortcutId } from '../domain/shortcuts';
import { provideCustomShortcuts, type CustomShortcut } from './customShortcuts';
import { detectDeviceKind } from './deviceKind';
import { setPopupStyle, useLayoutPrefs, windowMode, type PopupStyle } from './layoutPrefs';
import { setEnableScrollNav, setStartupScope, useNav, type StartupScope } from './nav';
import { setCommonSetting, useCommonSettings } from './prefs';
import { SCREENS } from './screens';
import { readThemeMode, setThemeMode, type ThemeMode } from './theme';
import { setPalette } from './palette';
import { setDecor } from './decor';
import { readContrast, readDim, setContrast, setCvd, setDim } from './viewAids';
import { showToast } from './toast';
import { useShortcutOverrides } from './keys';

type Value = string | number;
export interface OptionChoice<T extends Value = Value> {
  value: T;
  label: string;
}

// ── 고르는 값 목록 (환경설정 탭도 이것을 그린다) ──

export const THEME_OPTIONS: OptionChoice<ThemeMode>[] = [
  { value: 'system', label: '🖥️ 기기 설정 따라' },
  { value: 'light', label: '☀️ 밝게' },
  { value: 'dark', label: '🌙 어둡게' },
];

export const DECOR_OPTIONS: OptionChoice<DecorChoice>[] = [
  { value: 'off', label: '끄기' },
  { value: 'season', label: '계절 따라' },
  { value: 'spring', label: '봄' },
  { value: 'summer', label: '여름' },
  { value: 'autumn', label: '가을' },
  { value: 'winter', label: '겨울' },
  { value: 'animal', label: '동물' },
];

// PC는 오른쪽 칸 / 팝업창(11-09 사용자 요청 - 옛 '가운데 창 (예전 방식)'을 바꿨다), 휴대폰은 브라우저 새 창이 없어 오른쪽 칸 / 가운데 창 그대로
export const POPUP_STYLE_OPTIONS: Record<'pc' | 'mobile', OptionChoice<PopupStyle>[]> = {
  pc: [
    { value: 'side', label: '오른쪽 칸' },
    { value: 'popup', label: '팝업창' },
  ],
  mobile: [
    { value: 'side', label: '오른쪽 칸' },
    { value: 'center', label: '가운데 창' },
  ],
};

export const STARTUP_OPTIONS: OptionChoice<StartupScope>[] = [{ value: 'last', label: '마지막에 보던 화면' }, ...SCREENS.map((s) => ({ value: s.id, label: s.label }))];

export const INTERVAL_OPTIONS: OptionChoice<number>[] = INTERVAL_CHOICES.map((d) => ({ value: d, label: `${d}일마다` }));
export const KEEP_OPTIONS: OptionChoice<number>[] = KEEP_CHOICES.map((n) => ({ value: n, label: `최근 ${n}개` }));

// ── 값 하나하나 ──

interface ChoiceDef {
  kind: 'choice';
  title: string;
  /** 앞 값이 없을 때 돌아갈 값 */
  def: Value;
  values: () => ReadonlyArray<OptionChoice>;
  get: () => Value;
  set: (v: Value) => void;
}
interface ToggleDef {
  kind: 'toggle';
  title: string;
  get: () => boolean;
  set: (on: boolean) => void;
}
type OptionDef = ChoiceDef | ToggleDef;

const autoBackup = () => useCommonSettings.getState().autoBackup;

/** 이름(id의 가운데) → 그 값. 이름은 영문·숫자만(id 모양 - domain/shortcuts isCustomShortcutId) */
const OPTIONS: Record<string, OptionDef> = {
  // 글자 크기는 값 고르기가 아니다 - 화면마다 5%씩 바꾸는 단축키 '글자 작게 / 크게 / 초기화'(app/fontSize, 메모 요청 #145)
  theme: {
    kind: 'choice',
    title: '화면 밝기',
    def: 'dark',
    values: () => THEME_OPTIONS,
    get: readThemeMode,
    set: (v) => setThemeMode(v as ThemeMode),
  },
  palette: {
    kind: 'choice',
    title: '색 테마',
    def: DEFAULT_PALETTE,
    values: () => PALETTES.map((p) => ({ value: p.id, label: `${p.emoji} ${p.name}` })),
    get: () => sanitizePalette(useCommonSettings.getState().palette),
    set: (v) => setPalette(String(v)),
  },
  decor: {
    kind: 'choice',
    title: '꾸미기',
    def: 'off',
    values: () => DECOR_OPTIONS,
    get: () => sanitizeDecor(useCommonSettings.getState().decor),
    set: (v) => setDecor(v as DecorChoice),
  },
  contrast: { kind: 'toggle', title: '고대비', get: readContrast, set: setContrast },
  cvd: { kind: 'toggle', title: '색약 배려', get: () => useCommonSettings.getState().cvd, set: setCvd },
  dim: { kind: 'toggle', title: '어둡게를 부드럽게', get: readDim, set: setDim },
  enableScrollNav: { kind: 'toggle', title: '스크롤로 페이지 이동', get: () => useNav.getState().enableScrollNav, set: setEnableScrollNav },
  popupStyle: {
    kind: 'choice',
    title: '창 위치',
    def: 'side',
    values: () => POPUP_STYLE_OPTIONS[detectDeviceKind()],
    get: () => windowMode(useLayoutPrefs.getState().popupStyle),
    set: (v) => setPopupStyle(v as PopupStyle),
  },
  startupScope: {
    kind: 'choice',
    title: '시작 화면',
    def: 'last',
    values: () => STARTUP_OPTIONS,
    get: () => useNav.getState().startupScope,
    set: (v) => setStartupScope(v as StartupScope),
  },
  alarmSound: {
    kind: 'choice',
    title: '알림 소리',
    def: DEFAULT_ALARM_SOUND,
    values: () => ALARM_SOUND_CHOICES,
    get: () => useCommonSettings.getState().alarmSound,
    set: (v) => setCommonSetting('alarmSound', Number(v)),
  },
  autoBackup: {
    kind: 'toggle',
    title: '자동 백업',
    get: () => autoBackup().enabled,
    set: (enabled) => setCommonSetting('autoBackup', { ...autoBackup(), enabled }),
  },
  autoBackupInterval: {
    kind: 'choice',
    title: '자동 백업 주기',
    def: DEFAULT_AUTO_BACKUP.intervalDays,
    values: () => INTERVAL_OPTIONS,
    get: () => autoBackup().intervalDays,
    set: (v) => setCommonSetting('autoBackup', { ...autoBackup(), intervalDays: Number(v) }),
  },
  autoBackupKeep: {
    kind: 'choice',
    title: '자동 백업 남길 개수',
    def: DEFAULT_AUTO_BACKUP.keep,
    values: () => KEEP_OPTIONS,
    get: () => autoBackup().keep,
    set: (v) => setCommonSetting('autoBackup', { ...autoBackup(), keep: Number(v) }),
  },
};

/** 같은 일을 하는 단축키가 이미 있는 켜기/끄기 - 그 단축키를 고른다 (화면 표시 = 둘째 줄 단추와 같은 값) */
const OPTION_ALIAS: Readonly<Record<string, ShortcutId>> = {
  showWeekend: 'toggleWeekend',
  showEvents: 'toggleEvents',
  showClass: 'toggleClass',
};

/** 값 고르기의 id (켜기/끄기는 value 없이) */
export function optionShortcutId(name: string, value?: Value): CustomShortcutId {
  return value === undefined ? `opt.${name}` : `opt.${name}.${value}`;
}

/** id → 그 값과 고를 값 (모르는 이름·이 기기에 없는 값이면 null) */
function parse(id: CustomShortcutId): { def: OptionDef; choice?: OptionChoice } | null {
  const m = /^opt\.([A-Za-z0-9]+)(?:\.(.+))?$/.exec(id);
  const def = m ? OPTIONS[m[1]] : undefined;
  if (!m || !def) return null;
  if (def.kind === 'toggle') return m[2] === undefined ? { def } : null;
  if (m[2] === undefined) return null;
  const choice = def.values().find((c) => String(c.value) === m[2]);
  return choice ? { def, choice } : null;
}

// ── 앞 값 (이 기기에 - 같은 키를 다시 누르면 돌아갈 값) ──

const PREV_KEY = 'sp5-opt-prev';

function readPrev(): Record<string, Value> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PREV_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Value>) : {};
  } catch {
    return {};
  }
}

function writePrev(name: string, value: Value) {
  try {
    localStorage.setItem(PREV_KEY, JSON.stringify({ ...readPrev(), [name]: value }));
  } catch {
    /* 저장소를 못 쓰면 다음에 기본값으로 돌아갈 뿐이다 */
  }
}

/** 그 값의 키를 눌렀을 때 고를 값 - 지금 다른 값이면 그 값, 이미 그 값이면 앞 값 → 기본값 → 목록의 다른 값 */
export function nextOptionValue(target: Value, now: Value, prev: Value | undefined, def: Value, list: readonly Value[]): Value {
  if (now !== target) return target;
  if (prev !== undefined && prev !== target && list.includes(prev)) return prev;
  if (def !== target && list.includes(def)) return def;
  return list.find((v) => v !== target) ?? target;
}

const MARK = '⚙️';

function runOption(name: string, def: OptionDef, choice?: OptionChoice) {
  if (def.kind === 'toggle') {
    const on = !def.get();
    def.set(on);
    showToast(`${MARK} ${def.title}: ${on ? '켬' : '끔'}`);
    return;
  }
  const values = def.values();
  const now = def.get();
  const next = nextOptionValue(choice!.value, now, readPrev()[name], def.def, values.map((c) => c.value));
  if (next !== now) {
    writePrev(name, now);
    def.set(next);
  }
  const label = values.find((c) => c.value === next)?.label ?? String(next);
  showToast(`${MARK} ${def.title}: ${label}`);
}

function lookup(id: CustomShortcutId): CustomShortcut | undefined {
  const p = parse(id);
  if (!p) return undefined;
  const name = id.split('.')[1];
  const label = p.def.kind === 'toggle' ? `${p.def.title} 켜기 / 끄기` : `${p.def.title} → ${p.choice!.label}`;
  return { label, run: () => runOption(name, p.def, p.choice) };
}

provideCustomShortcuts('opt', lookup);

// ── 단추에 다는 것 (P28-2 ■2) ──

/** 그 값 단추가 고르는 것 - 같은 일을 하는 단축키가 있으면 그 단축키, 목록에 없는 값이면 null */
export function optionTargetOf(name: string, value?: Value): ShortcutId | CustomShortcutId | null {
  if (value === undefined && OPTION_ALIAS[name]) return OPTION_ALIAS[name];
  const id = optionShortcutId(name, value);
  return parse(id) ? id : null;
}

/**
 * 환경설정 값 단추에 펼칠 것: 단축키 설정이 고르는 표시(data-shortcut-target) + 키가 있으면 툴팁.
 * 같은 일을 하는 단축키가 있는 것(주말·일정·수업)은 그 단축키. 이름은 이 파일의 OPTIONS 이름.
 */
export function useOptionTarget(): (name: string, value?: Value) => { 'data-shortcut-target'?: string; title?: string } {
  const custom = useShortcutOverrides((s) => s.custom);
  return useMemo(
    () => (name, value) => {
      const id = optionTargetOf(name, value);
      if (!id) return {};
      const key = id.startsWith('opt.') ? custom[id as CustomShortcutId] : undefined;
      return key?.key ? { 'data-shortcut-target': id, title: `단축키: ${formatBinding(key)}` } : { 'data-shortcut-target': id };
    },
    [custom],
  );
}

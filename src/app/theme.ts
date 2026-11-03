// 화면 밝기 (V4 lib/theme.ts)
//
// 화면 밝기 (ROADMAP 17 다크 모드). 밝게 / 어둡게 / 시스템 따라 - 이 기기에만 남긴다(PC는 밝게, 휴대폰은 밤에 어둡게처럼
// 기기마다 다르게 쓰는 일이 많다). html에 dark 클래스를 붙이면 src/theme.css가 색 변수를 바꾼다.
// 정하지 않았으면 어둡게가 기본이다(10-22 요청 #113).
// 처음 그리기 전에 index.html의 작은 스크립트가 같은 규칙으로 먼저 붙인다(밝은 화면이 번쩍이지 않게) - 키 이름을 바꾸면 거기도.
// 색 테마(P20-1)의 이 기기 사본 읽기·상태 표시줄 빛깔도 여기(단축키 keys가 이 파일을 부르므로 계정 설정을 끌어오지 않게) - 고르기·맞추기는 app/palette.

import { DEFAULT_PALETTE, paletteThemeColor, sanitizePalette } from '../domain/palette';

export type ThemeMode = 'light' | 'dark' | 'system';
export const THEME_KEY = 'sp5_theme';
export const THEME_CHANGED_EVENT = 'sp5-theme-changed';
/** 색 테마의 이 기기 사본 (계정 값 common palette를 받으면 app/palette가 적는다) */
export const PALETTE_KEY = 'sp5_palette';

export function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function isDarkMode(mode: ThemeMode = readThemeMode()): boolean {
  return mode === 'dark' || (mode === 'system' && systemDark());
}

/** 지금 설정대로 html에 dark를 붙이거나 뗀다 */
export function applyTheme(mode: ThemeMode = readThemeMode()) {
  const dark = isDarkMode(mode);
  document.documentElement.classList.toggle('dark', dark);
  updateThemeColor(dark);
}

/** 색 테마 이 기기 사본 (모르는 값은 기본) */
export function readPaletteId(): string {
  try {
    return sanitizePalette(localStorage.getItem(PALETTE_KEY));
  } catch {
    return DEFAULT_PALETTE;
  }
}

/** 휴대폰 주소창·상태 표시줄 빛깔 = 지금 밝기·색 테마 */
export function updateThemeColor(dark = document.documentElement.classList.contains('dark')) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paletteThemeColor(readPaletteId(), dark));
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* 저장하지 못해도 이번에는 바뀐다 */
  }
  applyTheme(mode);
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
}

/** 어둡게 ↔ 밝게 (지금 보이는 것의 반대로 정한다) */
export function toggleThemeMode() {
  setThemeMode(isDarkMode() ? 'light' : 'dark');
}

/** '시스템 따라'일 때 기기 설정이 바뀌면 따라간다. 다른 창(↗ 새 창 - 같은 기기 저장소)에서 밝기를 바꾸면 이 창도(P20-1) */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (readThemeMode() === 'system') applyTheme('system');
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    applyTheme();
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  };
  mq?.addEventListener('change', onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    mq?.removeEventListener('change', onChange);
    window.removeEventListener('storage', onStorage);
  };
}

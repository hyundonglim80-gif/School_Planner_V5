// 색 테마 (P20-1) - 계정에 하나(common palette - PC·휴대폰 같게) + 이 기기 사본 sp5_palette(index.html이 그리기 전에 data-palette를 붙여
// 기본 파랑이 번쩍이지 않게 한다 - 키 이름을 바꾸면 거기도). 화면 색은 theme.css가 html[data-palette]에서 바꾼다(기본은 붙이지 않는다).
// 화면 밝기(app/theme - 이 기기에만)와는 따로 고른다. 테마 목록·견본은 domain/palette, 이 기기 사본 읽기·상태 표시줄 빛깔은 app/theme.
import { DEFAULT_PALETTE, sanitizePalette } from '../domain/palette';
import { setCommonSetting, useCommonSettings } from './prefs';
import { PALETTE_KEY, readPaletteId, updateThemeColor } from './theme';

function paint(id: string) {
  if (id === DEFAULT_PALETTE) document.documentElement.removeAttribute('data-palette');
  else document.documentElement.setAttribute('data-palette', id);
  updateThemeColor();
}

/** 이 기기 사본에 적고 화면에 입힌다. 계정 값을 바꾸려면 setPalette */
export function applyPalette(value: unknown) {
  const id = sanitizePalette(value);
  try {
    if (id === DEFAULT_PALETTE) localStorage.removeItem(PALETTE_KEY);
    else localStorage.setItem(PALETTE_KEY, id);
  } catch {
    /* 저장하지 못해도 이번에는 바뀐다 */
  }
  paint(id);
}

/** 고르기 (환경설정 보기 탭) - 계정 값을 바꾸면 watchPalette가 입힌다 */
export function setPalette(id: string) {
  setCommonSetting('palette', sanitizePalette(id));
}

/**
 * 계정 값(common palette)을 따른다 - 서버에서 받거나 고르면 이 기기 사본과 화면을 바꾼다.
 * 다른 창(↗ 새 창 - 같은 기기 저장소)이 바꾸면 storage 이벤트로 받아 이 창도 맞춘다(그 창의 계정 store도 - 옛 값을 다시 올리지 않게).
 */
export function watchPalette(): () => void {
  applyPalette(useCommonSettings.getState().palette);
  const unsub = useCommonSettings.subscribe((s, prev) => {
    if (s.palette !== prev.palette) applyPalette(s.palette);
  });
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PALETTE_KEY) return;
    const id = readPaletteId();
    paint(id);
    if (sanitizePalette(useCommonSettings.getState().palette) !== id) setCommonSetting('palette', id);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsub();
    window.removeEventListener('storage', onStorage);
  };
}

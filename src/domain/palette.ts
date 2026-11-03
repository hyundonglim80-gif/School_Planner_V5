// 색 테마 목록 (P20-1) - 테마 값은 palettes.json 하나(생성기·앱·시험이 같이 읽는다), 화면 색은 theme.css(tools/gen-theme-css.mjs)가
// html[data-palette="<id>"]에 바꿔 끼운다(기본은 붙이지 않는다). 여기서는 고르는 칸의 이름·견본과 휴대폰 상태 표시줄 빛깔만 셈한다.
import file from './palettes.json';
import { lchCss, lchHex, paletteColors, type PaletteDef, type PaletteFile } from './themeCss';

export const PALETTES: readonly PaletteDef[] = (file as PaletteFile).palettes;
export const DEFAULT_PALETTE = 'default';

/** 모르는 값(옛 기기·지운 테마)은 기본 */
export function sanitizePalette(v: unknown): string {
  return typeof v === 'string' && PALETTES.some((p) => p.id === v) ? v : DEFAULT_PALETTE;
}

const find = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** 고르는 칩의 견본 (강조 동그라미 + 바탕 네모 - 지금 밝기의 것) */
export function paletteSwatch(id: string, dark: boolean): { accent: string; body: string; card: string } {
  const c = paletteColors(find(id), dark);
  return { accent: lchCss(c.accent), body: lchCss(c.body), card: lchCss(c.card) };
}

/** 휴대폰 주소창·상태 표시줄 빛깔 (meta theme-color - 기본은 예전 값 그대로) */
export function paletteThemeColor(id: string, dark: boolean): string {
  if (sanitizePalette(id) === DEFAULT_PALETTE) return dark ? '#0f1522' : '#2563eb';
  const c = paletteColors(find(id), dark);
  return lchHex(dark ? c.body : c.accent);
}

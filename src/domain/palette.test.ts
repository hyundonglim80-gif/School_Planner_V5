import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, PALETTES, paletteSwatch, paletteThemeColor, sanitizePalette } from './palette';

describe('색 테마 목록 (P20-1)', () => {
  it('모르는 값은 기본', () => {
    expect(sanitizePalette('forest')).toBe('forest');
    expect(sanitizePalette('nope')).toBe(DEFAULT_PALETTE);
    expect(sanitizePalette(undefined)).toBe(DEFAULT_PALETTE);
    expect(sanitizePalette(3)).toBe(DEFAULT_PALETTE);
  });

  it('기본 테마의 상태 표시줄 빛깔은 예전 값 그대로', () => {
    expect(paletteThemeColor('default', false)).toBe('#2563eb');
    expect(paletteThemeColor('default', true)).toBe('#0f1522');
    expect(paletteThemeColor('nope', true)).toBe('#0f1522');
  });

  it('테마마다 견본(강조·바탕)과 상태 표시줄 빛깔이 있다', () => {
    for (const p of PALETTES) {
      for (const dark of [false, true]) {
        const s = paletteSwatch(p.id, dark);
        expect(s.accent).toMatch(/^oklch\(/);
        expect(s.body).toMatch(/^oklch\(/);
        expect(paletteThemeColor(p.id, dark)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

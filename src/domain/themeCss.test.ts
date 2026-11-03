// 파일 글자는 node:fs로 (vitest는 CSS ?raw를 비운다 - 앱 tsconfig에 node 형이 없어 이 파일에만)
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import palettes from './palettes.json';
import { GROUP_SPACE_HUES, PERSONAL_SPACE_HUE } from './spaceColor';
import {
  MEANING_HUES,
  MEANING_MIN_DE,
  SLATE_50,
  SPACE_HUES,
  SPACE_MIN_DE,
  WHITE,
  accentLadder,
  accentPrimary,
  buildThemeCss,
  contrast,
  deltaE,
  hexLch,
  inGamut,
  lchHex,
  parseOklch,
  readTailwindColors,
  spaceSwaps,
  type PaletteFile,
} from './themeCss';

const tw = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
const themeFile = readFileSync('src/theme.css', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');
const orig = readTailwindColors(tw);
const file = palettes as PaletteFile;
const themes = file.palettes.filter((p) => p.accent);

describe('테마 색표 (P20-1 theme.css)', () => {
  it('src/theme.css가 palettes.json·색 셈과 맞다 (고쳤으면 node tools/gen-theme-css.mjs)', () => {
    const onDisk = themeFile.replace(/\r\n/g, '\n');
    expect(onDisk).toBe(buildThemeCss(tw, file));
  });

  it('테마 id는 겹치지 않는 영문 소문자, 첫째는 기본(꾸미지 않음)', () => {
    const ids = file.palettes.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(file.palettes[0]).toMatchObject({ id: 'default' });
    expect(file.palettes[0].accent).toBeUndefined();
  });

  it('공간 색 목록·slate-50·cobalt가 원본과 같다', () => {
    expect(SPACE_HUES).toEqual([PERSONAL_SPACE_HUE, ...GROUP_SPACE_HUES]);
    expect(orig.slate['50']).toBe(SLATE_50);
    expect(orig.cobalt).toEqual(orig.blue);
    // index.css @theme의 cobalt = Tailwind 파랑 원래 값
    for (const [s, v] of Object.entries(orig.blue)) expect(indexCss).toContain(`--color-cobalt-${s}: ${v};`);
  });

  it('색 거리 기준 = 지금 기본 파랑의 값 (indigo 7·violet 14 - 지금보다 가깝게 만들지 않는다)', () => {
    const blue = parseOklch(orig.blue['600']);
    const meaning = Math.min(...MEANING_HUES.map((h) => deltaE(blue, parseOklch(orig[h]['600']))));
    const space = Math.min(...SPACE_HUES.map((h) => deltaE(blue, parseOklch(orig[h]['600']))));
    expect(meaning).toBeGreaterThanOrEqual(MEANING_MIN_DE);
    expect(meaning).toBeLessThan(MEANING_MIN_DE + 1);
    expect(space).toBeGreaterThanOrEqual(SPACE_MIN_DE);
    expect(space).toBeLessThan(SPACE_MIN_DE + 1);
  });

  for (const p of themes) {
    describe(`${p.emoji} ${p.name}`, () => {
      const ladder = accentLadder(orig, p);
      it('강조가 뜻 색(이월·완료·삭제 …)과 기준만큼 떨어진다', () => {
        for (const h of MEANING_HUES) expect(deltaE(ladder['600'], parseOklch(orig[h]['600'])), h).toBeGreaterThanOrEqual(MEANING_MIN_DE);
      });
      it('공간 색은 (바꾼 뒤) 강조와 기준만큼 떨어진다', () => {
        const swaps = spaceSwaps(orig, p);
        for (const h of SPACE_HUES) {
          const used = swaps[h] ?? h;
          expect(deltaE(ladder['600'], parseOklch(orig[used]['600'])), `${h}→${used}`).toBeGreaterThanOrEqual(SPACE_MIN_DE);
        }
      });
      it('흰 글자가 강조·단추 바탕(600~900) 위에서 4.5:1', () => {
        expect(contrast(WHITE, accentPrimary(p))).toBeGreaterThanOrEqual(4.5);
        for (const s of ['600', '700', '800', '900']) expect(contrast(WHITE, ladder[s]), s).toBeGreaterThanOrEqual(4.5);
      });
      it('사다리가 sRGB 안이다', () => {
        for (const c of Object.values(ladder)) expect(inGamut(c)).toBe(true);
      });
    });
  }
});

describe('색 셈', () => {
  it('hex ↔ oklch 되돌리기', () => {
    for (const hex of ['#1a73e8', '#ffffff', '#0f1522', '#2563eb']) expect(lchHex(hexLch(hex))).toBe(hex);
  });
  it('기본 강조 #1a73e8 위 흰 글자는 4.5:1 언저리 (기준과 같은 셈인지)', () => {
    expect(contrast(WHITE, hexLch('#1a73e8'))).toBeGreaterThan(4.45);
  });
});

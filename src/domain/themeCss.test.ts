// 파일 글자는 node:fs로 (vitest는 CSS ?raw를 비운다 - 앱 tsconfig에 node 형이 없어 이 파일에만)
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import palettes from './palettes.json';
import { GROUP_SPACE_HUES, PERSONAL_SPACE_HUE } from './spaceColor';
import {
  CVD_BAD_HUE,
  CVD_GOOD_HUE,
  HC_BUTTON_STEP,
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
  cvdLadder,
  deltaE,
  hexLch,
  inGamut,
  lchHex,
  parseOklch,
  readTailwindColors,
  simulateCvd,
  spaceSwaps,
  type CvdKind,
  type Lch,
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

describe('어둡게 진한 띠 (P20-2 ■1)', () => {
  it('투명도가 붙은 진한 바탕(토스트·여러 개 고르기 띠·창 뒤 막)은 어둡게 규칙이 있다', () => {
    const css = buildThemeCss(tw, file);
    for (const cls of ['bg-slate-900\\/95', 'bg-slate-900\\/90', 'bg-slate-600\\/90', 'bg-slate-900\\/40', 'bg-red-600\\/95']) {
      expect(css).toContain(`html.dark .${cls} {`);
    }
  });
});

describe('색약 배려 (P20-2 html.cvd)', () => {
  const css = buildThemeCss(tw, file);
  const kinds: CvdKind[] = ['protan', 'deutan', 'tritan'];
  const worst = (a: Lch, b: Lch) => Math.min(...kinds.map((k) => deltaE(simulateCvd(a, k), simulateCvd(b, k))));
  const step = (h: string, s: string) => parseOklch(orig[h][s]);
  const good = (s: string, hue = CVD_GOOD_HUE) => parseOklch(cvdLadder(orig.emerald, hue)[s]);
  const bad = (s: string) => parseOklch(cvdLadder(orig.red, CVD_BAD_HUE)[s]);

  it('완료·삭제·이월이 지금보다 잘 갈린다 (글자 600·옅은 바탕 100, 세 색약 중 가장 가까운 거리)', () => {
    for (const s of ['600', '100']) {
      expect(worst(good(s), bad(s))).toBeGreaterThan(worst(step('emerald', s), step('red', s)));
      expect(worst(good(s), step('amber', s))).toBeGreaterThan(worst(step('emerald', s), step('amber', s)));
    }
    expect(worst(good('600'), bad('600'))).toBeGreaterThanOrEqual(15);
    expect(worst(good('100'), bad('100'))).toBeGreaterThanOrEqual(3);
  });

  it.each(file.palettes.map((p) => [p.name, p] as const))('%s: 완료 빛깔이 강조와 갈린다', (_n, p) => {
    expect(worst(good('600', p.cvdGood), accentLadder(orig, p)['600'])).toBeGreaterThanOrEqual(5);
    expect(deltaE(good('600', p.cvdGood), accentLadder(orig, p)['600'])).toBeGreaterThanOrEqual(MEANING_MIN_DE);
  });

  it('흰 글자 단추가 원래보다 크게 떨어지지 않는다', () => {
    for (const [h, hue] of [['emerald', CVD_GOOD_HUE], ['red', CVD_BAD_HUE], ['rose', CVD_BAD_HUE]] as const) {
      for (const s of ['500', '600', '700']) {
        expect(contrast(WHITE, parseOklch(cvdLadder(orig[h], hue)[s]))).toBeGreaterThanOrEqual(contrast(WHITE, step(h, s)) - 0.2);
      }
    }
  });

  it('이월 노랑은 그대로 · 어둡게 단추 바탕도 돌린 값 · 고대비 단추는 변수로 따라온다', () => {
    expect(css).not.toMatch(/html\.cvd \{[^}]*--color-amber-/);
    expect(css).toContain(`html.dark.cvd .bg-emerald-600, html.dark.cvd .hover\\:bg-emerald-600:hover { background-color: ${cvdLadder(orig.emerald, CVD_GOOD_HUE)['600']}; }`);
    expect(css).toContain('html.hc.hc.hc .bg-emerald-600, html.hc.hc.hc .hover\\:bg-emerald-600:hover { background-color: var(--sp5-strong-emerald); }');
  });

  it('인쇄 쪽은 색약 배려에서도 기본 색 변수로 돌아간다', () => {
    expect(css).toContain('html.cvd [data-print-paper]');
  });
});

describe('고대비 (P20-2 html.hc)', () => {
  const css = buildThemeCss(tw, file);

  it('글자는 밝기와 상관없이 같은 규칙 (사다리가 뒤집혀 있다) - 바탕을 바꾸는 변수는 건드리지 않는다', () => {
    expect(css).toContain('html.hc.hc.hc .text-slate-400, html.hc.hc.hc .hover\\:text-slate-400:hover { color: var(--color-slate-700); }');
    expect(css).not.toMatch(/html\.hc\.hc\.hc \{[^}]*--color-slate-(50|100|200)\b/);
  });

  it('어두운 띠 위 밝은 글자(slate-200)는 진하게 하지 않는다', () => {
    expect(css).not.toContain('html.hc.hc.hc .text-slate-200,');
  });

  it.each(file.palettes.map((p) => [p.name, p] as const))('%s: 흰 글자 on 진한 강조 7:1', (_n, p) => {
    expect(contrast(WHITE, accentLadder(orig, p)[HC_BUTTON_STEP])).toBeGreaterThanOrEqual(7);
  });

  it('흰 글자 on 진한 뜻 색 7:1', () => {
    for (const h of ['emerald', 'rose', 'red', 'indigo', 'violet', 'sky', 'amber']) {
      expect(contrast(WHITE, parseOklch(orig[h][HC_BUTTON_STEP]))).toBeGreaterThanOrEqual(7);
    }
  });

  it('인쇄 쪽은 고대비에서도 기본 색 변수로 돌아간다', () => {
    expect(css).toContain('html.hc [data-print-paper]');
  });
});

describe('색 셈', () => {
  it('hex ↔ oklch 되돌리기', () => {
    for (const hex of ['#1a73e8', '#ffffff', '#0f1522', '#2563eb']) expect(lchHex(hexLch(hex))).toBe(hex);
  });
  it('기본 강조 #1a73e8 위 흰 글자는 4.5:1 언저리 (기준과 같은 셈인지)', () => {
    expect(contrast(WHITE, hexLch('#1a73e8'))).toBeGreaterThan(4.45);
  });
});

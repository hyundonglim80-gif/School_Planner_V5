// 테마 색표 만들기 (P20-1 - V4 tools/gen-dark-css.mjs를 키웠다)
//
// 화면 밝기(어둡게)와 색 테마(palettes.json)의 CSS 변수 src/theme.css를 만든다. tools/gen-theme-css.mjs가 불러 파일에 쓰고,
// 시험(themeCss.test)이 같은 함수로 파일이 palettes.json과 맞는지·색 거리 기준을 본다.
// Node 24가 타입만 벗겨 바로 부르므로 import 없는 TS로 둔다(enum·namespace·매개변수 속성을 쓰지 않는다).
//
// 왜 이렇게 하나. 화면은 Tailwind 색 클래스(bg-white, text-slate-800 ...)를 수천 군데 쓴다. Tailwind v4의 색 클래스는
// 모두 CSS 변수(var(--color-slate-800))를 읽으므로, html.dark 일 때 그 변수의 값만 바꾸면 컴포넌트를 고치지 않고 화면 전체가
// 바뀐다. 쓰임새를 세어 보니(2026-10-02):
//   - 회색(slate)은 바탕(50·100·200)·테두리(200·300)·글자(400~900)로 쓰인다 → 통째로 뒤집는다.
//   - 다른 색은 옅은 바탕(50·100)·테두리(200·300)·진한 글자(600~900)로 쓰인다 → 옅은 것은 어두운 빛깔로, 진한 것은 밝게.
//     다만 단추 바탕(bg-600·700·800·900, 흰 글자를 얹는다)은 원래 색을 지킨다 - 아래 '단추 바탕' 규칙.
//   - white는 흰 바탕(bg-white 222곳)과 흰 글자(text-white 131곳)가 같은 변수다 → 변수는 어두운 바탕으로 바꾸고,
//     흰 글자·색 단추 위 반투명 흰색은 따로 흰색으로 되돌린다.
//   모두 @media screen 안이라 인쇄는 늘 밝은 모양이다.
//
// 색 테마 (P20-1, html[data-palette="<id>"] - 기본은 붙이지 않는다). 바꾸는 것은 강조(--color-primary)·파랑 사다리·회색 빛깔·바탕만:
//   - 파랑 사다리(blue) = 강조색 약 180곳(단추·고른 탭·옅은 강조 바탕·링크) → 밝기는 그대로 빛깔만 돌린다(대비가 기본과 같다).
//     뜻으로 쓰는 파랑(토요일·색 목록의 한 칸)은 cobalt(= 원래 파랑, 테마가 바꾸지 않는다)를 쓴다.
//   - 회색(slate)도 밝기·채도는 그대로 빛깔만. 뜻 색(이월 amber·완료 emerald·삭제 red·rose)·라벨 색·sky·indigo는 그대로.
//   - 공간 색(domain/spaceColor - 겹쳐 보기)이 테마 강조와 가까우면 그 테마에서 남는 빛깔로 바꾼다(--sp-<빛깔>-100/300).

// ── 색 셈 (oklch ↔ oklab ↔ sRGB) ──

/** oklch [밝기 0~1, 채도, 빛깔 각도] */
export type Lch = readonly [number, number, number];

export function parseOklch(s: string): Lch {
  const m = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(s.trim());
  if (!m) throw new Error(`oklch가 아니다: ${s}`);
  return [Number(m[1]) / 100, Number(m[2]), Number(m[3])];
}

const rad = (h: number) => (h * Math.PI) / 180;
const toLab = ([L, C, H]: Lch): [number, number, number] => [L, C * Math.cos(rad(H)), C * Math.sin(rad(H))];

function labToLinear([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function inGamut(c: Lch): boolean {
  return labToLinear(toLab(c)).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** sRGB 밖이면 밝기·빛깔은 그대로 채도만 줄인다 */
export function fitGamut(c: Lch): Lch {
  if (inGamut(c)) return c;
  let lo = 0;
  let hi = c[1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut([c[0], mid, c[2]])) lo = mid;
    else hi = mid;
  }
  return [c[0], lo, c[2]];
}

/** 두 색의 거리 (OKLab ΔE × 100) */
export function deltaE(x: Lch, y: Lch): number {
  const a = toLab(x);
  const b = toLab(y);
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const round = (v: number, d: number) => Number(v.toFixed(d));
const normHue = (h: number) => ((h % 360) + 360) % 360;

export function lchCss([L, C, H]: Lch): string {
  return `oklch(${round(L * 100, 1)}% ${round(C, 3)} ${round(normHue(H), 1)})`;
}

const encode = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** '#rrggbb' (휴대폰 상태 표시줄 theme-color - oklch를 모르는 곳) */
export function lchHex(c: Lch): string {
  return `#${labToLinear(toLab(c))
    .map((v) => Math.round(encode(v) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** 글자 대비 (WCAG - 1~21) */
export function contrast(x: Lch, y: Lch): number {
  const lum = (c: Lch) => {
    const [r, g, b] = labToLinear(toLab(c)).map((v) => decode(encode(v)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(x), lum(y)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export const WHITE: Lch = [1, 0, 0];

export function hexLch(hex: string): Lch {
  const n = parseInt(hex.slice(1), 16);
  const lin: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => decode(v / 255)) as [number, number, number];
  const [L, a, b] = linearToLab(lin);
  return [L, Math.hypot(a, b), normHue((Math.atan2(b, a) * 180) / Math.PI)];
}

// ── 색표 ──

/** Tailwind theme.css의 색 사다리 (이름 → 단계 → 'oklch(...)' 글자) + cobalt(= 원래 파랑) */
export type ColorTable = Record<string, Record<string, string>>;

export function readTailwindColors(themeCss: string): ColorTable {
  const orig: ColorTable = {};
  for (const m of themeCss.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
    (orig[m[1]] ||= {})[m[2]] = m[3].trim();
  }
  // 테마가 바꾸지 않는 파랑 (토요일·색 목록의 한 칸 - index.css @theme에 같은 값)
  if (orig.blue) orig.cobalt = { ...orig.blue };
  return orig;
}

const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'cobalt'];
const NEUTRALS = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

/** index.css @theme의 밝은 값 (인쇄 쪽 되돌리기·테마 강조의 밝기 기준) */
const LIGHT_BASE = { primary: '#1a73e8', body: '#f8fafc', card: '#ffffff', hover: '#f1f5f9', border: '#cbd5e1' };

// 어두운 바탕 (회색 사다리) - 숫자가 클수록 밝다
const SURFACE = 'oklch(23% 0.028 262)';
const BODY = 'oklch(18% 0.024 263)';
const NEUTRAL_DARK: Record<string, string> = {
  50: 'oklch(25.5% 0.029 261)',
  100: 'oklch(28.5% 0.031 260)',
  200: 'oklch(33% 0.033 259)',
  300: 'oklch(40% 0.035 258)',
  400: 'oklch(60% 0.034 257)',
  500: 'oklch(68% 0.03 257)',
  600: 'oklch(76% 0.025 257)',
  700: 'oklch(84% 0.019 257)',
  800: 'oklch(90% 0.013 257)',
  900: 'oklch(94% 0.009 257)',
  950: 'oklch(97% 0.005 257)',
};

// 옅은 단계는 어두운 바탕과 섞는다 - 바탕은 변수라 색 테마가 바탕만 바꾸면 모든 빛깔이 따라온다
const mix = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, var(--sp5-dark-surface))`;
/** 다른 색: 옅은 바탕은 어두운 빛깔, 진한 글자는 밝게 */
const hueDark = (o: Record<string, string>): Record<string, string> => ({
  50: mix(o[900], 28),
  100: mix(o[900], 42),
  200: mix(o[800], 55),
  300: mix(o[700], 68),
  400: o[400],
  500: o[400],
  600: o[400],
  700: o[300],
  800: o[200],
  900: o[100],
  950: o[50],
});

// ── 색 테마 ──

export interface PaletteDef {
  id: string;
  name: string;
  emoji: string;
  /** 강조 = 파랑 사다리의 밝기 그대로 빛깔(hue)을 돌리고 채도에 chroma를 곱한다 (기본은 없음) */
  accent?: { hue: number; chroma: number };
  /** 회색(slate)·어두운 바탕의 빛깔 - 밝기 그대로, 채도에 chroma를 곱한다 */
  neutral?: { hue: number; chroma: number };
  /** 밝게: 화면 바탕·카드(bg-white) 바탕 'oklch(...)' (없으면 물들인 slate-50·흰색) */
  body?: string;
  card?: string;
  /** 어둡게: 카드·화면 바탕 밝기 (0~1, 없으면 기본 23%·18%) */
  darkSurfaceL?: number;
  darkBodyL?: number;
}

export interface PaletteFile {
  palettes: PaletteDef[];
}

/** 색 거리 기준 (P20-1 ■0 - 지금 기본 파랑이 indigo와 7, 공간 색 violet과 14. 지금보다 가깝게 만들지 않는다) */
export const MEANING_HUES = ['emerald', 'amber', 'red', 'rose', 'yellow', 'teal', 'orange', 'purple', 'violet', 'sky', 'indigo'];
export const MEANING_MIN_DE = 7;
export const SPACE_MIN_DE = 14;
/** domain/spaceColor의 개인·그룹 빛깔과 같아야 한다 (시험이 본다) */
export const SPACE_HUES = ['emerald', 'violet', 'rose', 'lime', 'fuchsia', 'cyan'];
/** 공간 색을 바꿀 때 쓰는 남는 빛깔 (pink·green은 화면에서 쓰지 않는다) */
const SPARE_HUES = ['cobalt', 'pink', 'green', 'teal', 'sky', 'purple'];

const BLUE_REF_HUE = 262.881; // 파랑 600의 빛깔 - 사다리의 빛깔 기울기를 그대로 옮긴다
const NEUTRAL_REF_HUE = 257; // 회색 500(어둡게 사다리)의 빛깔

/** 테마 강조 사다리 (밝게) */
export function accentLadder(orig: ColorTable, p: PaletteDef): Record<string, Lch> {
  const out: Record<string, Lch> = {};
  for (const s of STEPS) {
    const [L, C, H] = parseOklch(orig.blue[s]);
    out[s] = p.accent ? fitGamut([L, C * p.accent.chroma, p.accent.hue + (H - BLUE_REF_HUE)]) : [L, C, H];
  }
  return out;
}

/** 강조(--color-primary) = 기본 강조 #1a73e8의 밝기로 - 흰 글자가 4.5:1 아래면 그만큼 어둡게 (빛깔마다 같은 밝기의 휘도가 다르다) */
export function accentPrimary(p: PaletteDef): Lch {
  const [L, C, H] = hexLch(LIGHT_BASE.primary);
  if (!p.accent) return [L, C, H];
  let c = fitGamut([L, C * p.accent.chroma, p.accent.hue + (H - BLUE_REF_HUE)]);
  while (contrast(WHITE, c) < 4.5 && c[0] > 0.3) c = fitGamut([c[0] - 0.005, C * p.accent.chroma, c[2]]);
  return c;
}

const tint = (s: string, p: PaletteDef, L?: number): Lch => {
  const [l, C, H] = parseOklch(s);
  if (!p.neutral) return [L ?? l, C, H];
  return fitGamut([L ?? l, C * p.neutral.chroma, p.neutral.hue + (H - NEUTRAL_REF_HUE)]);
};

/** 테마 강조와 가까운 공간 색 → 바꿀 빛깔 (남는 빛깔 중 강조와 기준 이상이고, 쓰는 공간 색과 가장 먼 것) */
export function spaceSwaps(orig: ColorTable, p: PaletteDef): Record<string, string> {
  if (!p.accent) return {};
  const a = accentLadder(orig, p)['600'];
  const c600 = (h: string) => parseOklch(orig[h]['600']);
  const used = SPACE_HUES.filter((h) => deltaE(a, c600(h)) >= SPACE_MIN_DE);
  const swaps: Record<string, string> = {};
  for (const h of SPACE_HUES) {
    if (used.includes(h)) continue;
    const pick = SPARE_HUES.filter((s) => !used.includes(s) && deltaE(a, c600(s)) >= SPACE_MIN_DE)
      .map((s) => ({ s, d: Math.min(...used.map((u) => deltaE(c600(s), c600(u)))) }))
      .sort((x, y) => y.d - x.d)[0];
    if (!pick) continue;
    swaps[h] = pick.s;
    used.push(pick.s);
  }
  return swaps;
}

/** 견본·theme-color: 그 테마 강조와 바탕 (밝게/어둡게) */
/** Tailwind slate-50 (밝게 바탕을 물들이는 바탕 - 앱의 견본도 쓰므로 theme.css 없이. 시험이 Tailwind 값과 견준다) */
export const SLATE_50 = 'oklch(98.4% 0.003 247.858)';

export function paletteColors(p: PaletteDef, dark: boolean): { accent: Lch; body: Lch; card: Lch } {
  const accent = accentPrimary(p);
  if (dark) {
    return { accent, body: tint(BODY, p, p.darkBodyL), card: tint(SURFACE, p, p.darkSurfaceL) };
  }
  return {
    accent,
    body: p.body ? parseOklch(p.body) : p.neutral ? tint(SLATE_50, p) : hexLch(LIGHT_BASE.body),
    card: p.card ? parseOklch(p.card) : hexLch(LIGHT_BASE.card),
  };
}

const whiteRules = (sel: string) => [
  `  ${sel} .text-white, ${sel} .hover\\:text-white:hover, ${sel} .group:hover .group-hover\\:text-white { color: #fff; }`,
  `  ${sel} .text-white\\/60 { color: rgb(255 255 255 / 0.6); }`,
  `  ${sel} .text-white\\/50 { color: rgb(255 255 255 / 0.5); }`,
  ...[15, 25, 30].map((a) => `  ${sel} .bg-white\\/${a}, ${sel} .hover\\:bg-white\\/${a}:hover { background-color: rgb(255 255 255 / ${a / 100}); }`),
];

function paletteBlock(orig: ColorTable, p: PaletteDef): string {
  const sel = `html[data-palette="${p.id}"]`;
  const dsel = `html.dark[data-palette="${p.id}"]`;
  const ladder = accentLadder(orig, p);
  const ladderCss = Object.fromEntries(STEPS.map((s) => [s, lchCss(ladder[s])]));
  const swaps = spaceSwaps(orig, p);
  const light = paletteColors(p, false);

  const lv: string[] = [];
  lv.push(`    --color-primary: ${lchCss(accentPrimary(p))};`);
  lv.push(`    --color-bg-body: ${lchCss(light.body)};`);
  if (p.card) {
    lv.push(`    --color-white: ${p.card};`);
    lv.push(`    --color-bg-card: ${p.card};`);
  }
  if (p.neutral) {
    lv.push(`    --color-bg-hover: ${lchCss(tint(orig.slate['100'], p))};`);
    lv.push(`    --color-border: ${lchCss(tint(orig.slate['300'], p))};`);
    for (const s of STEPS) lv.push(`    --color-slate-${s}: ${lchCss(tint(orig.slate[s], p))};`);
  }
  for (const s of STEPS) lv.push(`    --color-blue-${s}: ${ladderCss[s]};`);
  for (const [h, to] of Object.entries(swaps)) {
    lv.push(`    --sp-${h}-100: ${orig[to]['100']};`);
    lv.push(`    --sp-${h}-300: ${orig[to]['300']};`);
  }

  const dark = paletteColors(p, true);
  const nd = (s: string) => lchCss(tint(NEUTRAL_DARK[s], p));
  const dv: string[] = [];
  dv.push(`    --sp5-dark-surface: ${lchCss(dark.card)};`);
  dv.push(`    --color-white: ${lchCss(dark.card)};`);
  dv.push(`    --color-bg-body: ${lchCss(dark.body)};`);
  dv.push(`    --color-bg-card: ${lchCss(dark.card)};`);
  dv.push(`    --color-bg-hover: ${nd('100')};`);
  dv.push(`    --color-border: ${nd('300')};`);
  for (const s of STEPS) dv.push(`    --color-slate-${s}: ${nd(s)};`);
  for (const [s, v] of Object.entries(hueDark(ladderCss))) dv.push(`    --color-blue-${s}: ${v};`);
  for (const [h, to] of Object.entries(swaps)) {
    const d = hueDark(orig[to]);
    dv.push(`    --sp-${h}-100: ${d['100']};`);
    dv.push(`    --sp-${h}-300: ${d['300']};`);
  }

  const keep: string[] = [];
  for (const s of ['600', '700', '800', '900']) {
    keep.push(`  ${dsel} .bg-blue-${s}, ${dsel} .hover\\:bg-blue-${s}:hover { background-color: ${ladderCss[s]}; }`);
  }
  for (const s of ['700', '800', '900']) {
    keep.push(`  ${dsel} .bg-slate-${s}, ${dsel} .hover\\:bg-slate-${s}:hover { background-color: ${nd('300')}; }`);
  }

  const swapNote = Object.entries(swaps)
    .map(([h, to]) => `${h}→${to}`)
    .join(' · ');
  return `  /* ${p.emoji} ${p.name}${swapNote ? ` (공간 색 ${swapNote})` : ''} */
  ${sel} {
${lv.join('\n')}
  }
  ${dsel} {
${dv.join('\n')}
  }
${keep.join('\n')}
${p.card ? `${whiteRules(sel).join('\n')}\n` : ''}`;
}

export function buildThemeCss(themeCss: string, file: PaletteFile): string {
  const orig = readTailwindColors(themeCss);
  const vars: string[] = [];
  vars.push(`    --sp5-dark-surface: ${SURFACE};`);
  vars.push(`    --color-white: ${SURFACE};`);
  vars.push(`    --color-bg-body: ${BODY};`);
  vars.push(`    --color-bg-card: ${SURFACE};`);
  vars.push(`    --color-bg-hover: ${NEUTRAL_DARK[100]};`);
  vars.push(`    --color-border: ${NEUTRAL_DARK[300]};`);
  for (const n of NEUTRALS) {
    if (!orig[n]) continue;
    for (const [s, v] of Object.entries(NEUTRAL_DARK)) vars.push(`    --color-${n}-${s}: ${v};`);
  }
  for (const h of HUES) {
    const o = orig[h];
    if (!o) continue;
    for (const [s, v] of Object.entries(hueDark(o))) vars.push(`    --color-${h}-${s}: ${v};`);
  }

  // 단추 바탕: 흰 글자를 얹는 진한 바탕은 원래 색 (밝게 뒤집으면 흰 글자가 안 보인다)
  const keep: string[] = [];
  for (const h of HUES) {
    const o = orig[h];
    if (!o) continue;
    for (const s of ['600', '700', '800', '900']) {
      keep.push(`  html.dark .bg-${h}-${s}, html.dark .hover\\:bg-${h}-${s}:hover { background-color: ${o[s]}; }`);
    }
  }
  // 회색 진한 바탕(말풍선·어두운 단추)은 바탕보다 한 단계 밝은 회색으로
  for (const s of ['700', '800', '900']) {
    keep.push(`  html.dark .bg-slate-${s}, html.dark .hover\\:bg-slate-${s}:hover { background-color: ${NEUTRAL_DARK[300]}; }`);
  }

  // 인쇄 창의 쪽(features/print [data-print-paper])은 어두운 화면·색 테마에서도 종이처럼 기본 밝은 색 - 바꾼 변수를 원래 값으로 되돌린다
  const paper: string[] = [];
  paper.push(`    --color-primary: ${LIGHT_BASE.primary};`);
  paper.push(`    --color-white: #fff;`);
  paper.push(`    --color-bg-body: ${LIGHT_BASE.body};`);
  paper.push(`    --color-bg-card: ${LIGHT_BASE.card};`);
  paper.push(`    --color-bg-hover: ${LIGHT_BASE.hover};`);
  paper.push(`    --color-border: ${LIGHT_BASE.border};`);
  for (const n of [...NEUTRALS, ...HUES]) {
    if (!orig[n]) continue;
    for (const [s, v] of Object.entries(orig[n])) paper.push(`    --color-${n}-${s}: ${v};`);
  }
  // 공간 색 바꿈을 걷는다 (initial = 비운 변수 → spaceTone의 원래 빛깔)
  for (const h of SPACE_HUES) paper.push(`    --sp-${h}-100: initial;`, `    --sp-${h}-300: initial;`);

  const palettes = file.palettes.filter((p) => p.id !== 'default').map((p) => paletteBlock(orig, p));

  return `/* src/theme.css - tools/gen-theme-css.mjs 가 만든다(색 셈은 src/domain/themeCss.ts, 테마 값은 src/domain/palettes.json).
   손으로 고치지 말고 그 둘을 고쳐 다시 돌린다: node tools/gen-theme-css.mjs  (ROADMAP 17 어둡게 · P20 색 테마) */
@media screen {
  html.dark {
    color-scheme: dark;
${vars.join('\n')}
  }
  html.dark body {
    background-color: var(--color-bg-body);
  }
${keep.join('\n')}
${whiteRules('html.dark').join('\n')}

  html[data-palette] body {
    background-color: var(--color-bg-body);
  }
${palettes.join('\n')}
  html.dark [data-print-paper],
  html[data-palette] [data-print-paper] {
    color-scheme: light;
${paper.join('\n')}
  }
}
`;
}

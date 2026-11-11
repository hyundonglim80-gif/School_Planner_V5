// 화면 글자 크기 (V4 lib/fontScale.ts → 메모 요청 #145 화면마다 %)
//
// 화면(한눈에·하루·주간·월간·년간·메모·학급)마다 글자 크기를 따로 기억한다 - 팝업창(↗·창 위치 '팝업창')은 화면이 없어 '팝업창' 하나.
// 환경설정 '글자 크기'의 − / 초기화 / + 로 5%씩 바꾼다(초기화 = 100%). 단축키로 누르면 누를 때마다 쌓인다(같은 키로 계속 작게).
// 옛 다섯 단계(매우 작게 ~ 매우 크게)는 11-11 메모 요청 #145가 바꿨다 - 옛 값은 모든 화면에 같은 %로 옮긴다(legacyFontSizes).
//
// 글자 단계(text-xs, text-sm ...)와 여백 한 칸(--spacing)이 모두 rem으로
// 적혀 있다. rem은 <html>의 글자 크기를 기준으로 하므로, 거기 하나만 바꾸면
// 글자와 여백이 같은 비율로 함께 움직인다. 화면마다 따로 손볼 것이 없다.
// 머리줄(맨 위 줄)만은 늘 100%다 - index.css [data-fixed-font]가 --root-scale로 나눠 되돌린다(화면을 옮길 때마다 머리줄이 커졌다 작아지지 않게).
//
// px가 아니라 %로 적는 것은 브라우저 설정에서 글자를 키워 둔 사람의 뜻을
// 덮어쓰지 않기 위해서다. 그 사람에게는 100%가 16px보다 크다.
//
// PC(폭 640px 이상 화면)의 '한눈에' 화면은 바탕이 90%다(11-08 사용자 요청 80% - 크롬 확대 비율 80%가
// 한 화면에 보기 좋게 들어왔다 → 11-09 써 보니 '좀 작다'로 90% → 같은 날 '한눈에는 볼 것이 많으니 90%, 나머지는 100%').
// 다른 화면·휴대폰은 100%. 바탕은 index.css의 html(한눈에일 때 html[data-dense] - app/nav가 붙인다)에 있고,
// 여기서 고른 %는 그 바탕에 곱한다(--font-scale) - PC 한눈에 100% = 90%, 95% = 85.5%.

/** 화면 하나하나의 글자 크기 % (화면 id → %, 100은 적지 않는다). 팝업창은 POPOUT_FONT_PAGE */
export type FontSizes = Readonly<Record<string, number>>;

/** 팝업창(화면이 없는 창)의 글자 크기 자리 */
export const POPOUT_FONT_PAGE = 'popout';

/** − / + 한 번에 바뀌는 % */
export const FONT_STEP = 5;
/** 더 작아지지도 커지지도 않는 끝 (누적해도 글이 사라지거나 화면을 넘치지 않게) */
export const FONT_MIN = 50;
export const FONT_MAX = 200;
/** 초기화 = 브라우저가 정한 크기 그대로 */
export const DEFAULT_FONT_PERCENT = 100;

/** PC(폭 640px 이상) '한눈에' 화면의 바탕 크기 % - index.css html[data-dense]와 같다. 다른 화면·휴대폰은 100 */
export const DENSE_BASE_PERCENT = 90;

/** html에 붙는 표시 - 지금 화면이 볼 것이 많은 화면(한눈에)이면 붙는다. index.css가 PC에서 바탕을 줄인다 */
export const DENSE_ATTR = 'data-dense';

/** 지금 화면이 한눈에인가를 html에 적는다 (app/nav - 화면이 바뀌는 그 자리에서, 화면들이 그리기 전에) */
export function setDenseScreen(on: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.toggleAttribute(DENSE_ATTR, on);
}

/** 5% 칸에 맞추고 끝(50~200%) 안으로 */
export function clampFontPercent(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_FONT_PERCENT;
  const snapped = Math.round(percent / FONT_STEP) * FONT_STEP;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, snapped));
}

/** 그 화면의 글자 크기 % (적힌 것이 없으면 100) */
export function fontPercentOf(sizes: FontSizes | undefined, page: string): number {
  const v = sizes?.[page];
  return typeof v === 'number' ? clampFontPercent(v) : DEFAULT_FONT_PERCENT;
}

/** 한 칸 작게(-1) · 크게(+1) · 초기화(0) 한 뒤의 % */
export function steppedFontPercent(percent: number, step: -1 | 0 | 1): number {
  return step === 0 ? DEFAULT_FONT_PERCENT : clampFontPercent(percent + step * FONT_STEP);
}

/** 그 화면만 바꾼 새 목록 (100이면 칸을 뺀다 - 계정 문서에 기본값을 적지 않는다) */
export function withFontPercent(sizes: FontSizes | undefined, page: string, percent: number): FontSizes {
  const next: Record<string, number> = { ...(sizes ?? {}) };
  const p = clampFontPercent(percent);
  if (p === DEFAULT_FONT_PERCENT) delete next[page];
  else next[page] = p;
  return next;
}

/** 화면 id 모양 (영문 소문자) - 모르는 화면 이름도 남긴다(새 판이 더한 화면을 옛 판이 지우지 않게) */
const PAGE_ID = /^[a-z]{1,20}$/;

/** 계정 문서·기기 저장소에서 읽은 값 다듬기 (모양이 틀리면 undefined - 기본값) */
export function readFontSizes(v: unknown): FontSizes | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [page, percent] of Object.entries(v as Record<string, unknown>)) {
    if (!PAGE_ID.test(page) || typeof percent !== 'number') continue;
    const p = clampFontPercent(percent);
    if (p !== DEFAULT_FONT_PERCENT) out[page] = p;
  }
  return out;
}

/** 옛 다섯 단계 → % (11-11 전 - 92.5는 5% 칸에 맞춰 90) */
export const LEGACY_FONT_SCALES: Readonly<Record<string, number>> = { xs: 85, sm: 90, md: 100, lg: 115, xl: 130 };

/** 옛 단계 하나(모든 화면에 같았다) → 화면마다 같은 % (보통·모르는 값이면 undefined - 옮길 것이 없다) */
export function legacyFontSizes(scale: unknown, pages: readonly string[]): FontSizes | undefined {
  const percent = typeof scale === 'string' ? LEGACY_FONT_SCALES[scale] : undefined;
  if (!percent || percent === DEFAULT_FONT_PERCENT) return undefined;
  return Object.fromEntries(pages.map((p) => [p, percent]));
}

/**
 * 고른 %를 화면에 입힌다.
 *
 * 크기 자체(html font-size)는 index.css가 정한다 - 바탕(100%, PC 한눈에만 90%) × 이 값.
 * 그래서 창 폭이 휴대폰 ↔ PC로 넘어가도 다시 입힐 것이 없다.
 * 100%일 때는 값을 지운다(곱하기 1 - 바탕 그대로).
 */
export function applyFontPercent(percent: number) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('font-size'); // 옛 길(html에 %를 바로 적었다)이 남지 않게
  const p = clampFontPercent(percent);
  if (p === DEFAULT_FONT_PERCENT) {
    root.style.removeProperty('--font-scale');
    return;
  }
  root.style.setProperty('--font-scale', String(p / 100));
}

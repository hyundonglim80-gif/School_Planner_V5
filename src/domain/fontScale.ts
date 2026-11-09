// 화면 글자 크기 (V4 lib/fontScale.ts)
//
// 화면 글자 크기를 다섯 단계로 고른다.
//
// 글자 단계(text-xs, text-sm ...)와 여백 한 칸(--spacing)이 모두 rem으로
// 적혀 있다. rem은 <html>의 글자 크기를 기준으로 하므로, 거기 하나만 바꾸면
// 글자와 여백이 같은 비율로 함께 움직인다. 화면마다 따로 손볼 것이 없다.
//
// '보통'은 브라우저가 정한 크기(대개 16px) 그대로다. 이 앱은 휴대폰에서도
// 쓰이는데 알맞은 크기가 사람마다 달라, 한쪽으로 정해 두는 대신 고르게 한다.
//
// px가 아니라 %로 적는 것은 브라우저 설정에서 글자를 키워 둔 사람의 뜻을
// 덮어쓰지 않기 위해서다. 그 사람에게는 '보통'이 16px보다 크다.
//
// PC(폭 640px 이상 화면)의 '한눈에' 화면은 바탕이 90%다(11-08 사용자 요청 80% - 크롬 확대 비율 80%가
// 한 화면에 보기 좋게 들어왔다 → 11-09 써 보니 '좀 작다'로 90% → 같은 날 '한눈에는 볼 것이 많으니 90%, 나머지는 100%').
// 다른 화면·휴대폰은 100%. 바탕은 index.css의 html(한눈에일 때 html[data-dense] - app/nav가 붙인다)에 있고,
// 여기서 고른 단계는 그 바탕에 곱한다(--font-scale) - PC 한눈에 '보통' = 90%, '작게' = 83%.

export type FontScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const FONT_SCALES: Array<{ id: FontScale; label: string; percent: number }> = [
  { id: 'xs', label: '매우 작게', percent: 85 },
  { id: 'sm', label: '작게', percent: 92.5 },
  { id: 'md', label: '보통', percent: 100 },
  { id: 'lg', label: '크게', percent: 115 },
  { id: 'xl', label: '매우 크게', percent: 130 },
];

export const DEFAULT_FONT_SCALE: FontScale = 'md';

/** PC(폭 640px 이상) '한눈에' 화면의 바탕 크기 % - index.css html[data-dense]와 같다. 다른 화면·휴대폰은 100 */
export const DENSE_BASE_PERCENT = 90;

/** html에 붙는 표시 - 지금 화면이 볼 것이 많은 화면(한눈에)이면 붙는다. index.css가 PC에서 바탕을 줄인다 */
export const DENSE_ATTR = 'data-dense';

/** 지금 화면이 한눈에인가를 html에 적는다 (app/nav - 화면이 바뀌는 그 자리에서, 화면들이 그리기 전에) */
export function setDenseScreen(on: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.toggleAttribute(DENSE_ATTR, on);
}

export function fontScalePercent(scale: FontScale): number {
  return FONT_SCALES.find((s) => s.id === scale)?.percent ?? 100;
}

/**
 * 고른 크기를 화면에 입힌다.
 *
 * 크기 자체(html font-size)는 index.css가 정한다 - 바탕(100%, PC 한눈에만 90%) × 이 값.
 * 그래서 창 폭이 휴대폰 ↔ PC로 넘어가도 다시 입힐 것이 없다.
 * '보통'일 때는 값을 지운다(곱하기 1 - 바탕 그대로).
 */
export function applyFontScale(scale: FontScale) {
  const root = document.documentElement;
  root.style.removeProperty('font-size'); // 옛 길(html에 %를 바로 적었다)이 남지 않게
  if (scale === DEFAULT_FONT_SCALE) {
    root.style.removeProperty('--font-scale');
    return;
  }
  root.style.setProperty('--font-scale', String(fontScalePercent(scale) / 100));
}

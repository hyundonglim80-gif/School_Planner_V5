/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyFontPercent,
  clampFontPercent,
  DEFAULT_FONT_PERCENT,
  DENSE_ATTR,
  DENSE_BASE_PERCENT,
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  fontPercentOf,
  legacyFontSizes,
  readFontSizes,
  setDenseScreen,
  steppedFontPercent,
  withFontPercent,
} from './fontScale';

// 글자 단계와 여백 한 칸이 모두 rem으로 적혀 있어, <html>의 글자 크기 하나만
// 바꾸면 둘이 같은 비율로 함께 움직인다. 그 약속을 여기에 고정한다.
describe('글자 크기 - 화면마다 % (메모 요청 #145)', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.style.removeProperty('--font-scale');
  });

  it('− / + 는 5%씩, 초기화는 100%', () => {
    expect(FONT_STEP).toBe(5);
    expect(DEFAULT_FONT_PERCENT).toBe(100);
    expect(steppedFontPercent(100, -1)).toBe(95);
    expect(steppedFontPercent(100, 1)).toBe(105);
    expect(steppedFontPercent(135, 0)).toBe(100);
  });

  it('여러 번 누르면 쌓인다 - 끝(50~200%)에서 멈춘다', () => {
    let p = 100;
    for (let i = 0; i < 4; i++) p = steppedFontPercent(p, -1);
    expect(p).toBe(80);
    for (let i = 0; i < 30; i++) p = steppedFontPercent(p, -1);
    expect(p).toBe(FONT_MIN);
    for (let i = 0; i < 60; i++) p = steppedFontPercent(p, 1);
    expect(p).toBe(FONT_MAX);
  });

  it('5% 칸에 맞추고, 숫자가 아니면 100', () => {
    expect(clampFontPercent(92.5)).toBe(95);
    expect(clampFontPercent(91)).toBe(90);
    expect(clampFontPercent(10)).toBe(FONT_MIN);
    expect(clampFontPercent(Number.NaN)).toBe(100);
  });

  it('화면마다 따로 - 적힌 것이 없으면 100, 100은 칸을 뺀다', () => {
    const a = withFontPercent({}, 'board', 85);
    expect(a).toEqual({ board: 85 });
    expect(fontPercentOf(a, 'board')).toBe(85);
    expect(fontPercentOf(a, 'day')).toBe(100);
    const b = withFontPercent(a, 'day', 110);
    expect(b).toEqual({ board: 85, day: 110 });
    expect(withFontPercent(b, 'board', 100)).toEqual({ day: 110 });
  });

  it('읽기는 모양이 틀린 칸을 버린다', () => {
    expect(readFontSizes({ day: 90, week: 'x', 'Bad-Id': 80, memo: 100, month: 92 })).toEqual({ day: 90, month: 90 });
    expect(readFontSizes([90])).toBeUndefined();
    expect(readFontSizes('lg')).toBeUndefined();
  });

  it('옛 다섯 단계는 모든 화면에 같은 %로 옮긴다 (보통은 옮길 것이 없다)', () => {
    expect(legacyFontSizes('lg', ['day', 'popout'])).toEqual({ day: 115, popout: 115 });
    expect(legacyFontSizes('sm', ['day'])).toEqual({ day: 90 });
    expect(legacyFontSizes('md', ['day'])).toBeUndefined();
    expect(legacyFontSizes('없는단계', ['day'])).toBeUndefined();
  });

  it('100%는 값을 비워 둔다 (브라우저 설정을 덮어쓰지 않는다)', () => {
    // 브라우저에서 글자를 키워 둔 사람에게 100%를 박으면 그 뜻이 지워진다
    const root = document.documentElement.style;
    applyFontPercent(130);
    expect(root.getPropertyValue('--font-scale')).toBe('1.3');

    applyFontPercent(100);
    expect(root.getPropertyValue('--font-scale')).toBe('');
    expect(root.fontSize).toBe('');
  });

  it('고른 %를 바탕(100%, PC 한눈에만 90% - index.css)에 곱하게 입힌다', () => {
    const root = document.documentElement.style;
    root.fontSize = '130%'; // 옛 길이 남긴 값은 걷는다
    applyFontPercent(85);
    expect(root.getPropertyValue('--font-scale')).toBe('0.85');
    expect(root.fontSize).toBe('');

    applyFontPercent(115);
    expect(root.getPropertyValue('--font-scale')).toBe('1.15');
  });

  it('PC 한눈에 바탕 90%가 index.css와 같고, 다른 화면은 100% (11-08 80% → 11-09 90% → 같은 날 한눈에만 - 사용자 요청)', () => {
    expect(DENSE_BASE_PERCENT).toBe(90);
    const css = readFileSync('src/index.css', 'utf8');
    // 90%는 html[data-dense](한눈에)에만 - 그냥 html은 100%
    const flat = css.replace(/\s+/g, ' ');
    expect(flat).toContain(
      `html[${DENSE_ATTR}] { font-size: calc(${DENSE_BASE_PERCENT}% * var(--font-scale, 1)); --root-scale: calc(${DENSE_BASE_PERCENT / 100} * var(--font-scale, 1)); }`,
    );
    expect(css).toContain('font-size: calc(100% * var(--font-scale, 1))');
    expect(flat.split(`calc(${DENSE_BASE_PERCENT}% * var(--font-scale`).length - 1).toBe(1);
  });

  it('머리줄([data-fixed-font])은 글자 단계·여백 한 칸을 바탕으로 나눠 늘 100% (메모 요청 #145)', () => {
    const flat = readFileSync('src/index.css', 'utf8').replace(/\s+/g, ' ');
    expect(flat).toContain('--root-scale: var(--font-scale, 1);');
    const block = flat.slice(flat.indexOf('[data-fixed-font] {'));
    // @theme의 여백 한 칸(0.2rem)·2xs(0.625rem)와 같은 값을 나눈다 - @theme을 바꾸면 여기도
    expect(block).toContain('--spacing: calc(0.2rem / var(--root-scale));');
    expect(flat).toContain('--spacing: 0.2rem;');
    expect(block).toContain('--text-2xs: calc(0.625rem / var(--root-scale));');
    expect(flat).toContain('--text-2xs: 0.625rem;');
    for (const t of ['xs', 'sm', 'base', 'lg', 'xl']) expect(block).toContain(`--text-${t}: calc(`);
    expect(block).toContain('font-size: calc(1rem / var(--root-scale));');
    // 머리줄 두 줄의 max-w-7xl(80rem)도 - 빠지면 하루 130%·한눈에 80%에서 단추가 옆으로 밀린다(#145 PC 확인)
    expect(block).toContain('--container-7xl: calc(80rem / var(--root-scale));');
  });

  it('한눈에 표시를 html에 붙이고 뗀다 (P29-1)', () => {
    setDenseScreen(true);
    expect(document.documentElement.hasAttribute(DENSE_ATTR)).toBe(true);
    setDenseScreen(false);
    expect(document.documentElement.hasAttribute(DENSE_ATTR)).toBe(false);
  });
});

/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { FONT_SCALES, DEFAULT_FONT_SCALE, PC_BASE_PERCENT, fontScalePercent, applyFontScale } from './fontScale';

// 글자 단계와 여백 한 칸이 모두 rem으로 적혀 있어, <html>의 글자 크기 하나만
// 바꾸면 둘이 같은 비율로 함께 움직인다. 그 약속을 여기에 고정한다.
describe('글자 크기 단계', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.style.removeProperty('--font-scale');
  });

  it('다섯 단계가 있고 이름이 정해져 있다', () => {
    expect(FONT_SCALES.map((s) => s.label)).toEqual([
      '매우 작게',
      '작게',
      '보통',
      '크게',
      '매우 크게',
    ]);
  });

  it('작은 것에서 큰 것 차례로 놓인다', () => {
    const percents = FONT_SCALES.map((s) => s.percent);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
  });

  it("'보통'은 브라우저가 정한 크기 그대로다", () => {
    expect(DEFAULT_FONT_SCALE).toBe('md');
    expect(fontScalePercent('md')).toBe(100);
  });

  it("'보통'은 값을 비워 둔다 (브라우저 설정을 덮어쓰지 않는다)", () => {
    // 브라우저에서 글자를 키워 둔 사람에게 100%를 박으면 그 뜻이 지워진다
    const root = document.documentElement.style;
    applyFontScale('xl');
    expect(root.getPropertyValue('--font-scale')).toBe('1.3');

    applyFontScale('md');
    expect(root.getPropertyValue('--font-scale')).toBe('');
    expect(root.fontSize).toBe('');
  });

  it('고른 단계를 바탕(휴대폰 100%·PC 90% - index.css)에 곱하게 입힌다', () => {
    const root = document.documentElement.style;
    root.fontSize = '130%'; // 옛 길이 남긴 값은 걷는다
    applyFontScale('xs');
    expect(root.getPropertyValue('--font-scale')).toBe('0.85');
    expect(root.fontSize).toBe('');

    applyFontScale('lg');
    expect(root.getPropertyValue('--font-scale')).toBe('1.15');
  });

  it('PC 바탕 90%가 index.css와 같다 (11-08 80% → 11-09 90% 사용자 요청)', () => {
    expect(PC_BASE_PERCENT).toBe(90);
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain(`font-size: calc(${PC_BASE_PERCENT}% * var(--font-scale, 1))`);
    expect(css).toContain('font-size: calc(100% * var(--font-scale, 1))');
  });

  it('모르는 값이 들어와도 보통 크기로 버틴다', () => {
    expect(fontScalePercent('없는단계' as never)).toBe(100);
  });
});

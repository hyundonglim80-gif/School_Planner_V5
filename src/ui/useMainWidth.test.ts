import { afterEach, describe, expect, it, vi } from 'vitest';
import { unscaledWidth } from './useMainWidth';
import { setDenseScreen } from '../domain/fontScale';

describe('unscaledWidth - PC 한눈에 글자 바탕 90%를 걷은 폭 (11-08 80% → 11-09 90% → 같은 날 한눈에만)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setDenseScreen(false);
  });
  const media = (matches: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q }));

  it('PC(폭 640 이상) 한눈에는 0.9로 나눈다 - 브라우저 확대 90%와 같은 경계', () => {
    media(true);
    setDenseScreen(true);
    expect(unscaledWidth(1152)).toBe(1280);
  });

  it('PC 다른 화면(바탕 100%)은 그대로', () => {
    media(true);
    setDenseScreen(false);
    expect(unscaledWidth(1280)).toBe(1280);
  });

  it('휴대폰은 그대로', () => {
    media(false);
    setDenseScreen(true);
    expect(unscaledWidth(390)).toBe(390);
  });
});

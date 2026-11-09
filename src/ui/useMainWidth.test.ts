import { afterEach, describe, expect, it, vi } from 'vitest';
import { unscaledWidth } from './useMainWidth';

describe('unscaledWidth - PC 글자 바탕 90%를 걷은 폭 (11-08 80% → 11-09 90%)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const media = (matches: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q }));

  it('PC(폭 640 이상)는 0.9로 나눈다 - 브라우저 확대 90%와 같은 경계', () => {
    media(true);
    expect(unscaledWidth(1152)).toBe(1280);
  });

  it('휴대폰은 그대로', () => {
    media(false);
    expect(unscaledWidth(390)).toBe(390);
  });
});

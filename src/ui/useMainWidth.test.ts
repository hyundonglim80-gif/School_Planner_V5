import { afterEach, describe, expect, it, vi } from 'vitest';
import { unscaledWidth } from './useMainWidth';

describe('unscaledWidth - PC 글자 바탕 80%를 걷은 폭 (11-08)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const media = (matches: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q }));

  it('PC(폭 640 이상)는 0.8로 나눈다 - 브라우저 확대 80%와 같은 경계', () => {
    media(true);
    expect(unscaledWidth(1024)).toBe(1280);
  });

  it('휴대폰은 그대로', () => {
    media(false);
    expect(unscaledWidth(390)).toBe(390);
  });
});

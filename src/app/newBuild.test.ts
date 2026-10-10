import { describe, expect, it } from 'vitest';
import { entryOf } from './newBuild';

describe('새 판 알아보기', () => {
  it('index.html의 첫 모듈 스크립트(해시 붙은 /assets/)', () => {
    expect(entryOf('<script type="module" crossorigin src="/assets/index-AbC12.js"></script>')).toBe('/assets/index-AbC12.js');
    expect(entryOf('<script type="module" src="/src/main.tsx"></script>')).toBeNull();
  });
});

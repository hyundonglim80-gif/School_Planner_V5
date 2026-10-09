import { describe, expect, it } from 'vitest';
import { DEFAULT_PHRASES, MAX_PHRASES, addPhrase, sanitizePhrases } from './observationPhrases';

describe('관찰 문구', () => {
  it('빈 것·겹치는 것을 걸러 차례대로', () => {
    expect(sanitizePhrases(['  발표를   잘함 ', '', '발표를 잘함', 3, null])).toEqual(['발표를 잘함', '3']);
    expect(sanitizePhrases('발표')).toEqual([]);
  });
  it('너무 긴 것은 자르고 개수를 넘으면 버린다', () => {
    expect(sanitizePhrases(['가'.repeat(50)])[0]).toHaveLength(40);
    expect(sanitizePhrases(Array.from({ length: 40 }, (_, i) => `문구 ${i}`))).toHaveLength(MAX_PHRASES);
  });
  it('더하기 - 겹침·개수', () => {
    expect(addPhrase(DEFAULT_PHRASES, ' ')).toBeNull();
    expect(addPhrase(DEFAULT_PHRASES, '발표를 잘함')).toEqual({ problem: '이미 있는 문구입니다.' });
    expect(addPhrase(DEFAULT_PHRASES, '  정리를 잘함 ')).toEqual({ list: [...DEFAULT_PHRASES, '정리를 잘함'] });
    const full = Array.from({ length: MAX_PHRASES }, (_, i) => `문구 ${i}`);
    expect(addPhrase(full, '새 문구')).toEqual({ problem: `문구는 ${MAX_PHRASES}개까지 둘 수 있습니다.` });
  });
});

import { describe, expect, it } from 'vitest';
import { composeSharedText, hasSharedParams, shareKey, stripSharedParams } from './share';

// V4 lib/shareTarget.test.ts의 순수 부분
describe('공유받기', () => {
  it('제목·글·주소를 합치되 이미 든 것은 다시 적지 않는다', () => {
    expect(composeSharedText('기사', '읽어 볼 것', 'https://a.kr')).toBe('기사\n읽어 볼 것\nhttps://a.kr');
    expect(composeSharedText('', '읽어 볼 것 https://a.kr', 'https://a.kr')).toBe('읽어 볼 것 https://a.kr');
    expect(composeSharedText('같은 글', '같은 글', '')).toBe('같은 글');
    expect(composeSharedText()).toBe('');
  });
  it('공유 표시 알아보기 · 지우기 (다른 값과 # 뒤는 둔다)', () => {
    expect(hasSharedParams('?share=abc')).toBe(true);
    expect(hasSharedParams('?text=x')).toBe(true);
    expect(hasSharedParams('?as=2')).toBe(false);
    expect(stripSharedParams('https://x.app/?share=abc&as=2#/day')).toBe('/?as=2#/day');
    expect(stripSharedParams('https://x.app/?title=t&text=x')).toBe('/');
  });
  it('캐시 열쇠 = sw.js와 같은 모양', () => {
    expect(shareKey('https://x.app', 'id1', 'meta')).toBe('https://x.app/__sp5share/id1/meta');
  });
});

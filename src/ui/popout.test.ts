import { describe, expect, it } from 'vitest';
import { POPOUT, popoutUrl, readPopoutSpec } from './popout';

describe('새 창으로 옮기기 - 주소 (10-28)', () => {
  it('보통 탭은 새 창이 아니다', () => {
    expect(POPOUT).toBeNull();
    expect(readPopoutSpec('')).toBeNull();
    expect(readPopoutSpec('?as=2')).toBeNull();
  });

  it('주소에 창 id·params를 싣고 그대로 읽는다 - 화면 주소(#)는 빼고 다른 물음은 둔다', () => {
    const url = popoutUrl('note', { sid: 'u_a', date: '2026-10-28', id: 'n1' }, 'http://localhost:5175/?as=2#/day/2026-10-28');
    const u = new URL(url);
    expect(u.hash).toBe('');
    expect(u.searchParams.get('as')).toBe('2');
    expect(readPopoutSpec(u.search)).toEqual({ id: 'note', params: { sid: 'u_a', date: '2026-10-28', id: 'n1' } });
  });

  it('글자로 옮길 수 없는 것(파일)과 이 창에만 돌아가는 쪽지(pickFor)는 뺀다', () => {
    const file = new File(['x'], 'a.png');
    const url = popoutUrl('note', { sid: 'u_a', date: null, pickFor: 'pick3', draftFiles: [file], draftText: '글' }, 'http://x/');
    expect(readPopoutSpec(new URL(url).search)).toEqual({ id: 'note', params: { sid: 'u_a', date: null, draftText: '글' } });
    // params가 없는 창(검색 등)
    expect(readPopoutSpec(new URL(popoutUrl('search', undefined, 'http://x/')).search)).toEqual({ id: 'search', params: undefined });
  });

  it('모양이 틀린 주소는 새 창으로 보지 않는다', () => {
    expect(readPopoutSpec('?popout=%7Bbad')).toBeNull();
    expect(readPopoutSpec(`?popout=${encodeURIComponent('{"params":{}}')}`)).toBeNull();
    expect(readPopoutSpec(`?popout=${encodeURIComponent('null')}`)).toBeNull();
  });
});

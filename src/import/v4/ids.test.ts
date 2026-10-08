import { describe, expect, it } from 'vitest';
import { idlessKey, nthKey, v4id, V4_ID_LENGTH } from './ids';

describe('v4id - V4 자리에서 셈한 V5 id', () => {
  it('같은 자리면 늘 같고, 종류·공간·자리·id 중 하나라도 다르면 다르다', () => {
    const a = v4id('label.event', 'u_me', 'settings/labels', 'ev_1');
    expect(a).toMatch(new RegExp(`^[a-z2-7]{${V4_ID_LENGTH}}$`));
    expect(v4id('label.event', 'u_me', 'settings/labels', 'ev_1')).toBe(a);
    expect(v4id('label.note', 'u_me', 'settings/labels', 'ev_1')).not.toBe(a);
    expect(v4id('label.event', 'g_x', 'settings/labels', 'ev_1')).not.toBe(a);
    expect(v4id('label.event', 'u_me', 'settings/labelz', 'ev_1')).not.toBe(a);
    expect(v4id('label.event', 'u_me', 'settings/labels', 'ev_2')).not.toBe(a);
  });

  it('조각을 이어 붙여 같은 글자가 되어도 다르다', () => {
    expect(v4id('a', 'b', 'c', 'd')).not.toBe(v4id('a', 'bc', '', 'd'));
  });
});

describe('nthKey·idlessKey - id 없는 항목 (DESIGN 8-2)', () => {
  it('같은 열쇠가 다시 나오면 몇째인지를 붙인다', () => {
    const seen = new Map<string, number>();
    expect(idlessKey(seen, '2026-03-02', '청소', '')).toBe('2026-03-02|청소|');
    expect(idlessKey(seen, '2026-03-02', '숙제', '이월')).toBe('2026-03-02|숙제|이월');
    expect(idlessKey(seen, '2026-03-02', '청소', '')).toBe('2026-03-02|청소|#2');
    expect(nthKey(seen, '2026-03-02|청소|')).toBe('2026-03-02|청소|#3');
  });

  it('앞에 다른 항목이 끼어도 열쇠가 밀리지 않는다 (V4 ev_차례와 다르다)', () => {
    const before = new Map<string, number>();
    const k1 = ['회의', '청소'].map((t) => idlessKey(before, 'd', t, ''));
    const after = new Map<string, number>();
    const k2 = ['새 일정', '회의', '청소'].map((t) => idlessKey(after, 'd', t, ''));
    expect(k2.slice(1)).toEqual(k1);
  });
});

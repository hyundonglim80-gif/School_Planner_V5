import { describe, expect, it } from 'vitest';
import { GROUP_SPACE_HUES, PERSONAL_SPACE_HUE, spaceHue, spaceTone } from './spaceColor';

describe('공간 색 (P17-2 - 겹친 것의 배경)', () => {
  it('개인은 정한 빛깔, 그룹은 팔레트에서 - 같은 sid는 늘 같은 빛깔', () => {
    expect(spaceHue('u_abc')).toBe(PERSONAL_SPACE_HUE);
    expect(GROUP_SPACE_HUES).toContain(spaceHue('g_abc'));
    expect(spaceHue('g_abc')).toBe(spaceHue('g_abc'));
    expect(GROUP_SPACE_HUES).not.toContain(PERSONAL_SPACE_HUE);
  });
  it('주 공간 칩(slate·amber)·보통 일정(blue)과 같은 빛깔은 쓰지 않는다', () => {
    for (const h of [PERSONAL_SPACE_HUE, ...GROUP_SPACE_HUES]) expect(['slate', 'amber', 'blue', 'sky', 'indigo']).not.toContain(h);
  });
  it('그룹 여럿이 한 빛깔에 몰리지 않는다', () => {
    const hues = new Set(Array.from({ length: 40 }, (_, i) => spaceHue(`g_${i.toString(36)}xyz`)));
    expect(hues.size).toBe(GROUP_SPACE_HUES.length);
  });
  it('배경·테두리 = 색 테마의 --sp 변수 → 다크 모드가 바꾸는 Tailwind 색 변수 (없으면 밝은 값)', () => {
    const t = spaceTone('u_abc');
    expect(t.backgroundColor).toMatch(/^var\(--sp-emerald-100, var\(--color-emerald-100, oklch\(/);
    expect(t.borderColor).toMatch(/^var\(--sp-emerald-300, var\(--color-emerald-300, oklch\(/);
  });
});

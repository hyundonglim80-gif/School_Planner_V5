import { describe, expect, it } from 'vitest';
import { GROUP_SPACE_COLORS, PERSONAL_SPACE_COLOR, spaceColor } from './spaceColor';

describe('공간 색 (P17-2)', () => {
  it('개인은 정한 색, 그룹은 팔레트에서 - 같은 sid는 늘 같은 색', () => {
    expect(spaceColor('u_abc')).toBe(PERSONAL_SPACE_COLOR);
    expect(GROUP_SPACE_COLORS).toContain(spaceColor('g_abc'));
    expect(spaceColor('g_abc')).toBe(spaceColor('g_abc'));
  });
  it('그룹 여럿이 한 색에 몰리지 않는다', () => {
    const colors = new Set(Array.from({ length: 40 }, (_, i) => spaceColor(`g_${i.toString(36)}xyz`)));
    expect(colors.size).toBeGreaterThan(4);
  });
});

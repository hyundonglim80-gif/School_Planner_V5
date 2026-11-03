// 공간 색 (P17-2 겹쳐 보기 - 겹친 칩·겹친 일정의 배경·테두리. 11-02 사용자 '✓·색 점 대신 배경 색으로 구분'). 저장하지 않고 sid로 셈한다
// (원칙 넷째 - 공간 문서에 색 칸을 두면 규칙·배포가 는다). 개인 = 초록, 그룹 = 팔레트에서 sid 해시(기기가 달라도 같은 색, 그룹 둘이 같은 색일 수 있다 - 이름은 title·구분 줄에).
// 빛깔은 주 공간 칩(개인 slate·그룹 amber)·보통 일정 바탕(파랑·흰색)·이월(amber)과 헷갈리지 않는 것만 쓴다.
// 색은 Tailwind 색 변수로 칠한다 - 다크 모드(theme.css)가 그 변수를 어두운 빛깔로 바꿔 어두운 화면에서도 맞는다.
// 쓰는 클래스가 없으면 Tailwind가 변수를 빼므로 밝은 값(theme.css 그대로)을 뒤에 둔다.

const LIGHT = {
  emerald: { 100: 'oklch(95% 0.052 163.051)', 300: 'oklch(84.5% 0.143 164.978)' },
  violet: { 100: 'oklch(94.3% 0.029 294.588)', 300: 'oklch(81.1% 0.111 293.571)' },
  rose: { 100: 'oklch(94.1% 0.03 12.58)', 300: 'oklch(81% 0.117 11.638)' },
  lime: { 100: 'oklch(96.7% 0.067 122.328)', 300: 'oklch(89.7% 0.196 126.665)' },
  fuchsia: { 100: 'oklch(95.2% 0.037 318.852)', 300: 'oklch(83.3% 0.145 321.434)' },
  cyan: { 100: 'oklch(95.6% 0.045 203.388)', 300: 'oklch(86.5% 0.127 207.078)' },
} as const;
export type SpaceHue = keyof typeof LIGHT;

export const PERSONAL_SPACE_HUE: SpaceHue = 'emerald';
export const GROUP_SPACE_HUES: readonly SpaceHue[] = ['violet', 'rose', 'lime', 'fuchsia', 'cyan'];

/** FNV-1a (32비트) - 짧은 글자를 고르게 흩는다 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function spaceHue(sid: string): SpaceHue {
  if (!sid.startsWith('g_')) return PERSONAL_SPACE_HUE;
  return GROUP_SPACE_HUES[hash(sid) % GROUP_SPACE_HUES.length];
}

/** 겹친 것의 배경·테두리 (그대로 style에 - 클래스의 바탕·테두리보다 앞선다) */
export interface SpaceTone {
  backgroundColor: string;
  borderColor: string;
}

export function spaceTone(sid: string): SpaceTone {
  const h = spaceHue(sid);
  // --sp-<빛깔>: 색 테마가 강조와 가까운 공간 색을 다른 빛깔로 바꾼다(theme.css - domain/themeCss spaceSwaps). 없으면 그 빛깔 그대로
  return {
    backgroundColor: `var(--sp-${h}-100, var(--color-${h}-100, ${LIGHT[h][100]}))`,
    borderColor: `var(--sp-${h}-300, var(--color-${h}-300, ${LIGHT[h][300]}))`,
  };
}

/** 공간 이름 글자 '🔒 개인' · '👥 그룹 이름' (겹친 일정의 title·구분 줄) */
export const spaceTitle = (space: { sid: string; name: string }) => `${space.sid.startsWith('g_') ? '👥' : '🔒'} ${space.name}`;

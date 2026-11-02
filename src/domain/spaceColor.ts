// 공간 색 (P17-2 겹쳐 보기 - 겹친 일정 앞 점·칩의 점). 저장하지 않고 sid로 셈한다(원칙 넷째 - 공간 문서에 색 칸을 두면 규칙·배포가 는다).
// 개인 = 정한 한 색, 그룹 = 팔레트에서 sid 해시(기기가 달라도 같은 색). 그룹 둘이 같은 색일 수 있다 - 이름은 title·구분 줄에.
// 점·테두리로만 쓰는 500 빛깔 - 밝은 바탕·어두운 바탕(dark.css는 이 인라인 색을 바꾸지 않는다) 모두에서 보인다.

export const PERSONAL_SPACE_COLOR = '#64748b';

export const GROUP_SPACE_COLORS = ['#f59e0b', '#14b8a6', '#8b5cf6', '#f43f5e', '#0ea5e9', '#84cc16', '#d946ef', '#f97316'] as const;

/** FNV-1a (32비트) - 짧은 글자를 고르게 흩는다 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function spaceColor(sid: string): string {
  if (!sid.startsWith('g_')) return PERSONAL_SPACE_COLOR;
  return GROUP_SPACE_COLORS[hash(sid) % GROUP_SPACE_COLORS.length];
}

/** 공간 이름 글자 '🔒 개인' · '👥 그룹 이름' (겹친 일정의 점·구분 줄 title) */
export const spaceTitle = (space: { sid: string; name: string }) => `${space.sid.startsWith('g_') ? '👥' : '🔒'} ${space.name}`;

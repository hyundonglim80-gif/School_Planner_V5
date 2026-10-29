// 개발자 계정 가르기 (V4 lib/developers.ts 그대로 - P14-2). 환경설정 '개발자' 탭을 이 계정에만 보인다.
// 화면에 보이냐 마느냐일 뿐 보안 경계가 아니다 - 막는 것은 규칙(firestore.rules `isDeveloper()`)이다. 두 목록을 늘 같게 둔다.
export const DEVELOPER_EMAILS = ['hyundonglim@gmail.com', 'hyundonglim80@gmail.com', 'hyundonglim.work@gmail.com'] as const;

export function isDeveloper(email?: string | null): boolean {
  if (!email) return false;
  return (DEVELOPER_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

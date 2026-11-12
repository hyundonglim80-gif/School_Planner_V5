// 관리자 계정 (P33-1 - 11-12 사용자 '세 계정을 관리자로, 필요하면 관리자를 더할 수 있게').
//   기본 관리자 = 처음 개발자 셋(domain/developers - 규칙 isDeveloper와 같은 목록). 늘 관리자이고 화면에서 뺄 수 없다(아무도 관리자가 아니게 되는 일을 막는다).
//   더한 관리자 = 관리자가 적은 메일(서버 `admin/admins` emails - data/admins). 메일 확인된 계정만(규칙 isAdmin이 본다).
// 화면에 보이냐 마느냐일 뿐 보안 경계가 아니다 - 막는 것은 규칙(firestore.rules `isAdmin()`)이다.
import { DEVELOPER_EMAILS, isDeveloper } from './developers';

export const BASE_ADMIN_EMAILS: readonly string[] = DEVELOPER_EMAILS;

/** 더한 관리자는 이만큼까지 (규칙도 같은 수를 본다) */
export const MAX_EXTRA_ADMINS = 50;

/** 기본 관리자인가 (뺄 수 없는 셋) */
export const isBaseAdmin = (email?: string | null): boolean => isDeveloper(email);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 적은 메일 → 견줄 모양(앞뒤 띄어쓰기 걷고 소문자). 메일 모양이 아니면 null */
export function normalizeAdminEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/** 서버 문서 → 더한 관리자 목록 (모양이 틀린 것·같은 것·기본 셋은 뺀다) */
export function readAdminEmails(data: unknown): string[] {
  const list = data && typeof data === 'object' ? (data as { emails?: unknown }).emails : undefined;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const v of list) {
    const e = normalizeAdminEmail(v);
    if (e && !isBaseAdmin(e) && !out.includes(e)) out.push(e);
  }
  return out.slice(0, MAX_EXTRA_ADMINS);
}

/** 이 메일이 관리자인가 (기본 셋 또는 더한 목록) */
export function isAdminEmail(email: string | null | undefined, extra: readonly string[]): boolean {
  if (isBaseAdmin(email)) return true;
  const e = normalizeAdminEmail(email);
  return !!e && extra.includes(e);
}

export type AddAdminResult = { ok: true; list: string[]; email: string } | { ok: false; reason: 'invalid' | 'base' | 'dup' | 'full' };

/** 목록에 더하기 - 틀린 까닭은 화면이 알린다 */
export function addAdminEmail(list: readonly string[], input: string): AddAdminResult {
  const email = normalizeAdminEmail(input);
  if (!email) return { ok: false, reason: 'invalid' };
  if (isBaseAdmin(email)) return { ok: false, reason: 'base' };
  if (list.includes(email)) return { ok: false, reason: 'dup' };
  if (list.length >= MAX_EXTRA_ADMINS) return { ok: false, reason: 'full' };
  return { ok: true, list: [...list, email], email };
}

/** 목록에서 빼기 (기본 셋은 목록에 없으니 빠지지 않는다) */
export function removeAdminEmail(list: readonly string[], input: string): string[] {
  const email = normalizeAdminEmail(input);
  return list.filter((e) => e !== email);
}

export const ADD_ADMIN_REASON: Record<Exclude<AddAdminResult, { ok: true }>['reason'], string> = {
  invalid: '메일 주소 모양이 아닙니다.',
  base: '기본 관리자입니다(늘 관리자).',
  dup: '이미 관리자입니다.',
  full: `관리자는 기본 셋 말고 ${MAX_EXTRA_ADMINS}명까지 더할 수 있습니다.`,
};

import { describe, it, expect } from 'vitest';
import {
  addAdminEmail,
  BASE_ADMIN_EMAILS,
  isAdminEmail,
  isBaseAdmin,
  MAX_EXTRA_ADMINS,
  normalizeAdminEmail,
  readAdminEmails,
  removeAdminEmail,
} from './admins';
import rules from '../../firestore.rules?raw';

describe('관리자 계정 (P33-1)', () => {
  it('기본 관리자 = 개발자 셋', () => {
    expect(BASE_ADMIN_EMAILS).toHaveLength(3);
    for (const e of BASE_ADMIN_EMAILS) expect(isBaseAdmin(e)).toBe(true);
    expect(isBaseAdmin('teacher@example.com')).toBe(false);
  });

  it('메일 다듬기 - 띄어쓰기·대문자, 모양이 아니면 null', () => {
    expect(normalizeAdminEmail('  New.Admin@Example.COM ')).toBe('new.admin@example.com');
    expect(normalizeAdminEmail('no-at-sign')).toBeNull();
    expect(normalizeAdminEmail('a b@example.com')).toBeNull();
    expect(normalizeAdminEmail('a@b')).toBeNull();
    expect(normalizeAdminEmail(3)).toBeNull();
  });

  it('서버 문서 읽기 - 틀린 것·같은 것·기본 셋은 뺀다', () => {
    expect(readAdminEmails({ emails: ['A@x.com', 'a@x.com', 'bad', 7, BASE_ADMIN_EMAILS[0], 'b@y.org'] })).toEqual(['a@x.com', 'b@y.org']);
    expect(readAdminEmails(null)).toEqual([]);
    expect(readAdminEmails({ emails: 'a@x.com' })).toEqual([]);
  });

  it('관리자인가 - 기본 셋 또는 목록', () => {
    expect(isAdminEmail(BASE_ADMIN_EMAILS[1], [])).toBe(true);
    expect(isAdminEmail('A@x.com', ['a@x.com'])).toBe(true);
    expect(isAdminEmail('c@x.com', ['a@x.com'])).toBe(false);
    expect(isAdminEmail('', ['a@x.com'])).toBe(false);
    expect(isAdminEmail(null, [])).toBe(false);
  });

  it('더하기 - 틀린 모양·기본 셋·같은 메일·꽉 참', () => {
    expect(addAdminEmail([], ' New@Example.com')).toEqual({ ok: true, list: ['new@example.com'], email: 'new@example.com' });
    expect(addAdminEmail([], 'nope')).toEqual({ ok: false, reason: 'invalid' });
    expect(addAdminEmail([], BASE_ADMIN_EMAILS[2].toUpperCase())).toEqual({ ok: false, reason: 'base' });
    expect(addAdminEmail(['a@x.com'], 'A@x.com')).toEqual({ ok: false, reason: 'dup' });
    const full = Array.from({ length: MAX_EXTRA_ADMINS }, (_, i) => `a${i}@x.com`);
    expect(addAdminEmail(full, 'z@x.com')).toEqual({ ok: false, reason: 'full' });
  });

  it('빼기 - 그 메일만, 기본 셋은 목록에 없다', () => {
    expect(removeAdminEmail(['a@x.com', 'b@x.com'], 'A@X.com')).toEqual(['b@x.com']);
    expect(removeAdminEmail(['a@x.com'], BASE_ADMIN_EMAILS[0])).toEqual(['a@x.com']);
  });

  it('규칙: 관리자 자리가 isAdmin을 쓰고 목록 수가 같다', () => {
    expect(rules).toMatch(/function isAdmin\(\)/);
    expect(rules).toContain('/admin/admins');
    expect(rules).toContain(`request.resource.data.emails.size() <= ${MAX_EXTRA_ADMINS}`);
    // isDeveloper를 직접 쓰는 곳은 isAdmin 안 한 곳뿐 (공휴일·관리자 문서·나이스 키·오류 기록은 isAdmin)
    expect(rules.match(/isDeveloper\(\)/g)).toHaveLength(2);
  });
});

import { describe, it, expect } from 'vitest';
import { DEVELOPER_EMAILS, isDeveloper } from './developers';
import rules from '../../firestore.rules?raw';

describe('개발자 계정', () => {
  it('목록의 메일 - 대소문자·앞뒤 띄어쓰기는 보지 않는다', () => {
    expect(isDeveloper('hyundonglim80@gmail.com')).toBe(true);
    expect(isDeveloper(' HyunDongLim80@Gmail.com ')).toBe(true);
  });

  it('목록 밖·빈 값은 아니다', () => {
    expect(isDeveloper('teacher@example.com')).toBe(false);
    expect(isDeveloper('hyundonglim80@gmail.com.evil.com')).toBe(false);
    expect(isDeveloper('')).toBe(false);
    expect(isDeveloper(null)).toBe(false);
    expect(isDeveloper(undefined)).toBe(false);
  });

  it('규칙(firestore.rules isDeveloper)과 같은 목록', () => {
    const block = rules.match(/function isDeveloper\(\) \{[\s\S]*?\]/)![0];
    const inRules = [...block.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]);
    expect(inRules).toEqual([...DEVELOPER_EMAILS]);
  });
});

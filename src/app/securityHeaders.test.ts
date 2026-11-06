// firebase.json 보안 헤더 지키기 (P22-6). 파일 글자는 node:fs로 (앱 tsconfig에 node 형이 없어 이 파일에만)
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8');

const rules: { source?: string; headers: { key: string; value: string }[] }[] = JSON.parse(read('firebase.json')).hosting.headers;
const headers = rules.find((rule) => rule.source === '**')?.headers ?? [];
const csp = headers.find((h) => h.key === 'Content-Security-Policy-Report-Only')?.value ?? '';
const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('CSP', () => {
  it('index.html 인라인 스크립트의 해시가 script-src에 있다 - 글자 하나만 고쳐도 해시가 바뀐다', () => {
    // 저장소는 LF다 (.gitattributes) - 운영 빌드도 LF로 받는다
    const html = read('index.html').replace(/\r\n/g, '\n');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline).toHaveLength(1);
    for (const body of inline) {
      const hash = createHash('sha256').update(body, 'utf8').digest('base64');
      expect(directive('script-src')).toContain(`'sha256-${hash}'`);
    }
  });

  it('스크립트는 풀어 두지 않는다 - 글 안에 심긴 스크립트를 막는 것이 CSP의 뜻이다', () => {
    expect(directive('script-src')).not.toBe('');
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('script-src')).not.toContain("'unsafe-eval'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
  });
});

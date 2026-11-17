/// <reference types="node" />
// re2js 대신(re2jsStub.ts)이 안전한지 지킨다 - Firebase를 올리면(Dependabot) 여기서 먼저 깨진다(P25-1).
// 1) 브라우저 판 Firestore가 RE2JS를 쓰는 곳이 파이프라인 식 셋(like·regex_contains·regex_match)뿐이고, 모두 try 안이다.
// 2) 앱이 파이프라인을 부르지 않는다. 3) vite 설정이 re2js를 이것으로 바꾼다. 4) 대신 것은 던진다(→ Firestore가 '오류 값'으로 받는다).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RE2JS } from './re2jsStub';

const ROOT = join(__dirname, '..', '..');
/** 큰 파일을 통째로 읽는 시험 - 바쁜 PC(에뮬레이터를 켠 채 전체 단위 시험)에서 기본 5초를 넘겨 틀렸다(P41-1) */
const FILE_READ_MS = 30_000;
const FS_DIST = join(ROOT, 'node_modules', '@firebase', 'firestore', 'dist');

/** vite가 받는 브라우저 판(package.json exports '.' browser import)과 그것이 부르는 common 파일 */
function browserBuild(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'node_modules', '@firebase', 'firestore', 'package.json'), 'utf8'));
  const entry: string = pkg.exports['.'].browser.import;
  const index = readFileSync(join(ROOT, 'node_modules', '@firebase', 'firestore', entry), 'utf8');
  const commons = [...new Set([...index.matchAll(/from '\.\/(common-[\w-]+\.esm\.js)'/g)].map((m) => m[1]))];
  return [index, ...commons.map((f) => readFileSync(join(FS_DIST, f), 'utf8'))].join('\n');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe('re2js 대신 (첫 화면 JS)', () => {
  it('Firestore 브라우저 판은 파이프라인 식 셋에서만, try 안에서 RE2JS를 쓴다', () => {
    const code = browserBuild().replace(/\r\n/g, '\n');
    const uses = [...code.matchAll(/RE2JS\./g)].map((m) => m.index!);
    expect(uses.length).toBe(3);
    const owners = uses.map((at) => {
      // 쓰기 바로 앞의 클래스 - 앞 글 전체를 정규식으로 훑지 않고 뒤에서 찾는다(P41-1 - 파일이 커서 느렸다)
      const declAt = code.lastIndexOf('class __PRIVATE_', at);
      expect(declAt).toBeGreaterThanOrEqual(0);
      const cls = /^class (__PRIVATE_\w+)/.exec(code.slice(declAt, declAt + 200))![1];
      // 그 클래스 안, 쓰기 앞에 try { 가 있고 그 뒤로 catch가 아직 없다 (= try 안)
      const near = code.slice(declAt, at);
      const tryAt = near.lastIndexOf('try {');
      expect(tryAt, `${cls}의 RE2JS가 try 밖이다`).toBeGreaterThanOrEqual(0);
      expect(near.slice(tryAt)).not.toContain('catch');
      return cls;
    });
    expect(new Set(owners)).toEqual(new Set(['__PRIVATE_CoreLike', '__PRIVATE_CoreRegexContains', '__PRIVATE_CoreRegexMatch']));
    // 그 셋은 이름이 like·regex_contains·regex_match인 파이프라인 식에서만 만든다
    for (const [name, cls] of [['like', 'CoreLike'], ['regex_contains', 'CoreRegexContains'], ['regex_match', 'CoreRegexMatch']]) {
      const made = [...code.matchAll(new RegExp(`new __PRIVATE_${cls}\\(`, 'g'))];
      expect(made.length).toBe(1);
      expect(code.slice(made[0].index! - 80, made[0].index!)).toContain(`"${name}" === `);
    }
  }, FILE_READ_MS);

  it('앱은 Firestore 파이프라인을 부르지 않는다', () => {
    const offenders = sourceFiles(join(ROOT, 'src')).filter((f) => /firestore\/pipelines|['"]re2js['"]/.test(readFileSync(f, 'utf8')) && !f.endsWith('re2jsStub.ts'));
    expect(offenders).toEqual([]);
  }, FILE_READ_MS);

  it('vite 설정이 re2js를 이 파일로 바꾼다', () => {
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/re2js:\s*fileURLToPath\(new URL\('\.\/src\/data\/re2jsStub\.ts'/);
  });

  it('대신 것은 정규식을 만들지 않고 던진다', () => {
    expect(() => RE2JS.compile()).toThrow(/re2js/);
  });
});

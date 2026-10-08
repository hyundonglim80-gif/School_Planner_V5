import { describe, expect, it } from 'vitest';

// 가져오기 경계 (DESIGN 8-1). 파일 내용은 Vite의 ?raw로 읽는다(node:fs는 앱 tsconfig에 Node 타입이 없다 - windowConventions.test).
//   - 옛 모양 읽기(import/v4/legacy)는 가져오기만 쓴다. V5 본체가 V3·V4 모양을 알기 시작하면 옛 짐이 다시 쌓인다.
//   - V4 자리(users/{uid}·groups/{gid})를 부르는 곳은 가져오기뿐이다 - V5는 V4 자료를 읽기만 하고, 그것도 여기서만.

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const files = Object.entries(sources).map(([path, src]) => ({ name: path.replace(/^\//, ''), src }));
const outside = files.filter((f) => !f.name.startsWith('src/import/'));

describe('가져오기 경계', () => {
  it('파일을 찾았다', () => {
    expect(outside.length).toBeGreaterThan(50);
    expect(files.some((f) => f.name === 'src/import/v4/legacy/eventText.ts')).toBe(true);
  });

  it.each(outside)('$name - 옛 모양 읽기(legacy)를 import하지 않는다', ({ src }) => {
    expect(src).not.toMatch(/import\/v4\/legacy|from ['"][./]*legacy\//);
  });

  it.each(outside)("$name - V4 자리('users'·'groups')를 부르지 않는다", ({ src }) => {
    expect(src).not.toMatch(/\b(?:doc|collection)\(\s*db\s*,\s*['"](?:users|groups)['"]/);
    expect(src).not.toMatch(/['"`](?:users|groups)\/\$\{/);
  });
});

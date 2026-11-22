// 모양 단계 지키기 (P54-4 - 작은 모양 통일). 파일 글자는 node:fs로 (앱 tsconfig에 node 형이 없어 이 파일에만)
//   모서리 = 작은 것(rounded·sm·xs) · 단추·칸 lg · 카드·창 xl · 칩 full - md·2xl·3xl은 lg·xl로 묶었다.
//   그림자 = 카드·단추 xs · 뜨는 판(창·메뉴·알림·손잡이) lg 둘 - 2xs·sm·md·xl·2xl은 쓰지 않는다.
//   새로 쓰려면 이 둘 중에서 고른다(늘리려면 PLAN 5장 'P54-4 정한 것'에 까닭과 함께 여기도).
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const files: string[] = [];
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !e.name.includes('.test.')) files.push(p);
  }
};
walk(SRC);

const PREFIX = String.raw`(?<![\w-])(?:[a-z0-9@\[\]._-]+:)*`;
const find = (step: string) => {
  const re = new RegExp(PREFIX + step + String.raw`(?![\w/-])`, 'g');
  const hits: string[] = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    text.split('\n').forEach((line, i) => {
      if (re.test(line)) hits.push(`${relative(SRC, f)}:${i + 1}`);
      re.lastIndex = 0;
    });
  }
  return hits;
};

describe('모양 단계 (P54-4)', () => {
  it('파일을 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('모서리 md·2xl·3xl을 쓰지 않는다 - 단추·칸 lg, 카드·창 xl', () => {
    expect(find(String.raw`rounded(?:-[trblse]{1,2})?-(?:md|2xl|3xl)`)).toEqual([]);
  });

  it('그림자는 xs(카드·단추)와 lg(뜨는 판) 둘', () => {
    expect(find(String.raw`shadow-(?:2xs|sm|md|xl|2xl)`)).toEqual([]);
  });
});

// tools/first-screen-js.mjs - 첫 화면 JS 크기 지키기 (P50-1).
//
//   npm run build && node tools/first-screen-js.mjs      (CI check 일의 빌드 뒤 - npm run check:size)
//   LIMIT_KB=360 node tools/first-screen-js.mjs           (정한 값을 잠깐 바꿔 보기)
//
// 빌드가 내는 조각 목록(dist/asset-manifest.json - vite.config `build.manifest`)에서
// 입구(index.html) + 하루 화면(DayScreen)이 정적으로 부르는 조각을 모두 모아 파일마다 gzip(level 9) 크기를 더한다.
// 브라우저·에뮬레이터 없이 몇 초 - inspect-perf(1만 항목 + 미리 보기, 한 번 2~3분)는 무거워 CI 밖이라 그 대신 늘 잰다.
// inspect-perf보다 4KB쯤 작게 나온다: 앱이 열며 나눠 받는 작은 조각(설정 되돌리기 등)은 정적 닫힘 밖이다(PLAN 5장 'P50-1 정한 것').
//
// 정한 값을 넘으면 CI가 틀린다 → 첫 화면에 붙은 것을 누를 때·열 때 받게 나누거나(DESIGN 10장 12),
// 꼭 필요하면 까닭을 PLAN 5장에 적고 아래 LIMIT_KB를 올린다.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/** 정한 값(KB, gzip) - 11-21 운영 빌드 369.7KB + 여유 10KB. 이 셈으로 P49-3 전(inspect-perf 385KB)은 381.5KB라
 *  '줄여야 한다'고 정했던 그때를 잡는다(PLAN 5장 'P50-1 정한 것') */
export const LIMIT_KB = 380;

/** 첫 화면 = 입구 + 하루 화면(앱을 열면 처음 받는 화면 - inspect-perf도 `#/day/…`로 잰다) */
export const ROOTS = ['index.html', 'src/features/day/DayScreen.tsx'];

/** 조각 목록에서 roots가 정적으로 부르는(imports) 조각을 모두 - 나눠 받는 것(dynamicImports)은 따라가지 않는다 */
export function staticClosure(manifest, roots = ROOTS) {
  const seen = new Set();
  const order = [];
  const walk = (key, from) => {
    if (seen.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw new Error(from ? `'${from}'이 부르는 조각 '${key}'가 목록에 없습니다` : `조각 목록에 '${key}'가 없습니다 - 파일을 옮겼으면 ROOTS를 고칩니다`);
    seen.add(key);
    order.push(key);
    for (const next of chunk.imports ?? []) walk(next, key);
  };
  for (const root of roots) walk(root);
  return order.map((key) => manifest[key].file);
}

/** 파일마다 gzip 크기(큰 것부터)와 합 - readFile은 dist 안 경로를 받아 Buffer를 돌려준다 */
export function measure(manifest, readFile, roots = ROOTS) {
  const rows = staticClosure(manifest, roots).map((file) => ({ file, gz: gzipSync(readFile(file), { level: 9 }).length }));
  rows.sort((a, b) => b.gz - a.gz || a.file.localeCompare(b.file));
  return { rows, total: rows.reduce((sum, r) => sum + r.gz, 0) };
}

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

function main() {
  const dist = process.env.DIST || 'dist';
  const manifestPath = join(dist, 'asset-manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`✘ ${manifestPath}이 없습니다 - 먼저 npm run build`);
    process.exit(1);
  }
  const limit = Number(process.env.LIMIT_KB || LIMIT_KB);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { rows, total } = measure(manifest, (file) => readFileSync(join(dist, file)));

  console.log(`첫 화면 JS (입구 + 하루 화면, 정적 import · gzip) - ${rows.length}개 파일`);
  for (const r of rows.slice(0, 12)) console.log(`  ${kb(r.gz).padStart(9)}  ${r.file}`);
  if (rows.length > 12) console.log(`  ${kb(rows.slice(12).reduce((s, r) => s + r.gz, 0)).padStart(9)}  그 밖 ${rows.length - 12}개`);
  if (total > limit * 1024) {
    console.error(`✘ 첫 화면 JS ${kb(total)} - 정한 값 ${limit}KB를 넘었습니다`);
    console.error('  첫 화면에 새로 붙은 것을 누를 때·열 때 받게 나누거나(DESIGN 10장 12), 꼭 필요하면 까닭을 PLAN 5장에 적고 tools/first-screen-js.mjs LIMIT_KB를 올립니다.');
    process.exit(1);
  }
  console.log(`✔ 첫 화면 JS ${kb(total)} (정한 값 ${limit}KB · 남은 ${kb(limit * 1024 - total)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

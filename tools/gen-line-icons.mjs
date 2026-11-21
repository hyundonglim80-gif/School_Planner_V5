// tools/gen-line-icons.mjs - 선 아이콘 경로 파일(src/ui/iconPaths.ts)을 만든다 (P53-3).
//
//   npm pack lucide-static@1.77.0 && tar xzf lucide-static-*.tgz   (저장소 밖 아무 곳 - 의존성으로 넣지 않는다, 2,400여 개 중 쓰는 것만 베낀다)
//   LUCIDE=<풀어 둔 package 폴더> node tools/gen-line-icons.mjs
//
// 아이콘을 더하려면 아래 NAMES에 lucide 이름을 넣고 다시 돌린다. 이모지 → 아이콘 바꿈표는 src/ui/glyphs.ts.
// lucide 아이콘은 ISC 라이선스(https://lucide.dev/license) - 만든 파일 머리에 적는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NAMES = [
  'alarm-clock', 'armchair', 'bell', 'bell-off', 'book-open', 'bot', 'calendar-days', 'calendar-range', 'chart-column', 'graduation-cap', 'library', 'newspaper',
  'circle-check', 'clipboard-list', 'clock', 'compass', 'crown', 'files', 'folder-open', 'hand', 'hourglass', 'image',
  'inbox', 'keyboard', 'layout-template', 'lightbulb', 'link', 'list-checks', 'lock', 'log-out', 'megaphone',
  'message-circle', 'notebook-pen', 'palette', 'paperclip', 'pen-line', 'pencil', 'pin', 'printer', 'repeat', 'save',
  'school', 'search', 'settings', 'sparkles', 'sprout', 'star', 'sticky-note', 'table', 'tag', 'target', 'trash-2',
  'user', 'users',
];

const dir = process.env.LUCIDE;
if (!dir) {
  console.error('LUCIDE=<lucide-static package 폴더>를 주세요');
  process.exit(1);
}
const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
const lines = [];
for (const name of [...NAMES].sort()) {
  const svg = readFileSync(join(dir, 'icons', `${name}.svg`), 'utf8');
  const inner = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/\s+\/>/g, '/>')
    .trim();
  lines.push(`  '${name}': '${inner}',`);
}
const out = `// src/ui/iconPaths.ts - tools/gen-line-icons.mjs가 만든다(손으로 고치지 않는다). lucide-static ${version} (ISC - https://lucide.dev/license)
// 아이콘마다 <svg viewBox="0 0 24 24"> 안쪽 - ui/Icon이 선 굵기·색(currentColor)을 입힌다.
export const ICON_PATHS = {
${lines.join('\n')}
} as const;

export type IconName = keyof typeof ICON_PATHS;
`;
writeFileSync('src/ui/iconPaths.ts', out);
console.log(`아이콘 ${NAMES.length}개 → src/ui/iconPaths.ts (lucide ${version})`);

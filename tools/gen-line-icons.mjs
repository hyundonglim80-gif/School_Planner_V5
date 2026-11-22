// tools/gen-line-icons.mjs - 선 아이콘 경로 파일(src/ui/iconPaths.ts · iconPathsLazy.ts)을 만든다 (P53-3 · P54-1).
//
//   npm pack lucide-static@1.77.0 && tar xzf lucide-static-*.tgz   (저장소 밖 아무 곳 - 의존성으로 넣지 않는다, 2,400여 개 중 쓰는 것만 베낀다)
//   LUCIDE=<풀어 둔 package 폴더> node tools/gen-line-icons.mjs
//
// 아이콘을 더하려면 아래 목록에 lucide 이름을 넣고 다시 돌린다. 이모지 → 아이콘 바꿈표는 src/ui/glyphs.ts.
//   NAMES      = 첫 화면(머리줄·하루 화면·카드·안내 띠)에도 쓰는 것 → iconPaths.ts (첫 화면 JS에 든다)
//   LAZY_NAMES = 창 안에서만 쓰는 것 → iconPathsLazy.ts (나눠 받는다 - ui/Icon이 앱을 연 뒤 미리 받고, 그 전에 그리면 빈 칸 → 받으면 다시 그린다)
//   어느 쪽인지 모르면 NAMES - 첫 화면 JS(npm run check:size)가 남는 만큼만. 첫 화면에 쓰는데 LAZY면 처음 한 번 아이콘이 늦게 뜬다.
// lucide 아이콘은 ISC 라이선스(https://lucide.dev/license) - 만든 파일 머리에 적는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NAMES = [
  'alarm-clock', 'armchair', 'backpack', 'ban', 'bell', 'bell-off', 'book-open', 'book-open-text', 'bot', 'calendar', 'calendar-days',
  'calendar-range', 'chart-column', 'check', 'circle-check', 'clipboard-list', 'clock', 'compass', 'corner-down-right', 'download', 'file-text',
  'files', 'flag', 'folder', 'folder-open', 'footprints', 'graduation-cap', 'hand', 'hourglass', 'image', 'inbox', 'keyboard', 'library',
  'lightbulb', 'link', 'lock', 'log-out', 'map', 'map-pin', 'megaphone', 'message-circle', 'newspaper', 'notebook-pen', 'palette', 'paperclip',
  'pencil', 'pin', 'presentation', 'printer', 'refresh-cw', 'repeat', 'rewind', 'save', 'school', 'search', 'settings', 'siren', 'skip-forward',
  'smartphone', 'sprout', 'sticky-note', 'sun', 'table', 'tag', 'target', 'trash-2', 'tree-palm', 'triangle-alert', 'undo-2', 'user', 'users',
  'utensils', 'volume-x', 'wifi-off',
];

const LAZY_NAMES = [
  'archive', 'archive-restore', 'brush-cleaning', 'camera', 'circle-help', 'cloud', 'crown', 'dices', 'eraser', 'flask-conical', 'history',
  'house', 'key-round', 'layout-grid', 'layout-template', 'list-checks', 'list-ordered', 'lock-open', 'paintbrush', 'pen-line', 'puzzle',
  'share-2', 'shopping-cart', 'snowflake', 'sparkles', 'star', 'timer',
];

const dir = process.env.LUCIDE;
if (!dir) {
  console.error('LUCIDE=<lucide-static package 폴더>를 주세요');
  process.exit(1);
}
const both = NAMES.filter((n) => LAZY_NAMES.includes(n));
if (both.length) {
  console.error(`두 목록에 함께 있는 이름: ${both.join(', ')}`);
  process.exit(1);
}
const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
const linesOf = (names) =>
  [...names].sort().map((name) => {
    const svg = readFileSync(join(dir, 'icons', `${name}.svg`), 'utf8');
    const inner = svg
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>[\s\S]*$/, '')
      .replace(/\s*\n\s*/g, '')
      .replace(/\s+\/>/g, '/>')
      .trim();
    return `  '${name}': '${inner}',`;
  });
const head = (file) => `// src/ui/${file} - tools/gen-line-icons.mjs가 만든다(손으로 고치지 않는다). lucide-static ${version} (ISC - https://lucide.dev/license)
// 아이콘마다 <svg viewBox="0 0 24 24"> 안쪽 - ui/Icon이 선 굵기·색(currentColor)을 입힌다.`;

writeFileSync(
  'src/ui/iconPaths.ts',
  `${head('iconPaths.ts')}
// 첫 화면에도 쓰는 것 - 창 안에서만 쓰는 것은 iconPathsLazy.ts(나눠 받는다).
import type { LazyIconName } from './iconPathsLazy';

export const ICON_PATHS = {
${linesOf(NAMES).join('\n')}
} as const;

export type IconName = keyof typeof ICON_PATHS | LazyIconName;
`,
);
writeFileSync(
  'src/ui/iconPathsLazy.ts',
  `${head('iconPathsLazy.ts')}
// 창 안에서만 쓰는 것 - ui/Icon이 나눠 받는다(첫 화면 JS 밖, P54-1).
export const LAZY_ICON_PATHS = {
${linesOf(LAZY_NAMES).join('\n')}
} as const;

export type LazyIconName = keyof typeof LAZY_ICON_PATHS;
`,
);
console.log(`아이콘 ${NAMES.length}개 → src/ui/iconPaths.ts · 나눠 받는 ${LAZY_NAMES.length}개 → src/ui/iconPathsLazy.ts (lucide ${version})`);

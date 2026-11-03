// tools/gen-theme-css.mjs (P20-1 - 옛 gen-dark-css.mjs)
//
// 화면 밝기(어둡게)·색 테마의 색표 src/theme.css를 만든다. 색을 바꾸려면 src/domain/palettes.json(테마 값)이나
// src/domain/themeCss.ts(색 셈)를 고치고 다시 돌린다:
//   node tools/gen-theme-css.mjs
// themeCss.ts는 Node 24가 타입만 벗겨 바로 부른다. 시험(themeCss.test)이 파일이 JSON과 맞는지 본다 - 돌리지 않으면 깨진다.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildThemeCss } from '../src/domain/themeCss.ts';

const tw = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
const palettes = JSON.parse(readFileSync('src/domain/palettes.json', 'utf8'));
const css = buildThemeCss(tw, palettes);
writeFileSync('src/theme.css', css);
console.log(`src/theme.css: ${css.split('\n').length}줄, 테마 ${palettes.palettes.length}개`);

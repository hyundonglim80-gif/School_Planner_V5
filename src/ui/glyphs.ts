// 이모지 → 선 아이콘 바꿈표 (P53-3 사용자 'UI를 세련되게' → 권장안 '다'): 머리줄·단추의 이모지를 같은 두께·한 색(글자색)의 선 아이콘으로.
//   같은 이모지 = 같은 아이콘(화면 어디서나) - 설명서 글의 같은 이모지도 이 표로 그 아이콘이 된다(HelpWindow renderInline → glyphText).
//   이름 글자('메모'·'시간표'·'저장')는 그대로, 앞의 그림만 바뀐다(5장 P53 정한 것). 표에 없는 이모지는 그대로 이모지로 보인다.
//   ☐·☑은 넣지 않는다 - 메모 글의 체크 줄 글자다(본문은 바꾸지 않는다, CLAUDE.md 4장).
import type { IconName } from './iconPaths';

export const GLYPHS: Readonly<Record<string, IconName>> = {
  '⏳': 'hourglass',
  '🗑': 'trash-2',
  '🔍': 'search',
  '📅': 'calendar-days',
  '🗓': 'calendar-range',
  '📋': 'clipboard-list',
  '📊': 'chart-column',
  '📝': 'notebook-pen',
  '🗒': 'sticky-note',
  '🏫': 'school',
  '🧭': 'compass',
  '⏰': 'alarm-clock',
  '🕘': 'clock',
  '⚙': 'settings',
  '🔔': 'bell',
  '🔕': 'bell-off',
  '📢': 'megaphone',
  '📘': 'book-open',
  '🎯': 'target',
  '🙋': 'hand',
  '🪑': 'armchair',
  '🏷': 'tag',
  '📥': 'inbox',
  '🔗': 'link',
  '✏': 'pencil',
  '📎': 'paperclip',
  '⭐': 'star',
  '📑': 'files',
  '📌': 'pin',
  '🔒': 'lock',
  '📂': 'folder-open',
  '🖼': 'image',
  '🔁': 'repeat',
  '👥': 'users',
  '🧑': 'user',
  '💬': 'message-circle',
  '🚪': 'log-out',
  '💾': 'save',
  '🖨': 'printer',
  '💡': 'lightbulb',
  '⌨': 'keyboard',
  '✨': 'sparkles',
  '🎨': 'palette',
  '🌱': 'sprout',
  '👑': 'crown',
  '🤖': 'bot',
  '✅': 'circle-check',
  '📰': 'newspaper',
  '📚': 'library',
  // P54-1 창 안 단추·탭·제목 (11-22)
  '⚠': 'triangle-alert',
  '✔': 'check',
  '🔄': 'refresh-cw',
  '📴': 'wifi-off',
  '👤': 'user',
  '🚫': 'ban',
  '☁': 'cloud',
  '🧹': 'brush-cleaning',
  '📷': 'camera',
  '📆': 'calendar',
  '🍚': 'utensils',
  '♻': 'archive-restore',
  '📤': 'share-2',
  '📁': 'folder',
  '↪': 'corner-down-right',
  '↩': 'undo-2',
  '🔑': 'key-round',
  '🏠': 'house',
  '🏖': 'tree-palm',
  '🧩': 'puzzle',
  '🕒': 'clock',
  '🔇': 'volume-x',
  '🎌': 'flag',
  '📍': 'map-pin',
  '📖': 'book-open-text',
  '❔': 'circle-help',
  '🛒': 'shopping-cart',
  '🗂': 'layout-grid',
  '⏭': 'skip-forward',
  '⬇': 'download',
  '🎲': 'dices',
  '🔢': 'list-ordered',
  '📱': 'smartphone',
  '🕰': 'history',
  '🗺': 'map',
  '🗄': 'archive',
  '📄': 'file-text',
  '⏱': 'timer',
  '🚨': 'siren',
  '🧪': 'flask-conical',
  '⏪': 'rewind',
  '👣': 'footprints',
  '🧽': 'eraser',
  '🎒': 'backpack',
  '🔓': 'lock-open',
  '🖌': 'paintbrush',
  '☀': 'sun',
  '❄': 'snowflake',
  // 글자 삼각형 → 꺾쇠 (P54-4 - 접기·펴기·날짜 넘기기·칸 손잡이·차례 ▲▼·이어지는 기간 ◂▸·목록 ▾ - 같은 뜻 삼각형은 한 모양).
  //   큰 것·작은 것 모두 같은 꺾쇠. 소리 '▶ 미리 듣기'(재생)는 바꿈표를 거치지 않는 글이라 그대로.
  '▶': 'chevron-right',
  '▸': 'chevron-right',
  '◀': 'chevron-left',
  '◂': 'chevron-left',
  '▼': 'chevron-down',
  '▾': 'chevron-down',
  '▲': 'chevron-up',
  '▴': 'chevron-up',
  // 붙은 이모지(ZWJ) - 통째로 한 칸 (학급 도구: 학생 기록·명렬표 · 교사 유형)
  '🧑‍🎓': 'graduation-cap',
  '🧑‍🤝‍🧑': 'users',
  '👩‍🏫': 'presentation',
};

/** 이모지의 모양 고르개(U+FE0F)를 뗀 것 - '🗑️'와 '🗑'가 같은 칸 */
export const bareEmoji = (e: string) => e.replace(/\uFE0F/g, '');

/** 이 이모지가 바뀌는 아이콘 (없으면 undefined) */
export const glyphIcon = (e: string): IconName | undefined => GLYPHS[bareEmoji(e)];

/**
 * 글 안에서 바꿈표 이모지를 찾는 식 (모양 고르개까지 함께). 긴 것(붙은 이모지)부터 견주고, 바꿈표에 없는 붙은 이모지의 앞 글자만 떼지 않게
 * 뒤에 ZWJ(U+200D)가 오면 견주지 않는다('🧑‍🍳'의 '🧑'을 사람 아이콘으로 바꾸면 요리사가 깨진다).
 */
export const GLYPH_RE = new RegExp(
  `(${Object.keys(GLYPHS)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\uFE0F?(?!\\u200D)`,
  'gu',
);

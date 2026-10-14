// 사용 설명서의 내용을 모으는 곳 (V4 lib/helpTopics.ts - P9-1). 화면(HelpWindow)은 이것을 그리기만 한다.
// 장마다 파일 하나(chapters/*.ts) - 아래 차례가 설명서 첫 화면의 차례다.
//
// ⚠️ 바꿀 수 있는 값은 글로 적지 않는다.
//    단축키는 환경설정에서 바꿀 수 있고, 이월 기간도 그렇다. 여기에 키 조합이나
//    날 수를 글로 적어 두면 사용자가 값을 바꾼 순간 설명서가 거짓말을 한다(V4에서 실제로
//    그랬다). 아래 자리표를 쓰면 그리는 순간의 실제 값으로 바뀐다.
//      {key:scopeDay}   그 기능에 지금 걸려 있는 단축키
//      {lookback}       환경설정 '학교' 탭 이월 기간의 날 수
//    그 밖의 꾸밈
//      **굵게**
//      [[topic-id|보이는 글]]   다른 항목으로 가는 연결
//
// 새 기능을 만들면 여기에도 한 줄 넣는다. 설명서에 없는 기능은 사용자에게는 없는 기능이나 마찬가지다.
// 동작을 바꾸면 설명서도 같은 커밋에서 고친다(CLAUDE.md 6장). 창의 설명서 주제는 창 목록의 `help`.
import type { ShortcutId } from '../../domain/shortcuts';
import attachments from './chapters/attachments';
import classroom from './chapters/classroom';
import events from './chapters/events';
import find from './chapters/find';
import lessons from './chapters/lessons';
import notes from './chapters/notes';
import settings from './chapters/settings';
import share from './chapters/share';
import start from './chapters/start';
import trouble from './chapters/trouble';
import views from './chapters/views';
import type { HelpCategory, HelpTopic } from './types';

export type { HelpBlock, HelpCategory, HelpExample, HelpTopic } from './types';

export const HELP_CATEGORIES: HelpCategory[] = [start, views, events, lessons, notes, attachments, classroom, find, share, settings, trouble];

// ── 자리표 풀기 ────────────────────────────────────────────────────────

export interface HelpValues {
  /** 그 기능에 지금 걸린 단축키를 보여줄 글 (예: 'Alt + D', '없음') */
  keyOf: (id: ShortcutId) => string;
  lookback: number;
}

/** 글 안의 꾸밈과 자리표를 찾는 정규식. 화면과 검색이 같은 것을 쓴다. */
export const INLINE_TOKEN = /(\*\*[^*]+\*\*|\{key:[A-Za-z]+\}|\{lookback\}|\[\[[a-z0-9-]+\|[^\]]+\]\])/g;

/** 꾸밈을 걷고 자리표를 실제 값으로 바꾼 맨 글자 (검색에 쓴다) */
export function plainText(text: string, values: HelpValues): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\{key:([A-Za-z]+)\}/g, (_, id) => values.keyOf(id as ShortcutId))
    .replace(/\{lookback\}/g, String(values.lookback))
    .replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1');
}

/** 한 항목의 글을 모두 이어 붙인다 (검색에 쓴다) */
export function topicText(topic: HelpTopic, values: HelpValues): string {
  const parts: string[] = [topic.title, topic.summary];
  for (const ex of topic.examples) parts.push(ex.title, ...ex.steps);
  for (const block of topic.blocks) {
    switch (block.t) {
      case 'p':
      case 'h':
      case 'tip':
      case 'note':
        parts.push(block.text);
        break;
      case 'ul':
      case 'ol':
        parts.push(...block.items);
        break;
      case 'table':
        parts.push(...block.head, ...block.rows.flat());
        break;
      case 'shortcuts':
        parts.push('단축키');
        break;
    }
  }
  return parts.map((s) => plainText(s, values)).join('\n');
}

export const ALL_HELP_TOPICS: Array<HelpTopic & { category: HelpCategory }> = HELP_CATEGORIES.flatMap((category) =>
  category.topics.map((topic) => ({ ...topic, category })),
);

export function findHelpTopic(id: string) {
  return ALL_HELP_TOPICS.find((t) => t.id === id);
}

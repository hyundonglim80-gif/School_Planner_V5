// 설명서 내용의 모양 (V4 lib/helpTopics.ts 앞부분 - P9-1). 장은 chapters/*.ts, 모으는 곳·자리표 풀기는 topics.ts.
//
// 세 층으로 되어 있다: 기능별 분류(장) → 세부 기능(topics) → 세부 설명(blocks)과 사용 예(examples). 첫 화면은 분류만 보여 준다.

export type HelpBlock =
  | { t: 'p'; text: string }
  /** 작은 제목 */
  | { t: 'h'; text: string }
  | { t: 'ul'; items: string[] }
  /** 차례대로 따라 하는 순서 */
  | { t: 'ol'; items: string[] }
  | { t: 'tip'; text: string }
  | { t: 'note'; text: string }
  /** 왼쪽 칸(누르는 것) / 오른쪽 칸(하는 일) 표 */
  | { t: 'table'; head: [string, string]; rows: Array<[string, string]> }
  /** 환경설정의 단축키를 그대로 펼친 표 */
  | { t: 'shortcuts' };

/** 사용 예: 실제로 겪을 만한 일 하나를 처음부터 끝까지 따라 하는 순서 */
export interface HelpExample {
  title: string;
  steps: string[];
}

/** 세부 기능 */
export interface HelpTopic {
  /** 창 목록의 `help`가 이 id를 가리킨다 (app/windowList) */
  id: string;
  icon: string;
  title: string;
  /** 목록에 한 줄로 보이는 설명 */
  summary: string;
  /** 세부 설명 */
  blocks: HelpBlock[];
  /** 사용 예. 모든 기능에 하나 이상 둔다. */
  examples: HelpExample[];
  /** 함께 보면 좋은 항목 */
  related?: string[];
}

/** 기능별 분류(장). 설명서 첫 화면에 카드로 보인다. */
export interface HelpCategory {
  id: string;
  icon: string;
  title: string;
  /** 첫 화면 카드에 보이는 한 줄 */
  summary: string;
  topics: HelpTopic[];
}

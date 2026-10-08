// V4 lib/eventText.ts에서 옮긴 읽기 (DESIGN 8-1 '옛 모양 읽기는 여기에만'). V5 본체는 이것을 import하지 않는다(legacy.test).
//
// V4 일정 문서(events/{날짜})는 V3와 함께 쓰려고 같은 내용을 eventList(배열)와 eventText(글) 두 칸에 둔다.
// 읽기는 eventList가 비었을 때만 옛 eventText를 푼다(V4와 같다 - 한쪽만 고친 옛 문서가 있다).
// 쓰는 쪽(formatV3EventText·eventDocPayload)은 V5가 V4에 쓰지 않으므로 옮기지 않았다.

/** V4·V3 일정 하나 (모르는 칸이 많다 - 가져오기가 칸마다 읽는다) */
export interface V3EventLike {
  id: string;
  content: string;
  completed?: boolean;
  label?: string;
  [key: string]: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** 항목의 글. V4는 content, V3와 일부 창은 text */
export function eventContentOf(item: unknown): string {
  const o = isObj(item) ? item : {};
  return String(o.content ?? o.text ?? '').trim();
}

/** V3 글 모양 '[v] [라벨] 글' 한 줄씩 → 일정 목록 */
export function parseV3EventText(rawText: string): V3EventLike[] {
  if (!rawText || !rawText.trim()) return [];
  const list: V3EventLike[] = [];
  rawText.split('\n').forEach((line, idx) => {
    let t = line.trim();
    if (!t) return;
    let completed = false;
    if (t.startsWith('[v]') || t.startsWith('[V]')) {
      completed = true;
      t = t.substring(3).trim();
    }
    let label = '';
    const labelMatch = t.match(/^\[(.*?)\]\s*(.*)$/);
    let content = t;
    if (labelMatch) {
      label = labelMatch[1].trim();
      content = labelMatch[2].trim();
    }
    const contentStr = content || t;
    const contentHash = Math.abs(contentStr.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)).toString(36);
    list.push({ id: 'ev_t_' + idx + '_' + contentHash, content: contentStr, completed, label: label || undefined });
  });
  return list;
}

/**
 * 문서에서 일정 목록을 읽는 V4의 표준 길. eventList가 비었을 때만 옛 eventText를 푼다.
 * ⚠️ id 없는 항목에는 V4 화면과 같은 `ev_차례`를 붙인다 - 그날 목록이 바뀌면 밀리므로 가져오기는 이 id를 믿지 않는다
 *    (V5 id는 ids.idlessKey - DESIGN 8-2). id가 있는 항목은 같은 객체를 그대로 돌려준다.
 */
export function readEventList(data: unknown): V3EventLike[] {
  const d = isObj(data) ? data : {};
  const list = d.eventList;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item: unknown, idx: number) =>
      isObj(item) && item.id !== undefined && item.id !== null && item.id !== ''
        ? item
        : { ...(isObj(item) ? item : {}), id: 'ev_' + idx },
    ) as V3EventLike[];
  }
  if (typeof d.eventText === 'string' && d.eventText) return parseV3EventText(d.eventText);
  return [];
}

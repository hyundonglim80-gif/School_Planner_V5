// 결정적 id (DESIGN 8-2). V5 id = V4 자리에서 셈한 값 - 그래서 여러 번 가져와도 겹치지 않고, 링크도 상대를 찾지 않고 바로 셈한다.
//
//   v4id(종류, 공간, 자리, V4 id) = sha1을 base32로 20자 (newId와 같은 길이)
//
// ⚠️ V3가 id 없이 쓴 일정은 V4 readEventList가 `ev_차례`를 붙인다 - 그날 목록이 바뀌면 차례가 밀려 다른 항목이 된다.
//    id가 없는 것은 `날짜|글|라벨`로 셈하고, 같은 날 같은 글이 둘이면 몇째인지를 붙인다(nthKey).
import { hashText } from './hash';

export const V4_ID_LENGTH = 20;

/**
 * V4 자리 → V5 id. kind = 무엇인가('label.event'·'item.event' …, 같은 V4 id라도 종류가 다르면 다른 문서),
 * sid = 가져와 넣는 V5 공간, path = V4 문서 자리(공간 밑 - 'settings/labels', 'events/2026-03-02'), v4Id = 그 안의 V4 id(또는 nthKey).
 */
export function v4id(kind: string, sid: string, path: string, v4Id: string): string {
  return hashText([kind, sid, path, v4Id].join('\u0001'), V4_ID_LENGTH);
}

/**
 * 같은 열쇠가 여러 번 나오면 몇째인지를 붙인다(처음은 그대로, 둘째부터 '#2' …). seen은 한 묶음(그날 목록) 안에서 함께 쓴다.
 * 예: 같은 날 id 없는 '청소' 둘 → '2026-03-02|청소|' · '2026-03-02|청소|#2'
 */
export function nthKey(seen: Map<string, number>, base: string): string {
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}#${n}`;
}

/** id 없는 V4 항목의 열쇠 (DESIGN 8-2): 날짜|글|라벨 */
export const idlessKey = (seen: Map<string, number>, date: string, text: string, label: string) =>
  nthKey(seen, `${date}|${text}|${label}`);

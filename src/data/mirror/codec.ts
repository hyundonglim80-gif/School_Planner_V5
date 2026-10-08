// 기기 사본에 넣고 꺼낼 때 문서 모양을 지킨다 (DESIGN 6-2).
//
// IndexedDB는 값을 구조 복제로 담아 Firestore Timestamp의 모양(class)을 잃는다 - 꺼내면 `{ seconds, nanoseconds }` 맵이 되어
// 되돌리기·영구 지우기로 다시 적을 때 규칙의 `deletedAt is timestamp`에 걸린다(P2-1에서 넘겨받은 것).
// 그래서 넣을 때 시각을 표시한 모양(`{ $ts: [초, 나노초] }`)으로 바꾸고, 꺼낼 때 Timestamp로 되살린다.
import { Timestamp } from 'firebase/firestore';

type Plain = Record<string, unknown>;

const TS = '$ts';

/** 시각 → 표시한 모양 (배열·맵 속까지) */
export function encodeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return { [TS]: [value.seconds, value.nanoseconds] };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value !== null && typeof value === 'object') {
    const out: Plain = {};
    for (const [k, v] of Object.entries(value)) out[k] = encodeValue(v);
    return out;
  }
  return value;
}

function isEncodedTime(value: Plain): value is { [TS]: [number, number] } {
  const t = value[TS];
  return Array.isArray(t) && t.length === 2 && typeof t[0] === 'number' && typeof t[1] === 'number' && Object.keys(value).length === 1;
}

/** 표시한 모양 → Timestamp (배열·맵 속까지) */
export function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value !== null && typeof value === 'object') {
    if (isEncodedTime(value as Plain)) {
      const [s, ns] = (value as Plain)[TS] as [number, number];
      return new Timestamp(s, ns);
    }
    const out: Plain = {};
    for (const [k, v] of Object.entries(value)) out[k] = decodeValue(v);
    return out;
  }
  return value;
}

export const encodeDoc = (doc: Plain): Plain => encodeValue(doc) as Plain;
export const decodeDoc = (doc: Plain): Plain => decodeValue(doc) as Plain;

/** 서버 시각 견주기 (없는 쪽이 앞). a가 b보다 늦으면 양수 */
export function compareTime(a: Timestamp | null | undefined, b: Timestamp | null | undefined): number {
  if (!a) return b ? -1 : 0;
  if (!b) return 1;
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

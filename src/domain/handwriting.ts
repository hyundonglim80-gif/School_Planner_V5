// 손글씨 그림판의 셈 (메모 쓰는 칸 ✏️ 손글씨 - notes/HandwritingPad). 그린 것은 PNG로 바꿔 첨부(드라이브)로 붙인다.
//   - 펜(S펜 등)은 누르는 힘에 따라 굵기가 바뀐다. 마우스·손가락은 같은 굵기.
//   - 펜을 한 번 쓰면 그 뒤로 손가락(손바닥)은 그리지 않는다 - 펜으로 쓰는 동안 화면에 닿는 손바닥이 줄을 긋지 않게.
//   - 펜 옆 단추(또는 펜 뒤 지우개)를 누른 채 그으면 지우개.

/** 점 하나 - 화면(CSS px) 자리와 그 자리의 굵기 */
export interface PenPoint {
  x: number;
  y: number;
  w: number;
}

/** 한 번 그은 줄 (지우개도 줄 하나) */
export interface PenStroke {
  color: string;
  erase: boolean;
  points: PenPoint[];
}

/** 펜 색 (이름 = data-pen-color 값) */
export const PEN_COLORS = [
  { id: 'black', label: '검정', value: '#1e293b' },
  { id: 'blue', label: '파랑', value: '#2563eb' },
  { id: 'red', label: '빨강', value: '#dc2626' },
  { id: 'green', label: '초록', value: '#16a34a' },
] as const;

/** 펜 굵기 (CSS px) */
export const PEN_SIZES = [
  { id: 'thin', label: '가늘게', value: 2 },
  { id: 'normal', label: '보통', value: 4 },
  { id: 'thick', label: '굵게', value: 8 },
] as const;

/** 지우개 굵기 (CSS px) */
export const ERASER_SIZE = 28;

/**
 * 그 점의 굵기. 펜은 누르는 힘(0~1)에 따라 0.4배~1.6배, 힘을 모르면(0) 그대로.
 * 마우스는 누르는 동안 늘 0.5라 힘을 보지 않는다.
 */
export function penWidth(size: number, pressure: number, pointerType: string): number {
  if (pointerType !== 'pen' || !(pressure > 0)) return size;
  const p = Math.min(Math.max(pressure, 0), 1);
  return Math.round(size * (0.4 + p * 1.2) * 100) / 100;
}

/** 이 손가락·펜으로 그리나 - 펜을 쓴 뒤로는 손가락(손바닥)은 그리지 않는다 */
export function acceptsPointer(pointerType: string, penSeen: boolean): boolean {
  if (pointerType === 'touch') return !penSeen;
  return true;
}

/** 지우개로 긋나 - 펜 옆 단추(buttons 2) · 펜 뒤 지우개(buttons 32) */
export function isEraserPress(pointerType: string, buttons: number): boolean {
  if ((buttons & 32) !== 0) return true;
  return pointerType === 'pen' && (buttons & 2) !== 0;
}

/** 그린 것이 있나 (지우개만 그었으면 없다) */
export function hasInk(strokes: PenStroke[]): boolean {
  return strokes.some((s) => !s.erase && s.points.length > 0);
}

/**
 * 그린 줄을 둘러싼 네모 (+ 둘레 pad px), 화면 크기(maxW·maxH) 안으로. 그린 것이 없으면 null.
 * 그림으로 바꿀 때 빈 둘레를 잘라 낸다 - 화면 가득 흰 바탕이 첨부 카드를 차지하지 않게.
 */
export function inkBounds(strokes: PenStroke[], pad: number, maxW: number, maxH: number): { x: number; y: number; w: number; h: number } | null {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const s of strokes) {
    if (s.erase) continue;
    for (const p of s.points) {
      const r = p.w / 2;
      x1 = Math.min(x1, p.x - r);
      y1 = Math.min(y1, p.y - r);
      x2 = Math.max(x2, p.x + r);
      y2 = Math.max(y2, p.y + r);
    }
  }
  if (x1 === Infinity) return null;
  const x = Math.max(0, Math.floor(x1 - pad));
  const y = Math.max(0, Math.floor(y1 - pad));
  const right = Math.min(maxW, Math.ceil(x2 + pad));
  const bottom = Math.min(maxH, Math.ceil(y2 + pad));
  if (right <= x || bottom <= y) return null;
  return { x, y, w: right - x, h: bottom - y };
}

/** 첨부 이름 - '손글씨_20261021_142530.png' */
export function handwritingName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `손글씨_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.png`;
}

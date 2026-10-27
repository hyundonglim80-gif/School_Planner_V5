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
  { id: 'white', label: '흰색', value: '#ffffff' },
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

/** 처음 펜 색 - 그림판 바탕이 화면색이라 어두운 화면은 흰색, 밝은 화면은 검정 */
export function defaultPenColor(dark: boolean): string {
  return dark ? '#ffffff' : '#1e293b';
}

// ─── 크게·작게 보기 · 아래로 길게 쓰기 ───
// 종이 = 폭은 그림판 폭, 높이는 paperH(처음 = 그림판 높이). 화면에는 종이의 (x, y)부터 배율 scale로 보인다: 화면 = (종이 − 시작) × scale.
// 줄은 종이 자리로 적으므로 배율을 바꾸거나 내려 봐도 그린 것은 그대로다.
// 종이는 그린 것 아래로 늘 한 화면이 더 있다(paperHeight) - 아래로 내려 이어 쓰면 또 늘어난다(10-28 사용자 요청 - 긴 필기).

/** 보는 자리 - 종이의 왼쪽 위 (x, y)부터 배율 scale */
export interface PadView {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;
/** + / − 단추 한 번 */
export const ZOOM_STEP = 1.25;
export const VIEW_1: PadView = { scale: 1, x: 0, y: 0 };
/** 종이 높이 끝 (CSS px) - 그림으로 바꿀 때 캔버스가 너무 커지지 않게(휴대폰 캔버스 한도) */
export const PAPER_MAX_H = 8000;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** 배율은 범위 안, 보는 자리는 종이(폭 w·높이 paperH - 주지 않으면 그림판 높이 h) 밖으로 나가지 않게 */
export function clampView(v: PadView, w: number, h: number, paperH = h): PadView {
  const scale = clamp(v.scale, ZOOM_MIN, ZOOM_MAX);
  return { scale, x: clamp(v.x, 0, Math.max(0, w - w / scale)), y: clamp(v.y, 0, Math.max(0, Math.max(paperH, h) - h / scale)) };
}

/** 화면 자리 (cx, cy)를 그 자리에 둔 채 배율을 바꾼다 (+ / − 단추 = 화면 가운데, Ctrl+휠 = 마우스 자리) */
export function zoomAt(v: PadView, scale: number, cx: number, cy: number, w: number, h: number, paperH = h): PadView {
  const s = clamp(scale, ZOOM_MIN, ZOOM_MAX);
  const px = v.x + cx / v.scale;
  const py = v.y + cy / v.scale;
  return clampView({ scale: s, x: px - cx / s, y: py - cy / s }, w, h, paperH);
}

/**
 * 두 손가락 벌리기·오므리기·옮기기. 시작할 때의 보는 자리·두 손가락 가운데·거리 → 지금 가운데·거리.
 * 시작 가운데 밑의 종이 자리가 지금 가운데 밑에 오게 한다.
 */
export function pinchView(
  start: PadView,
  c0: { x: number; y: number },
  d0: number,
  c: { x: number; y: number },
  d: number,
  w: number,
  h: number,
  paperH = h,
): PadView {
  const s = clamp(start.scale * (d0 > 0 ? d / d0 : 1), ZOOM_MIN, ZOOM_MAX);
  const px = start.x + c0.x / start.scale;
  const py = start.y + c0.y / start.scale;
  return clampView({ scale: s, x: px - c.x / s, y: py - c.y / s }, w, h, paperH);
}

/** 한 손가락으로 옮기기 (펜을 쓴 뒤 - 손가락은 그리지 않는다) · 휠 굴리기 */
export function panView(start: PadView, dx: number, dy: number, w: number, h: number, paperH = h): PadView {
  return clampView({ ...start, x: start.x - dx / start.scale, y: start.y - dy / start.scale }, w, h, paperH);
}

/**
 * 종이 높이. 그린 것(지우개 줄 빼고)의 맨 아래 밑으로 한 화면(h)을 더 둔다 - 내려 보면 늘 빈 곳이 있다.
 * 줄어들지 않는다(prev - 되돌리기로 맨 아래 줄을 지워도 보던 자리가 튀지 않게). 그림판 높이보다 작지 않고 PAPER_MAX_H를 넘지 않는다.
 */
export function paperHeight(strokes: PenStroke[], h: number, prev = 0): number {
  let bottom = 0;
  for (const s of strokes) {
    if (s.erase) continue;
    for (const p of s.points) bottom = Math.max(bottom, p.y + p.w / 2);
  }
  const want = bottom > 0 ? bottom + h : h;
  return Math.ceil(Math.max(h, Math.min(PAPER_MAX_H, Math.max(prev, want))));
}

/**
 * 오른쪽 스크롤 막대 (그림판 높이 h 안의 자리 px). 종이가 한 화면에 다 보이면 null.
 * 막대 길이 = 보이는 몫, 자리 = 보는 자리의 몫. 너무 작지 않게 24px.
 */
export function scrollThumb(v: PadView, h: number, paperH: number): { top: number; size: number } | null {
  const shown = h / v.scale;
  if (paperH <= shown + 0.5) return null;
  const size = Math.max(24, (shown / paperH) * h);
  const room = h - size;
  const range = paperH - shown;
  return { top: range > 0 ? (v.y / range) * room : 0, size };
}

/** 스크롤 막대를 dy(px)만큼 끌었을 때의 보는 자리 */
export function dragThumb(start: PadView, dy: number, h: number, paperH: number, w: number): PadView {
  const t = scrollThumb(start, h, paperH);
  if (!t) return start;
  const room = h - t.size;
  const range = paperH - h / start.scale;
  return clampView({ ...start, y: start.y + (room > 0 ? (dy / room) * range : 0) }, w, h, paperH);
}

/** 그림으로 바꿀 때 배율 - 크게 보며 잘게 쓴 것도 보이게 최대 3배, 긴 쪽이 3000px를 넘지 않게 */
export function exportScale(w: number, h: number): number {
  const long = Math.max(w, h, 1);
  return Math.max(1, Math.min(3, 3000 / long));
}

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
 * 그린 줄을 둘러싼 네모 (+ 둘레 pad px), 종이 크기(maxW·maxH) 안으로. 그린 것이 없으면 null.
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

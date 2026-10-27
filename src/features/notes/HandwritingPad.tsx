// 손글씨 그림판 (메모 쓰는 칸 ✏️ 손글씨). 화면 가득 덮는다 - 사진 크게 보기·🎯 뽑기 크게 보기처럼 (오른쪽 칸에 넣으면 쓸 자리가 좁다).
//   - 바탕은 화면색(밝은 화면 흰색·어두운 화면 어두운 색), 처음 펜은 그 반대(검정·흰색) - 10-21 사용자 요청. 그림도 그 바탕으로 저장한다.
//   - 펜(S펜 등)은 누르는 힘으로 굵기가 바뀌고, 펜을 쓰면 그 뒤로 손바닥(손가락)은 그리지 않는다. 마우스·손가락도 그린다.
//   - 펜 옆 단추(펜 뒤 지우개)를 누른 채 그으면 지우개. ↶ = 마지막 줄 지우기(Ctrl+Z), 🗑️ 모두 지우기.
//   - 크게·작게 보기(10-21 사용자 요청): 두 손가락 벌리기·오므리기(옮기기도) · 머리 − 100% + (100%를 누르면 처음 크기) · PC Ctrl+휠·Ctrl+ +/−/0.
//     펜을 쓴 뒤에는 한 손가락으로 옮긴다(휠도). 굵기는 화면에 보이는 대로 - 크게 보며 쓰면 그만큼 가는 줄로 적힌다.
//   - 아래로 길게 쓰기(10-28 사용자 요청): 종이는 그린 것 아래로 늘 한 화면이 더 있다 - 휠·오른쪽 막대 끌기·두 손가락(펜을 쓴 뒤는 한 손가락)으로 내려 이어 쓴다.
//   - 💾 저장(Ctrl+S) = 그린 둘레만 잘라 PNG로 → 쓰는 칸이 드라이브에 올려 첨부로 붙이고 메모도 저장한다(10-28 사용자 요청 - 옛 ✓ 첨부는 첨부만).
//   - 닫기·ESC·뒤로가기는 닫기만 한다 - 그리던 것은 쓰는 칸이 들고 있다가 다시 열면 이어 그린다(저장하면 비운다).
//   셈은 domain/handwriting.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalLayer } from '../../app/history';
import { showToast } from '../../app/toast';
import {
  acceptsPointer,
  clampView,
  defaultPenColor,
  ERASER_SIZE,
  exportScale,
  handwritingName,
  hasInk,
  inkBounds,
  isEraserPress,
  panView,
  PEN_COLORS,
  PEN_SIZES,
  paperHeight,
  penWidth,
  pinchView,
  scrollThumb,
  dragThumb,
  VIEW_1,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  zoomAt,
  type PadView,
  type PenPoint,
  type PenStroke,
} from '../../domain/handwriting';
import { useBodyScrollLock } from '../../ui/useBodyScrollLock';
import { useVisualViewport } from '../../ui/useVisualViewport';

interface Props {
  /** 그리던 것 (다시 열면 이어 그린다) */
  strokes: PenStroke[];
  /** 한 줄을 다 그을 때마다 - 쓰는 칸이 들고 있는다 */
  onChange: (strokes: PenStroke[]) => void;
  onClose: () => void;
  /** 💾 저장 - 그린 것을 PNG 파일로 (쓰는 칸이 첨부하고 메모를 저장한다) */
  onDone: (file: File) => void;
}

/** 그림으로 바꿀 때 그린 줄 둘레에 남기는 여백 (CSS px) */
const EXPORT_PAD = 16;

// 고른 펜은 이 탭에서 기억한다 (다시 열 때 같은 펜). 색은 화면 밝기마다 - 어두운 화면에서 고른 흰색이 밝은 화면으로 따라가지 않게
const lastColor: Record<'light' | 'dark', string | null> = { light: null, dark: null };
let lastSize: number = PEN_SIZES[1].value;

type Pt = { x: number; y: number };
/** 손가락 둘 = 크게·작게·옮기기, 펜을 쓴 뒤의 손가락 하나 = 옮기기 */
type Gesture =
  | { kind: 'pinch'; ids: [number, number]; start: PadView; c0: Pt; d0: number }
  | { kind: 'pan'; id: number; start: PadView; p0: Pt }
  /** 오른쪽 스크롤 막대 끌기 (마우스·손가락·펜) */
  | { kind: 'thumb'; id: number; start: PadView; y0: number };

const isDark = () => document.documentElement.classList.contains('dark');
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function paintDot(ctx: CanvasRenderingContext2D, s: PenStroke, p: PenPoint) {
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
  ctx.fill();
}

function paintSegment(ctx: CanvasRenderingContext2D, s: PenStroke, a: PenPoint, b: PenPoint) {
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = (a.w + b.w) / 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** 줄들을 종이 자리로 그린다 (변환은 부르는 쪽이 맞춘다) */
function paintStrokes(ctx: CanvasRenderingContext2D, strokes: PenStroke[]) {
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    paintDot(ctx, s, s.points[0]);
    for (let i = 1; i < s.points.length; i++) paintSegment(ctx, s, s.points[i - 1], s.points[i]);
  }
  ctx.globalCompositeOperation = 'source-over';
}

export default function HandwritingPad({ strokes: initial, onChange, onClose, onDone }: Props) {
  useBodyScrollLock(true);
  const vv = useVisualViewport(true);
  const zIndex = useModalLayer(true, onClose);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<PenStroke[]>(initial);
  const [count, setCount] = useState(initial.length);
  const [theme] = useState<'light' | 'dark'>(() => (isDark() ? 'dark' : 'light'));
  const [color, setColor] = useState(() => lastColor[theme] ?? defaultPenColor(theme === 'dark'));
  const [size, setSize] = useState(lastSize);
  const [eraser, setEraser] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** 보는 자리 (그리기는 ref로 - 손가락을 움직일 때마다 다시 그리지 않게), 배율 글자만 상태로 */
  const viewRef = useRef<PadView>(VIEW_1);
  const [scale, setScale] = useState(1);
  /** 펜을 한 번이라도 썼나 - 그 뒤로 손가락(손바닥)은 그리지 않는다 */
  const penSeen = useRef(false);
  /** 지금 긋는 줄 */
  const active = useRef<{ id: number; type: string; stroke: PenStroke } | null>(null);
  /** 화면에 닿아 있는 손가락 (캔버스 자리) */
  const touches = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  /** 그림판 자리 (CSS px) - 종이 폭도 이것 */
  const area = useRef({ w: 0, h: 0, dpr: 1 });
  /** 종이 높이 (domain paperHeight - 그린 것 아래로 한 화면 더) */
  const paperH = useRef(0);
  /** 오른쪽 스크롤 막대 (종이가 한 화면보다 길 때만) */
  const [thumb, setThumb] = useState<{ top: number; size: number } | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    lastColor[theme] = color;
    lastSize = size;
  }, [theme, color, size]);

  const ctxOf = () => canvasRef.current?.getContext('2d') ?? null;
  /** 보는 자리에 맞춘 변환 - 그 뒤의 그리기는 종이 자리로 */
  const applyView = (ctx: CanvasRenderingContext2D) => {
    const { dpr } = area.current;
    const v = viewRef.current;
    ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, -v.x * v.scale * dpr, -v.y * v.scale * dpr);
  };
  const repaint = () => {
    const ctx = ctxOf();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyView(ctx);
    paintStrokes(ctx, strokesRef.current);
  };
  /** 두 손가락으로 움직이는 동안은 한 화면에 한 번만 다시 그린다 */
  const repaintSoon = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      repaint();
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const showThumb = () => {
    const t = scrollThumb(viewRef.current, area.current.h, paperH.current);
    setThumb((old) => (old?.top === t?.top && old?.size === t?.size ? old : t));
  };
  const setView = (v: PadView, soon = false) => {
    viewRef.current = clampView(v, area.current.w, area.current.h, paperH.current);
    setScale(viewRef.current.scale);
    showThumb();
    if (soon) repaintSoon();
    else repaint();
  };
  /** 그린 것에 맞춰 종이를 늘린다 (줄이지 않는다 - fresh면 처음부터) */
  const growPaper = (fresh = false) => {
    paperH.current = paperHeight(strokesRef.current, area.current.h, fresh ? 0 : paperH.current);
    showThumb();
  };
  const commit = () => {
    setCount(strokesRef.current.length);
    onChange(strokesRef.current);
    growPaper();
  };

  // 그림판 크기 = 보이는 자리 (휴대폰을 돌리면 다시 맞추고 다시 그린다)
  useLayoutEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const fit = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (w === area.current.w && h === area.current.h && dpr === area.current.dpr) return;
      area.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      paperH.current = paperHeight(strokesRef.current, h, paperH.current);
      viewRef.current = clampView(viewRef.current, w, h, paperH.current);
      showThumb();
      repaint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
    // repaint는 ref만 읽는다
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** + / − 단추·단축키 - 화면 가운데를 그 자리에 둔 채 */
  const zoomBy = (factor: number) => {
    const { w, h } = area.current;
    const v = viewRef.current;
    const next = Math.abs(v.scale * factor - 1) < 0.01 ? 1 : v.scale * factor;
    setView(zoomAt(v, next, w / 2, h / 2, w, h, paperH.current));
  };
  /** 처음 크기 (내려 보던 자리는 그대로 - 긴 필기의 아래쪽에서 눌러도 그 자리에 있게) */
  const zoomReset = () => setView({ scale: 1, x: 0, y: viewRef.current.y });

  // PC: Ctrl+휠(노트북 터치패드 벌리기도) = 크게·작게, 휠 = 종이 옮기기(아래로 길게 쓴 것·크게 본 것). React 휠은 막을 수 없어(passive) 직접 단다
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { w, h } = area.current;
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = box.getBoundingClientRect();
        setView(zoomAt(v, v.scale * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top, w, h, paperH.current), true);
      } else {
        setView(panView(v, -e.deltaX, -e.deltaY, w, h, paperH.current), true);
      }
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
    // setView는 ref만 읽는다
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = () => {
    if (active.current || strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    repaint();
    commit();
  };
  const clearAll = () => {
    if (strokesRef.current.length === 0) return;
    if (!window.confirm('그린 것을 모두 지울까요?')) return;
    strokesRef.current = [];
    commit();
    growPaper(true);
    setView(VIEW_1);
  };

  // ESC = 닫기(그리던 것은 남는다), Ctrl+S = 저장, Ctrl+Z = 마지막 줄 지우기, Ctrl + / − / 0 = 크게·작게·처음 크기
  //   앱 키 처리(window 거품 단계)·쓰는 칸의 Ctrl+S·크롬 화면 확대보다 먼저 받아 멈춘다 (ui/ImageViewer와 같다)
  const keyRef = useRef({ onClose, undo, zoomBy, zoomReset, done: () => {} });
  useEffect(() => {
    keyRef.current = { onClose, undo, zoomBy, zoomReset, done };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = (e.ctrlKey || e.metaKey) && !e.altKey;
      const k = keyRef.current;
      let run: (() => void) | null = null;
      if (e.key === 'Escape') run = k.onClose;
      else if (ctrl && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) run = e.repeat ? () => {} : k.done;
      else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z') run = k.undo;
      else if (ctrl && (e.key === '=' || e.key === '+')) run = () => k.zoomBy(ZOOM_STEP);
      else if (ctrl && e.key === '-') run = () => k.zoomBy(1 / ZOOM_STEP);
      else if (ctrl && e.key === '0') run = k.zoomReset;
      if (!run) return;
      e.stopPropagation();
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  /** 캔버스 안 자리 (화면 CSS px) */
  const local = (e: PointerEvent): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  /** 종이 자리 - 굵기는 화면에 보이는 대로(크게 보면 종이에는 그만큼 가늘게) */
  const pointOf = (e: PointerEvent, erase: boolean): PenPoint => {
    const p = local(e);
    const v = viewRef.current;
    const w = erase ? ERASER_SIZE : penWidth(size, e.pressure, e.pointerType);
    return {
      x: Math.round((v.x + p.x / v.scale) * 100) / 100,
      y: Math.round((v.y + p.y / v.scale) * 100) / 100,
      w: Math.round((w / v.scale) * 100) / 100,
    };
  };
  /** 긋던 줄 버리기 (손가락이 둘이 되거나, 손바닥 뒤에 펜이 왔을 때) */
  const dropActive = () => {
    const cur = active.current;
    if (!cur) return;
    strokesRef.current = strokesRef.current.filter((s) => s !== cur.stroke);
    active.current = null;
    repaint();
  };
  const capture = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 이미 떨어진 펜이면 붙들 것이 없다 - 그대로 긋는다
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const type = e.pointerType;
    const cur = active.current;
    if (type === 'touch') {
      touches.current.set(e.pointerId, local(e.nativeEvent));
      // 펜으로 쓰는 중에 닿은 손가락은 손바닥 - 아무것도 하지 않는다
      if (cur?.type === 'pen') return;
      e.preventDefault();
      capture(e);
      if (touches.current.size >= 2) {
        // 손가락 둘 = 크게·작게·옮기기 (한 손가락으로 긋기 시작한 줄은 버린다)
        if (cur?.type === 'touch') dropActive();
        if (gesture.current?.kind === 'thumb') return;
        const [a, b] = [...touches.current.entries()].slice(-2);
        gesture.current = { kind: 'pinch', ids: [a[0], b[0]], start: viewRef.current, c0: mid(a[1], b[1]), d0: dist(a[1], b[1]) };
        return;
      }
      if (!acceptsPointer(type, penSeen.current)) {
        // 펜을 쓴 뒤의 손가락 하나 = 크게 본 종이 옮기기
        gesture.current = { kind: 'pan', id: e.pointerId, start: viewRef.current, p0: local(e.nativeEvent) };
        return;
      }
      if (cur) return;
    } else {
      if (type === 'pen') {
        penSeen.current = true;
        // 손가락으로 옮기던 중이면 그만 - 펜이 이긴다
        if (gesture.current?.kind === 'pan') gesture.current = null;
      }
      if (cur) {
        // 손바닥이 먼저 닿고 펜이 뒤에 오면 손바닥 줄은 버린다
        if (cur.type === 'touch' && type === 'pen') dropActive();
        else return;
      }
      if (type === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      capture(e);
    }
    const erase = eraser || isEraserPress(type, e.buttons);
    const p = pointOf(e.nativeEvent, erase);
    const stroke: PenStroke = { color: erase ? '#000000' : color, erase, points: [p] };
    strokesRef.current = [...strokesRef.current, stroke];
    active.current = { id: e.pointerId, type, stroke };
    const ctx = ctxOf();
    if (ctx) paintDot(ctx, stroke, p);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, local(e.nativeEvent));
      const g = gesture.current;
      const { w, h } = area.current;
      if (g?.kind === 'pinch' && g.ids.includes(e.pointerId)) {
        const a = touches.current.get(g.ids[0]);
        const b = touches.current.get(g.ids[1]);
        if (a && b) setView(pinchView(g.start, g.c0, g.d0, mid(a, b), dist(a, b), w, h, paperH.current), true);
        return;
      }
      if (g?.kind === 'pan' && g.id === e.pointerId) {
        const p = local(e.nativeEvent);
        setView(panView(g.start, p.x - g.p0.x, p.y - g.p0.y, w, h, paperH.current), true);
        return;
      }
    }
    const cur = active.current;
    if (!cur || e.pointerId !== cur.id) return;
    e.preventDefault();
    const ctx = ctxOf();
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const pts = cur.stroke.points;
      const last = pts[pts.length - 1];
      const p = pointOf(ev, cur.stroke.erase);
      if (p.x === last.x && p.y === last.y) continue;
      pts.push(p);
      if (ctx) paintSegment(ctx, cur.stroke, last, p);
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      const g = gesture.current;
      // 손가락 하나를 떼면 크게·작게는 끝 - 남은 손가락은 뗄 때까지 아무것도 하지 않는다
      if ((g?.kind === 'pinch' && g.ids.includes(e.pointerId)) || (g?.kind === 'pan' && g.id === e.pointerId)) gesture.current = null;
    }
    const cur = active.current;
    if (!cur || e.pointerId !== cur.id) return;
    active.current = null;
    commit();
  };

  const done = () => {
    const strokes = strokesRef.current;
    const box = boxRef.current;
    if (!box || !hasInk(strokes)) {
      showToast('그린 것이 없습니다.');
      return;
    }
    const { w } = area.current;
    const b = inkBounds(strokes, EXPORT_PAD, w, paperH.current);
    if (!b) {
      showToast('그린 것이 없습니다.');
      return;
    }
    // 크게 보던 곳만이 아니라 종이 전체에서 그린 둘레 - 줄을 다시 그린다(지우개가 바탕까지 지우지 않게 줄 층을 따로 그려 바탕 위에 얹는다)
    const k = exportScale(b.w, b.h);
    const width = Math.max(1, Math.round(b.w * k));
    const height = Math.max(1, Math.round(b.h * k));
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d');
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const octx = out.getContext('2d');
    if (!lctx || !octx) return;
    lctx.setTransform(k, 0, 0, k, -b.x * k, -b.y * k);
    paintStrokes(lctx, strokes);
    // 바탕 = 그림판에 보이던 화면색 (어두운 화면에서 흰 펜으로 쓴 것이 보이게)
    octx.fillStyle = getComputedStyle(box).backgroundColor || '#ffffff';
    octx.fillRect(0, 0, width, height);
    octx.drawImage(layer, 0, 0);
    setExporting(true);
    out.toBlob((blob) => {
      setExporting(false);
      if (!blob) {
        showToast('그림으로 바꾸지 못했습니다. 다시 눌러 주세요.');
        return;
      }
      onDone(new File([blob], handwritingName(), { type: 'image/png' }));
    }, 'image/png');
  };

  // ─── 오른쪽 스크롤 막대 (마우스·손가락·펜 모두 끌어 내린다 - 마우스는 휠도) ───
  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 이미 떨어진 손가락이면 붙들 것이 없다
    }
    gesture.current = { kind: 'thumb', id: e.pointerId, start: viewRef.current, y0: e.clientY };
  };
  const onThumbMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g?.kind !== 'thumb' || g.id !== e.pointerId) return;
    const { w, h } = area.current;
    setView(dragThumb(g.start, e.clientY - g.y0, h, paperH.current, w), true);
  };
  const onThumbEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g?.kind === 'thumb' && g.id === e.pointerId) gesture.current = null;
  };
  /** 막대 밖 길을 누르면 그쪽으로 한 화면씩 */
  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !thumb) return;
    e.preventDefault();
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const { w, h } = area.current;
    const v = viewRef.current;
    const step = h * 0.9;
    setView(panView(v, 0, y < thumb.top ? step : -step, w, h, paperH.current));
  };

  const tool = (on: boolean) => `px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`;
  const percent = Math.round(scale * 100);

  return createPortal(
    <div
      data-handwriting-pad
      data-pen-count={count}
      data-pen-theme={theme}
      className="fixed inset-0 flex flex-col bg-slate-100"
      style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height, zIndex }}
      role="dialog"
      aria-label="손글씨"
    >
      {/* 머리: 이름 · 닫기 · 💾 저장 / 도구. 좁은 화면은 닫기·저장이 이름과 첫 줄에, 도구는 아랫줄 (10-28 - 저장·닫기가 도구 줄 끝에 묻혔다) */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-1.5 gap-y-2 px-3 py-2 bg-white border-b border-slate-200">
        <span className="order-1 text-sm font-black text-slate-800 mr-1">✏️ 손글씨</span>
        <div className="order-2 md:order-3 ml-auto flex items-center gap-1.5">
          <button type="button" data-pen-close onClick={onClose} className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer" title="닫기 - 그리던 것은 남습니다. 다시 열면 이어 그립니다">
            닫기
          </button>
          <button
            type="button"
            data-pen-done
            onClick={done}
            disabled={exporting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-primary hover:bg-blue-600 cursor-pointer disabled:opacity-50"
            title="그린 것을 그림으로 바꿔 이 메모에 첨부하고 메모를 저장합니다 (구글 드라이브, Ctrl+S)"
          >
            💾 저장
          </button>
        </div>
        <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1" role="group" aria-label="펜 색">
            {PEN_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                data-pen-color={c.id}
                data-on={!eraser && color === c.value ? '' : undefined}
                onClick={() => {
                  setColor(c.value);
                  setEraser(false);
                }}
                className={`w-7 h-7 rounded-full border-2 cursor-pointer ${!eraser && color === c.value ? 'border-primary ring-2 ring-primary/40' : 'border-slate-300'}`}
                style={{ backgroundColor: c.value }}
                title={`${c.label} 펜`}
                aria-label={`${c.label} 펜`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="펜 굵기">
            {PEN_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                data-pen-size={s.id}
                data-on={!eraser && size === s.value ? '' : undefined}
                onClick={() => {
                  setSize(s.value);
                  setEraser(false);
                }}
                className={tool(!eraser && size === s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" data-pen-eraser data-on={eraser ? '' : undefined} onClick={() => setEraser((v) => !v)} className={tool(eraser)} title="지우개 - 펜 옆 단추를 누른 채 그어도 지웁니다">
            🧽 지우개
          </button>
          <div className="flex items-center gap-0.5" role="group" aria-label="크게·작게 보기">
            <button type="button" data-pen-zoom-out onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={scale <= ZOOM_MIN} className={`${tool(false)} w-8 px-0 disabled:opacity-40`} title="작게 보기 (Ctrl+−)" aria-label="작게 보기">
              −
            </button>
            <button type="button" data-pen-zoom={percent} onClick={zoomReset} className={`${tool(false)} w-14 px-0 tabular-nums`} title="처음 크기로 (Ctrl+0) · 두 손가락으로 벌리고 오므려도 됩니다">
              {percent}%
            </button>
            <button type="button" data-pen-zoom-in onClick={() => zoomBy(ZOOM_STEP)} disabled={scale >= ZOOM_MAX} className={`${tool(false)} w-8 px-0 disabled:opacity-40`} title="크게 보기 (Ctrl++)" aria-label="크게 보기">
              +
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" data-pen-undo onClick={undo} disabled={count === 0} className={`${tool(false)} disabled:opacity-40`} title="마지막 줄 지우기 (Ctrl+Z)">
              ↶ 되돌리기
            </button>
            <button type="button" data-pen-clear onClick={clearAll} disabled={count === 0} className={`${tool(false)} disabled:opacity-40`} title="모두 지우기">
              🗑️ 모두
            </button>
          </div>
        </div>
      </div>
      {/* 바탕 = 화면색 (bg-white는 어두운 화면에서 어두운 카드 색이 된다) */}
      <div ref={boxRef} data-pen-board className="relative flex-1 min-h-0 m-2 rounded-xl overflow-hidden shadow-inner border border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          data-pen-canvas
          className="absolute inset-0 block"
          style={{ touchAction: 'none', cursor: eraser ? 'cell' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onContextMenu={(e) => e.preventDefault()}
        />
        {count === 0 && (
          <div data-pen-hint className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-relaxed pointer-events-none select-none text-slate-400">
            펜·손가락·마우스로 쓰세요.
            <br />
            펜으로 쓰면 손바닥은 그리지 않습니다 · 펜 옆 단추를 누른 채 그으면 지웁니다.
            <br />두 손가락으로 벌리고 오므리면 크게·작게 봅니다.
            <br />
            쓰고 나면 아래로 내려(휠·두 손가락·오른쪽 막대) 길게 이어 씁니다.
          </div>
        )}
        {/* 종이가 한 화면보다 길면 오른쪽에 스크롤 막대 - 끌거나 길을 눌러 내린다 */}
        {thumb && (
          <div data-pen-scroll className="absolute top-0 right-0 bottom-0 w-5 z-10" style={{ touchAction: 'none' }} onPointerDown={onTrackDown}>
            <div
              data-pen-scroll-thumb
              className="absolute right-1 w-2.5 rounded-full bg-slate-400/70 hover:bg-slate-500 cursor-grab active:cursor-grabbing"
              style={{ top: thumb.top, height: thumb.size }}
              onPointerDown={onThumbDown}
              onPointerMove={onThumbMove}
              onPointerUp={onThumbEnd}
              onPointerCancel={onThumbEnd}
              title="끌어 내리면 아래로 이어 씁니다 (휠·두 손가락으로도)"
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

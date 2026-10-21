// 손글씨 그림판 (메모 쓰는 칸 ✏️ 손글씨). 화면 가득 덮는다 - 사진 크게 보기·🎯 뽑기 크게 보기처럼 (오른쪽 칸에 넣으면 쓸 자리가 좁다).
//   - 펜(S펜 등)은 누르는 힘으로 굵기가 바뀌고, 펜을 쓰면 그 뒤로 손바닥(손가락)은 그리지 않는다. 마우스·손가락도 그린다.
//   - 펜 옆 단추(펜 뒤 지우개)를 누른 채 그으면 지우개. ↶ = 마지막 줄 지우기(Ctrl+Z), 🗑️ 모두 지우기.
//   - ✓ 첨부 = 그린 둘레만 잘라 흰 바탕 PNG로 → 쓰는 칸이 드라이브에 올려 첨부로 붙인다.
//   - ✕·ESC·뒤로가기는 닫기만 한다 - 그리던 것은 쓰는 칸이 들고 있다가 다시 열면 이어 그린다(첨부하면 비운다).
//   셈은 domain/handwriting.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalLayer } from '../../app/history';
import { showToast } from '../../app/toast';
import {
  acceptsPointer,
  ERASER_SIZE,
  handwritingName,
  hasInk,
  inkBounds,
  isEraserPress,
  PEN_COLORS,
  PEN_SIZES,
  penWidth,
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
  /** ✓ 첨부 - 그린 것을 PNG 파일로 */
  onDone: (file: File) => void;
}

/** 그림으로 바꿀 때 그린 줄 둘레에 남기는 여백 (CSS px) */
const EXPORT_PAD = 16;
/** 그림으로 바꿀 때 최대 배율 - 휴대폰은 화면 배율이 3~4라 그대로면 파일이 너무 커진다 */
const EXPORT_MAX_SCALE = 2;

// 고른 펜은 이 탭에서 기억한다 (다시 열 때 같은 펜)
let lastTool: { color: string; size: number } = { color: PEN_COLORS[0].value, size: PEN_SIZES[1].value };

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

function paintAll(ctx: CanvasRenderingContext2D, strokes: PenStroke[], w: number, h: number) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
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
  const [color, setColor] = useState(lastTool.color);
  const [size, setSize] = useState(lastTool.size);
  const [eraser, setEraser] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** 펜을 한 번이라도 썼나 - 그 뒤로 손가락(손바닥)은 그리지 않는다 */
  const penSeen = useRef(false);
  /** 지금 긋는 줄 */
  const active = useRef<{ id: number; type: string; stroke: PenStroke } | null>(null);
  const area = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    lastTool = { color, size };
  }, [color, size]);

  const ctxOf = () => canvasRef.current?.getContext('2d') ?? null;
  const repaint = () => {
    const ctx = ctxOf();
    if (ctx) paintAll(ctx, strokesRef.current, area.current.w, area.current.h);
  };
  const commit = () => {
    setCount(strokesRef.current.length);
    onChange(strokesRef.current);
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
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintAll(ctx, strokesRef.current, w, h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
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
    repaint();
    commit();
  };

  // ESC = 닫기(그리던 것은 남는다), Ctrl+Z = 마지막 줄 지우기 - 앱 키 처리(window 거품 단계)보다 먼저 받아 멈춘다 (ui/ImageViewer와 같다)
  const keyRef = useRef({ onClose, undo });
  useEffect(() => {
    keyRef.current = { onClose, undo };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        keyRef.current.onClose();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.stopPropagation();
        e.preventDefault();
        keyRef.current.undo();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const pointOf = (e: PointerEvent, erase: boolean): PenPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10,
      w: erase ? ERASER_SIZE : penWidth(size, e.pressure, e.pointerType),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const type = e.pointerType;
    if (type === 'pen') penSeen.current = true;
    if (!acceptsPointer(type, penSeen.current)) return;
    const cur = active.current;
    if (cur) {
      // 손바닥이 먼저 닿고 펜이 뒤에 오면 손바닥 줄은 버린다
      if (cur.type === 'touch' && type === 'pen') {
        strokesRef.current = strokesRef.current.filter((s) => s !== cur.stroke);
        active.current = null;
        repaint();
      } else return;
    }
    if (type === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 이미 떨어진 펜이면 붙들 것이 없다 - 그대로 긋는다
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
    const cur = active.current;
    if (!cur || e.pointerId !== cur.id) return;
    active.current = null;
    commit();
  };

  const done = () => {
    const strokes = strokesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !hasInk(strokes)) {
      showToast('그린 것이 없습니다.');
      return;
    }
    const { w, h, dpr } = area.current;
    const b = inkBounds(strokes, EXPORT_PAD, w, h);
    if (!b) {
      showToast('그린 것이 없습니다.');
      return;
    }
    const scale = Math.min(dpr, EXPORT_MAX_SCALE);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(b.w * scale));
    out.height = Math.max(1, Math.round(b.h * scale));
    const octx = out.getContext('2d');
    if (!octx) return;
    // 흰 바탕 - 투명이면 어두운 화면의 카드에서 검은 글씨가 보이지 않는다
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, b.x * dpr, b.y * dpr, b.w * dpr, b.h * dpr, 0, 0, out.width, out.height);
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

  const tool = (on: boolean) => `px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`;

  return createPortal(
    <div
      data-handwriting-pad
      data-pen-count={count}
      className="fixed inset-0 flex flex-col bg-slate-100"
      style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height, zIndex }}
      role="dialog"
      aria-label="손글씨"
    >
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-200">
        <button type="button" data-pen-close onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 font-bold cursor-pointer" title="닫기 (그리던 것은 남습니다)" aria-label="손글씨 닫기">
          ✕
        </button>
        <span className="text-sm font-black text-slate-800 mr-1">✏️ 손글씨</span>
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
              className={`w-7 h-7 rounded-full border-2 cursor-pointer ${!eraser && color === c.value ? 'border-slate-800 ring-2 ring-primary/40' : 'border-white'}`}
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
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" data-pen-undo onClick={undo} disabled={count === 0} className={`${tool(false)} disabled:opacity-40`} title="마지막 줄 지우기 (Ctrl+Z)">
            ↶ 되돌리기
          </button>
          <button type="button" data-pen-clear onClick={clearAll} disabled={count === 0} className={`${tool(false)} disabled:opacity-40`} title="모두 지우기">
            🗑️ 모두
          </button>
          <button
            type="button"
            data-pen-done
            onClick={done}
            disabled={exporting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-primary hover:bg-blue-600 cursor-pointer disabled:opacity-50"
            title="그린 것을 그림으로 바꿔 이 메모에 첨부합니다 (구글 드라이브)"
          >
            ✓ 첨부
          </button>
        </div>
      </div>
      <div ref={boxRef} className="relative flex-1 min-h-0 m-2 rounded-xl overflow-hidden shadow-inner border border-slate-200" style={{ backgroundColor: '#ffffff' }}>
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
          <div data-pen-hint className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-relaxed pointer-events-none select-none" style={{ color: '#94a3b8' }}>
            펜·손가락·마우스로 쓰세요.
            <br />
            펜으로 쓰면 손바닥은 그리지 않습니다 · 펜 옆 단추를 누른 채 그으면 지웁니다.
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

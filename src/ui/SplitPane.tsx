// 칸 둘을 경계선으로 나눈다 (P24 한눈에 화면 - 사용자 그림의 ⟷ '칸의 크기를 조절').
//   - 가로(row = 왼쪽|오른쪽)·세로(column = 위/아래). 크기는 앞 칸의 비율(%) - 수정 칸이 열려 본문이 줄어도 같은 꼴이다.
//   - 끄는 동안은 CSS 변수(--split)만 바꾸고 놓을 때 한 번 알린다(onCommit) - 칸 안 부품이 끌 때마다 다시 그려지면 버벅인다.
//   - 두 번 누르면 기본(onCommit(null) - 오른쪽 칸 경계선 ColumnResizer와 같다).
//   - 키: 경계선에 초점을 두고 화살표 ±2% · PageUp/PageDown ±10% · Home/End 끝까지 (role="separator").
//   - 칸마다 최소 폭(px). 그보다 좁아지면 이 부품이 아니라 쓰는 화면이 칸을 쌓는다.
// ColumnResizer는 화면 끝에 붙는 fixed 경계선이라 따로다. 경계선에서 시작한 손짓은 화면 넘기기가 아니다(app/useGlobalGestures - data-split-handle).
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { MAX_RATIO, MIN_RATIO, ratioAt, SPLIT_HANDLE_PX } from './splitRatio';

interface Props {
  /** data-split 이름 (점검이 찾는다) */
  name: string;
  /** row = 왼쪽|오른쪽(세로 경계선), column = 위/아래(가로 경계선) */
  direction: 'row' | 'column';
  /** 앞 칸의 비율(%) */
  ratio: number;
  /** 놓았을 때·키로 바꿨을 때. null = 두 번 눌러 기본으로 */
  onCommit: (ratio: number | null) => void;
  /** 칸마다 최소 크기(px) - row면 폭, column이면 높이 */
  minFirst: number;
  minSecond: number;
  /** 경계선 이름 (읽어 주는 글) */
  label: string;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}

export default function SplitPane({ name, direction, ratio, onCommit, minFirst, minSecond, label, first, second, className = '' }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // 누르고 있나 · 끌어 옮긴 비율(놓을 때 알린다 - 누르기만 하면 알리지 않는다: 두 번 누르기가 기본을 숫자로 굳히지 않게)
  const pressing = useRef(false);
  const drag = useRef<number | null>(null);
  const row = direction === 'row';

  const show = (r: number) => {
    boxRef.current?.style.setProperty('--split', String(r));
    handleRef.current?.setAttribute('aria-valuenow', String(Math.round(r)));
  };

  const at = (e: PointerEvent) => {
    const box = boxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    return row
      ? ratioAt(e.clientX - rect.left, rect.width, minFirst, minSecond)
      : ratioAt(e.clientY - rect.top, rect.height, minFirst, minSecond);
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!pressing.current) return;
    pressing.current = false;
    const r = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    document.body.style.userSelect = '';
    if (r !== null) onCommit(r);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -2, ArrowUp: -2, ArrowRight: 2, ArrowDown: 2, PageUp: -10, PageDown: 10, Home: -100, End: 100 }[e.key];
    if (step === undefined || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
    // 화면 단축키·스크롤로 가지 않게
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    const size = box ? (row ? box.clientWidth : box.clientHeight) : 0;
    const next = ratioAt(((ratio + step) / 100) * size, size, minFirst, minSecond);
    if (next !== null) onCommit(next);
  };

  const sizeKey = row ? 'minWidth' : 'minHeight';
  return (
    <div
      ref={boxRef}
      data-split={name}
      className={`flex ${row ? 'flex-row' : 'flex-col'} min-w-0 min-h-0 ${className}`}
      style={{ ['--split' as string]: ratio } as CSSProperties}
    >
      <div
        data-split-first={name}
        className="flex flex-col min-w-0 min-h-0"
        style={{ flex: `0 1 calc(var(--split) * 1% - ${SPLIT_HANDLE_PX / 2}px)`, [sizeKey]: minFirst }}
      >
        {first}
      </div>
      <div
        ref={handleRef}
        role="separator"
        tabIndex={0}
        aria-orientation={row ? 'vertical' : 'horizontal'}
        aria-label={label}
        aria-valuemin={MIN_RATIO}
        aria-valuemax={MAX_RATIO}
        aria-valuenow={Math.round(ratio)}
        title="끌어서 크기 조절 · 두 번 눌러 기본 크기"
        data-split-handle={name}
        className={`group shrink-0 touch-none flex items-center justify-center rounded-full outline-none focus-visible:bg-primary/15 ${
          row ? 'cursor-col-resize self-stretch' : 'cursor-row-resize'
        }`}
        style={row ? { width: SPLIT_HANDLE_PX } : { height: SPLIT_HANDLE_PX }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pressing.current = true;
          drag.current = null;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          document.body.style.userSelect = 'none';
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (!pressing.current) return;
          const r = at(e);
          if (r === null) return;
          drag.current = r;
          show(r);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onCommit(null)}
      >
        <div
          className={`rounded-full bg-slate-200 group-hover:bg-primary/60 group-focus-visible:bg-primary transition-colors ${row ? 'w-0.5 h-10' : 'h-0.5 w-10'}`}
        />
      </div>
      <div data-split-second={name} className="flex flex-col min-w-0 min-h-0" style={{ flex: '1 1 0%', [sizeKey]: minSecond }}>
        {second}
      </div>
    </div>
  );
}

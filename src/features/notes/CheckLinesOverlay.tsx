// 쓰는 칸 글 칸의 체크 목록 (P10-5 사용자 의견 5b·5c - Keep 체크리스트처럼).
//
// 글 칸은 그대로 하나다(한글 조합·@이름·붙여넣기·Ctrl+Z가 그대로 돈다). 글에 체크 줄이 있을 때만:
//   - 같은 글을 글 칸 **아래에** 같은 글꼴·폭으로 그려 체크한 줄(☑)에 줄을 긋고 흐리게 한다. 글 칸의 글자는 투명(커서·고른 범위는 보인다).
//   - 글 칸 왼쪽 여백에 체크 줄마다 ▲▼ 손잡이 - 같은 덩이·같은 무리(체크 안 함끼리·체크함끼리)의 옆 줄과 맞바꾼다(domain/checkLines).
// 체크하기·풀기(줄 맨 앞 ☐/☑ 누르기)는 쓰는 칸이 하고 그 줄을 무리 맨 아래로 옮긴다(toggleCheckMoving).
// 줄 자리는 아래 그림의 줄 상자에서 잰다(폭이 바뀌면 다시 - 글이 접히는 자리가 글 칸과 같다).
import { useLayoutEffect, useRef, useState } from 'react';
import { canMoveCheckLine, checkLineState } from '../../domain/checkLines';

/** 체크 목록이 있을 때 글 칸에 더할 class (글자 투명·왼쪽 손잡이 자리 - 아래 그림과 같은 여백, 그림 위에 그려지게 relative) */
export const CHECK_TEXT_CLASS = 'relative text-transparent caret-slate-800 selection:text-transparent selection:bg-sky-300/40 pl-11';

interface Props {
  text: string;
  /** ▲(-1)·▼(+1) */
  onMove: (line: number, step: -1 | 1) => void;
}

export default function CheckLinesOverlay({ text, onMove }: Props) {
  const lines = text.split('\n');
  const boxRef = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<number[]>([]);

  // 줄마다 윗변 (글이 바뀌거나 폭이 바뀌면 다시 잰다)
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const next = [...box.children].map((c) => box.clientTop + (c as HTMLElement).offsetTop);
      setTops((prev) => (prev.length === next.length && prev.every((t, i) => t === next[i]) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  return (
    <>
      <div
        ref={boxRef}
        aria-hidden
        data-check-backdrop
        className="absolute inset-0 pointer-events-none p-4 pl-11 border border-transparent rounded-xl text-sm leading-relaxed text-slate-800 whitespace-pre-wrap [overflow-wrap:break-word] overflow-hidden"
      >
        {lines.map((line, i) => {
          const st = checkLineState(line);
          if (!st) return <div key={i}>{line || '​'}</div>;
          const m = /^([ \t]*[☐☑])(.*)$/.exec(line)!;
          return (
            <div key={i} data-check-row={i} data-check-state={st}>
              <span className={st === 'done' ? 'text-emerald-600' : 'text-slate-500'}>{m[1]}</span>
              <span className={st === 'done' ? 'line-through text-slate-400' : ''}>{m[2]}</span>
            </div>
          );
        })}
      </div>
      {lines.map((line, i) => {
        if (!checkLineState(line) || tops[i] === undefined) return null;
        const up = canMoveCheckLine(text, i, -1);
        const down = canMoveCheckLine(text, i, 1);
        if (!up && !down) return null;
        const btn = 'w-4 h-5 leading-none text-2xs text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer';
        return (
          <div key={i} className="absolute left-1.5 z-10 flex items-center" style={{ top: tops[i] }}>
            <button type="button" data-check-up={i} disabled={!up} onMouseDown={(e) => e.preventDefault()} onClick={() => onMove(i, -1)} title="위로" aria-label="위로" className={btn}>
              ▲
            </button>
            <button type="button" data-check-down={i} disabled={!down} onMouseDown={(e) => e.preventDefault()} onClick={() => onMove(i, 1)} title="아래로" aria-label="아래로" className={btn}>
              ▼
            </button>
          </div>
        );
      })}
    </>
  );
}

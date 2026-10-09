// 자리표 창의 🎯 발표자 뽑기 칸 (V4 components/SeatDrawPanel.tsx). 뽑기·저장은 useStudentDraw, 셈은 domain/draw.
//   뽑힌 학생은 자리표에서도 짚는다(SeatingWindow가 그린다). 자리표가 없어도 학급 명렬표로 뽑는다.
import { drawStatusLine, type DrawState, type DrawStatus } from '../../domain/draw';

interface Props {
  shown: string | null;
  rolling: boolean;
  status: DrawStatus;
  draw: DrawState;
  /** sid → '15번 홍길동' */
  nameFor: (sid: string) => string;
  onPick: () => void;
  onUndo: () => void;
  onNewRound: () => void;
  onBig: () => void;
}

export default function SeatDrawBox({ shown, rolling, status, draw, nameFor, onPick, onUndo, onNewRound, onBig }: Props) {
  const canUndo = !rolling && shown !== null && draw.picked.includes(shown);
  // 굴리는 동안은 방금 뽑힌 학생(판의 맨 끝)을 아직 보이지 않는다 - 멈추기 전에 답이 보이지 않게
  const visiblePicked = rolling ? draw.picked.slice(0, -1) : draw.picked;
  const btn = 'px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold cursor-pointer';
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-col gap-2 text-xs" data-seating-box="draw">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[10rem] h-14 rounded-xl bg-white border border-amber-200 flex items-center justify-center gap-2 px-3" aria-live="polite" data-draw-result={rolling ? '' : (shown ?? '')}>
          {shown === null ? (
            <span className="text-slate-400 font-bold">누가 발표할까요?</span>
          ) : (
            <span className={`text-xl font-black truncate ${rolling ? 'text-slate-400' : 'text-slate-900'}`}>{nameFor(shown)}</span>
          )}
        </div>
        <button
          type="button"
          data-draw-pick
          onClick={onPick}
          // 굴리는 동안 커서를 잃지 않게 disabled 대신 (누름은 onPick이 무시한다)
          aria-disabled={rolling}
          className={`px-4 h-14 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-black cursor-pointer ${rolling ? 'opacity-60' : ''}`}
        >
          🎯 뽑기
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold text-slate-600 mr-auto" data-draw-status>
          {drawStatusLine(draw, status)}
        </span>
        <button type="button" data-draw-big-open onClick={onBig} className={btn}>
          🔍 크게 보기
        </button>
        <button type="button" data-draw-undo onClick={onUndo} disabled={!canUndo} className={`${btn} disabled:opacity-40`} title="방금 뽑은 학생을 안 뽑힌 학생으로 되돌립니다">
          ↩️ 되돌리기
        </button>
        <button type="button" data-draw-new-round onClick={onNewRound} disabled={rolling || draw.picked.length === 0} className={`${btn} disabled:opacity-40`}>
          🔄 새 판
        </button>
      </div>
      {visiblePicked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" data-draw-picked={visiblePicked.length}>
          <span className="text-2xs font-black text-slate-400 mr-1">뽑힌 차례</span>
          {visiblePicked.map((n, i) => (
            <span
              key={n}
              data-draw-picked-sid={n}
              className={`px-1.5 py-0.5 rounded-md border text-2xs font-bold ${!rolling && n === shown ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {i + 1}. {nameFor(n)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

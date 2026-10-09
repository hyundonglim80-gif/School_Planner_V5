// 달력(주간·월간·년간)의 그날 조사표 수 📊 n (V4 components/EvalCountBadge.tsx) - 기록 표식 📝 n과 같은 모양.
//   누르면 그날 전체를 맡은 조사표 창(목록부터) - 날짜를 누르면 하루 화면으로 가는 자리에 얹혀 있어 누름이 번지지 않게 막는다.
import { openEvaluation } from './open';

interface Props {
  sid: string | null;
  date: string;
  count: number;
  /** 고르개 이름 (data-week-evals·data-month-evals·data-year-evals) */
  tag: string;
  className?: string;
}

export default function EvalCountBadge({ sid, date, count, tag, className = '' }: Props) {
  if (!count || !sid) return null;
  const text = count > 1 ? `조사표 ${count}건 - 골라서 보기` : '조사표 보기';
  return (
    <button
      type="button"
      {...{ [`data-${tag}`]: count }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openEvaluation({ sid, date });
      }}
      title={text}
      aria-label={text}
      className={`inline-flex items-center gap-px px-1 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-2xs font-bold leading-none hover:bg-blue-100 transition-colors shrink-0 cursor-pointer ${className}`}
    >
      <span aria-hidden>📊</span>
      <span>{count}</span>
    </button>
  );
}

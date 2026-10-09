// 주간 요일 카드의 수업 줄 (V4 features/week/WeekGrid.tsx 수업 부분). 모든 요일에 같은 수의 교시 줄 - 같은 교시가 옆 요일과 나란히 선다.
//   빈 교시도 같은 높이(h-7)의 자리. 교시를 누르면 'N교시 수정' 칸(features/lessons/LessonPanel). 🔗 n = 연결된 것.
//   교과 모드는 반을 반 색 칩으로('5-2'), 과목은 작게. 오늘 카드는 지금 교시를 짚는다. 진도가 있으면 'k/n'(민 교시는 '밀림') 배지(P6-2).
import type { LessonDayView } from '../../domain/lessons';
import { slotId, type ProgressMark } from '../../domain/progress';
import { parseSlot, type ClassColorClasses } from '../../domain/teachingSlot';

interface Props {
  date: string;
  view: LessonDayView;
  /** 이 주의 교시 줄 수 (요일끼리 같게) */
  rows: number;
  nowPeriod: number | null;
  isClassUnit: boolean;
  classColorOf: (cls: string) => ClassColorClasses;
  /** 교시마다 진도 (slotId → 진도) */
  marks: Record<string, ProgressMark>;
  onOpen: (n: number) => void;
  onLinks: (n: number) => void;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export default function WeekLessonRows({ date, view, rows, nowPeriod, isClassUnit, classColorOf, marks, onOpen, onLinks }: Props) {
  return (
    <div className="mb-4" data-week-lessons={date}>
      <div className="text-xs font-extrabold text-slate-400 mb-2 flex items-center gap-1">
        <span>수업</span>
      </div>
      <div className="space-y-1">
        {Array.from({ length: rows }, (_, i) => i + 1).map((n) => {
          const c = view.cells.find((x) => x.n === n);
          const filled = !!(c && (c.subject || c.memo));
          const text = c ? c.subject || c.memo.split('\n')[0] : '';
          const links = c?.linkIds.length ?? 0;
          const slot = isClassUnit && c?.subject ? parseSlot(c.subject) : null;
          const now = nowPeriod === n;
          const mark = marks[slotId(date, n)];
          return (
            <div
              key={n}
              data-week-lesson={n}
              data-now={now ? 'true' : undefined}
              onClick={(e) => {
                stop(e);
                onOpen(n);
              }}
              title={filled ? `${n}교시 ${text}` : `${n}교시 (비어 있음) - 눌러서 수업 적기`}
              className={`h-7 flex items-center gap-1.5 px-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                filled ? 'bg-slate-50 border-slate-100 hover:bg-slate-100' : 'bg-white/40 border-dashed border-slate-200 hover:bg-slate-50'
              } ${now ? 'ring-2 ring-primary/60 bg-blue-50' : ''}`}
            >
              <span className={`font-bold text-xs shrink-0 ${filled ? 'text-primary' : 'text-slate-300'}`}>{n}교시</span>
              {slot?.cls ? (
                <span className="flex-1 min-w-0 flex items-center gap-1">
                  <span data-slot-class className={`shrink-0 px-1 rounded font-black text-xs tabular-nums ${classColorOf(slot.cls).chip}`}>
                    {slot.cls}
                  </span>
                  {slot.subject && <span className="truncate text-2xs font-semibold text-slate-600">{slot.subject}</span>}
                </span>
              ) : (
                <span data-week-lesson-text className={`truncate text-xs flex-1 ${filled ? 'font-semibold text-slate-800' : 'text-slate-300'}`}>
                  {filled ? text : '-'}
                </span>
              )}
              {c?.changed && (
                <span className="shrink-0 text-2xs font-bold text-amber-600" title={`이날만 바꾼 과목 (시간표: ${c.base || '수업 없음'})`}>
                  ✎
                </span>
              )}
              {mark && (
                <span
                  data-week-progress={mark.bumped ? 'bumped' : (mark.index ?? 0) + 1}
                  className={`shrink-0 text-2xs leading-none px-1 py-0.5 rounded font-bold border tabular-nums ${
                    mark.bumped ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-indigo-700 bg-indigo-50 border-indigo-100'
                  }`}
                  title={
                    mark.bumped
                      ? `${mark.key} 진도 - 이 교시는 밀어서 차시가 없습니다`
                      : `${mark.key} ${(mark.index ?? 0) + 1}/${mark.total}차시` +
                        (mark.lesson?.content ? ` · ${mark.lesson.content}` : '') +
                        (mark.lesson?.supplies ? ` · 준비물 ${mark.lesson.supplies}` : '')
                  }
                >
                  {mark.bumped ? '밀림' : `${(mark.index ?? 0) + 1}/${mark.total}`}
                </span>
              )}
              {links > 0 && (
                <button
                  type="button"
                  data-week-lesson-links={n}
                  onClick={(e) => {
                    stop(e);
                    onLinks(n);
                  }}
                  className="bg-yellow-100 text-yellow-800 text-2xs leading-none px-1 py-0.5 rounded font-bold border border-yellow-300 shrink-0 hover:bg-yellow-200 cursor-pointer"
                  title={`링크된 항목 ${links}개`}
                >
                  🔗 {links}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

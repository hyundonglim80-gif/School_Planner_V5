// 월간·년간 '자세히'의 수업 칩 (V4 MonthGrid·YearMonthCard·MonthDaySheet - 둘째 줄 '수업' 토글이 켜져 있을 때).
//   - 재료는 계산한 수업 칸(useLessonsFor) - 과목 'X'는 수업 없음(V4 그대로). 그날 수업이 하나도 없으면 그리지 않는다.
//   - 띠(LessonStrip): PC 월간 칸·년간 자세히 - 교시마다 같은 폭, 빈 교시는 빈 칸(요일끼리 교시가 나란히), 글자는 칸 폭에 맞춘다. 누르면 그 교시 수정 칸.
//   - 칩(LessonWraps): 휴대폰 년간 자세히·월간 그날 목록 - 든 교시만 번호와 함께 줄바꿈(53px 칸에 여섯을 나누면 과목이 잘린다 - V4).
import { fitToWidthFontSize } from '../../domain/typeScale';
import { hasLessons, type LessonSubjects } from './lessonSubjects';

interface Props {
  date: string;
  subjects: LessonSubjects;
  /** data-* 머리 ('month' → data-month-lessons·data-month-lesson) */
  tag: string;
  onOpen?: (date: string, n: number) => void;
}

export function LessonStrip({ date, subjects, tag, onOpen, height = 20 }: Props & { height?: number }) {
  if (!hasLessons(subjects)) return null;
  return (
    <div {...{ [`data-${tag}-lessons`]: date }} className="flex flex-nowrap gap-[1px] w-full mt-0.5 mb-1">
      {subjects.map((subject, i) =>
        subject ? (
          <div
            key={i}
            {...{ [`data-${tag}-lesson`]: i + 1 }}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(date, i + 1);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onOpen?.(date, i + 1);
            }}
            style={{ height }}
            className="flex-1 min-w-0 flex items-center justify-center border border-emerald-300 rounded-[3px] bg-emerald-50 text-emerald-700 font-bold overflow-hidden cursor-pointer hover:bg-emerald-200 transition-colors [container-type:inline-size]"
            title={`${subject} (${i + 1}교시) - 누르면 고치기`}
          >
            <span className="text-2xs tracking-tighter whitespace-nowrap leading-none" style={{ fontSize: fitToWidthFontSize(subject) }}>
              {subject}
            </span>
          </div>
        ) : (
          <div key={i} title={`${i + 1}교시`} style={{ height }} className="flex-1 min-w-0 border border-slate-200 rounded-[3px] bg-slate-50" />
        ),
      )}
    </div>
  );
}

export function LessonWraps({ date, subjects, tag, onOpen }: Props) {
  if (!hasLessons(subjects)) return null;
  return (
    <div {...{ [`data-${tag}-lessons`]: date }} className="flex flex-wrap gap-1 mt-0.5">
      {subjects.map((subject, i) => {
        if (!subject) return null;
        const body = (
          <>
            <span className="text-2xs text-emerald-500">{i + 1}</span>
            <span className="max-w-[90px] truncate">{subject}</span>
          </>
        );
        const cls = 'flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold';
        const data = { [`data-${tag}-lesson`]: i + 1 };
        return onOpen ? (
          <button
            key={i}
            type="button"
            {...data}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(date, i + 1);
            }}
            title={`${i + 1}교시 ${subject} - 누르면 고치기`}
            className={`${cls} cursor-pointer`}
          >
            {body}
          </button>
        ) : (
          <span key={i} {...data} className={cls}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

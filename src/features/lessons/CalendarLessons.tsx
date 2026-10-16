// 월간·년간 '자세히'의 수업 칩 (V4 MonthGrid·YearMonthCard·MonthDaySheet - 둘째 줄 '수업' 토글이 켜져 있을 때).
//   - 재료는 계산한 수업 칸(useLessonsFor) - 과목 'X'는 수업 없음(V4 그대로). 그날 수업이 하나도 없으면 그리지 않는다.
//   - 띠(LessonStrip): PC 월간 칸·년간 자세히 - 교시마다 같은 폭, 빈 교시는 빈 칸(요일끼리 교시가 나란히), 글자는 칸 폭에 맞춘다. 누르면 그 교시 수정 칸.
//   - 칩(LessonWraps): 휴대폰 년간 자세히·월간 그날 목록 - 든 교시만 번호와 함께 줄바꿈(53px 칸에 여섯을 나누면 과목이 잘린다 - V4).
//   - 두 줄씩(LessonGrid): 휴대폰 월간 칸 - 교시 둘씩 한 줄(1·2 / 3·4 / 5·6), 글자는 칩 폭에 맞춘다(10-16 사용 의견 '휴대폰 월간에 수업이 안 나옴' -
//     V4는 세로 글자가 읽기 어려워 칸에서 뺐다(ROADMAP 15, Claude 권장). 둘씩이면 칩이 22px라 두 글자 과목이 가로로 들어간다).
//     교과 모드 '5-2 과학'은 반만('5-2'). 누르면 칸을 누른 것(그날 목록) - 칩이 작아 교시를 겨누기 어렵다.
import { parseSlot } from '../../domain/teachingSlot';
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

/** 칩에 적을 짧은 글 - 반이 있으면 반만('5-2 과학' → '5-2'), 아니면 과목 */
const shortLessonText = (subject: string) => parseSlot(subject).cls || subject;

export function LessonGrid({ date, subjects, tag }: Omit<Props, 'onOpen'>) {
  if (!hasLessons(subjects)) return null;
  // 끝의 빈 교시는 그리지 않는다 (줄만 먹는다)
  let last = subjects.length - 1;
  while (last >= 0 && !subjects[last]) last -= 1;
  return (
    <div {...{ [`data-${tag}-lessons`]: date }} className="grid grid-cols-2 gap-[1px] w-full mt-0.5 mb-[2px]">
      {subjects.slice(0, last + 1).map((subject, i) => {
        if (!subject) return <div key={i} title={`${i + 1}교시`} className="h-[13px] rounded-[3px] border border-slate-200 bg-slate-50" />;
        const text = shortLessonText(subject);
        return (
          <div
            key={i}
            {...{ [`data-${tag}-lesson`]: i + 1 }}
            title={`${i + 1}교시 ${subject}`}
            className="h-[13px] min-w-0 flex items-center justify-center rounded-[3px] border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold overflow-hidden [container-type:inline-size]"
          >
            <span className="text-2xs tracking-tighter whitespace-nowrap leading-none" style={{ fontSize: fitToWidthFontSize(text) }}>
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 작은 달력 판 (P24-2 - MiniCalendarPicker에서 뗌): 요일 머리 + 날 칸 판. 날 칸 모양(단추·색·점)은 부르는 쪽이 정한다.
//   📅 뜨는 달력(ui/MiniCalendarPicker)은 일요일부터, 한눈에 화면 첫 칸(features/board/BoardMonth)은 월요일부터(옆 요일 칸이 월~일).
//   날 칸 = 그 달 1일이 든 주 ~ 말일이 든 주(domain/dateUtils monthGridDates), 주마다 한 줄 - 줄을 칠할 수 있다(보는 주).
import { Fragment, type ReactNode } from 'react';
import { DAY_NAMES, monthGridDates } from '../domain/dateUtils';

interface Props {
  year: number;
  /** 1 ~ 12 */
  month: number;
  /** 0 = 일요일부터(기본), 1 = 월요일부터 */
  weekStart?: 0 | 1;
  /** 날 칸 하나 - 보통 단추 (inMonth = 그 달 날) */
  day: (date: string, inMonth: boolean) => ReactNode;
  /** 주 한 줄의 class·data (보는 주 칠하기) */
  week?: (days: readonly string[]) => { className?: string; data?: Record<string, string> } | undefined;
}

export default function MiniMonth({ year, month, weekStart = 0, day, week }: Props) {
  const dates = monthGridDates(year, month, weekStart);
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));
  const heads = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  return (
    <div>
      <div className="grid grid-cols-7 mb-1 pb-1 border-b border-slate-100 text-center text-xs font-bold">
        {heads.map((wd) => (
          <div key={wd} className={`py-0.5 ${wd === 0 ? 'text-rose-500' : wd === 6 ? 'text-cobalt-600' : 'text-slate-500'}`}>
            {DAY_NAMES[wd]}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {weeks.map((w) => {
          const row = week?.(w);
          return (
            <div key={w[0]} {...row?.data} className={`grid grid-cols-7 gap-0.5 text-center ${row?.className ?? ''}`}>
              {w.map((d) => (
                <Fragment key={d}>{day(d, d.startsWith(prefix))}</Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

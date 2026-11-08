// 한눈에 화면 첫 칸 (P24-2) - 작은 달력(월요일부터, 보는 주 한 줄 칠함) + 그 달 '달력' 일정 목록.
//   달력 날짜·목록 줄을 누르면 그날을 고른다(요일 칸·오른쪽이 따라온다). 달력 ◀▶는 달만 넘겨 보고 고른 날은 그대로.
interface Props {
  /** 고른 날 */
  date: string;
  /** 보는 주 (월 ~ 일) */
  week: readonly string[];
  /** 화면 높이에 맞춘 칸 - 칸 안에서 스크롤 */
  fit: boolean;
}

export default function BoardMonth({ date, fit }: Props) {
  const [y, m] = date.split('-').map(Number);
  return (
    <section
      data-board-month={date.slice(0, 7)}
      aria-label={`${y}년 ${m}월 달력`}
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-xs p-2.5 flex flex-col min-w-0 ${fit ? 'h-full min-h-0 overflow-y-auto overscroll-contain' : 'min-h-[250px]'}`}
    >
      <h3 className="text-xs font-extrabold text-slate-700 px-1">
        {y}년 {m}월
      </h3>
    </section>
  );
}

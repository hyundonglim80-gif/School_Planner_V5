// 하루 화면 (V4 features/day/DayScreen.tsx).
//
//   [수업 (7) | 일정 (5)]   ← 둘째 줄 토글 '수업'·'일정'. 하나만 켜면 남은 쪽이 다 쓴다, 둘 다 끄면 윗칸을 걷는다
//   [기록 (넓게)]
// 수업·일정을 나란히 두는 기준은 **본문 폭** 720px(@container) - 오른쪽 칸이 열려 본문이 좁아지면 위아래로 쌓는다(V4 그대로).
// 보는 날은 둘째 줄 날짜(app/nav). 자료는 기기 사본에서 고른다(data/select) - V4처럼 '불러오는 중'으로 화면을 막지 않는다.
// 수업 칸(+ 급식·학사일정)은 P6-1·P6-3, 기록 칸은 P3-2에서 채운다 - 지금은 자리만.
import { useNav } from '../../app/nav';
import DayEvents from './DayEvents';

function Placeholder({ slot, title, session }: { slot: string; title: string; session: string }) {
  return (
    <section data-day-slot={slot} className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-center">
      <h3 className="text-sm font-black text-slate-500">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{session}에서 채웁니다.</p>
    </section>
  );
}

export default function DayScreen() {
  const date = useNav((s) => s.date);
  const showEvents = useNav((s) => s.showEvents);
  const showClass = useNav((s) => s.showClass);

  return (
    <div data-screen="day" className="pb-12 flex flex-col gap-6">
      {(showEvents || showClass) && (
        <div className="grid grid-cols-1 @min-[720px]:grid-cols-12 gap-6">
          {/* 주간·월간·년간이 모두 수업을 먼저 보여 주므로 하루도 수업을 앞에 둔다 */}
          {showClass && (
            <div className={showEvents ? '@min-[720px]:col-span-7' : '@min-[720px]:col-span-12'}>
              <Placeholder slot="lessons" title="⏰ 수업 · 급식" session="P6-1·P6-3" />
            </div>
          )}
          {showEvents && (
            <div className={`${showClass ? '@min-[720px]:col-span-5' : '@min-[720px]:col-span-12'} flex flex-col gap-6`}>
              <DayEvents date={date} />
            </div>
          )}
        </div>
      )}
      <div className="w-full">
        <Placeholder slot="journal" title="📔 기록" session="P3-2" />
      </div>
    </div>
  );
}

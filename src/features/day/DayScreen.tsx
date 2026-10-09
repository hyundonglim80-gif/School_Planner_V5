// 하루 화면 (V4 features/day/DayScreen.tsx).
//
//   [수업 (7) | 일정 (5)]   ← 둘째 줄 토글 '수업'·'일정'. 하나만 켜면 남은 쪽이 다 쓴다, 둘 다 끄면 윗칸을 걷는다
//   [기록 (넓게)]
// 수업·일정을 나란히 두는 기준은 **본문 폭** 720px(@container) - 오른쪽 칸이 열려 본문이 좁아지면 위아래로 쌓는다(V4 그대로).
// 보는 날은 둘째 줄 날짜(app/nav). 자료는 기기 사본에서 고른다(data/select) - V4처럼 '불러오는 중'으로 화면을 막지 않는다.
// 수업 칸은 P6-1(features/lessons/DayLessons), 급식·학사일정은 P6-3. 교사 유형을 아직 고르지 않았으면 맨 위에 띠.
import { useNav } from '../../app/nav';
import DayLessons from '../lessons/DayLessons';
import TeachingBanner from '../lessons/TeachingBanner';
import DayEvents from './DayEvents';
import DayJournal from './DayJournal';

export default function DayScreen() {
  const date = useNav((s) => s.date);
  const showEvents = useNav((s) => s.showEvents);
  const showClass = useNav((s) => s.showClass);

  return (
    <div data-screen="day" className="pb-12 flex flex-col gap-6">
      <TeachingBanner />
      {(showEvents || showClass) && (
        <div className="grid grid-cols-1 @min-[720px]:grid-cols-12 gap-6">
          {/* 주간·월간·년간이 모두 수업을 먼저 보여 주므로 하루도 수업을 앞에 둔다 */}
          {showClass && (
            <div className={showEvents ? '@min-[720px]:col-span-7' : '@min-[720px]:col-span-12'}>
              <DayLessons date={date} />
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
        <DayJournal date={date} />
      </div>
    </div>
  );
}

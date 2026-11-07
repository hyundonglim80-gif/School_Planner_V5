// 하루 화면의 몸통 - 수업·일정(나란히) + 메모 (DayScreen, 한눈에 화면을 쌓았을 때 - P24). 하루 화면을 고치면 둘 다 바뀐다.
//
//   [수업 (7) | 일정 (5)]   ← 둘째 줄 토글 '수업'·'일정'. 하나만 켜면 남은 쪽이 다 쓴다, 둘 다 끄면 윗칸을 걷는다
//   [메모 (넓게)]
// 수업·일정을 나란히 두는 기준은 **본문 폭** 720px(@container) - 오른쪽 칸이 열려 본문이 좁아지면 위아래로 쌓는다(V4 그대로).
import { useNav } from '../../app/nav';
import DayLessons from '../lessons/DayLessons';
import DayEvents from './DayEvents';
import DayJournal from './DayJournal';

export default function DayBody({ date }: { date: string }) {
  const showEvents = useNav((s) => s.showEvents);
  const showClass = useNav((s) => s.showClass);
  return (
    <>
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
    </>
  );
}

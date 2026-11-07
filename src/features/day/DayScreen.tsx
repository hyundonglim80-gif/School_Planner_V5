// 하루 화면 (V4 features/day/DayScreen.tsx).
//
// 몸통(수업 | 일정 / 메모)은 DayBody - 한눈에 화면(P24)도 함께 쓴다.
// 보는 날은 둘째 줄 날짜(app/nav). 자료는 기기 사본에서 고른다(data/select) - V4처럼 '불러오는 중'으로 화면을 막지 않는다.
// 수업 칸은 P6-1(features/lessons/DayLessons), 급식·학사일정은 P6-3. 교사 유형을 아직 고르지 않았으면 맨 위에 띠, 고른 뒤 시간표·학급이 없으면 '다음' 띠(P22-7).
// printAt = 인쇄 창(features/print)의 쪽 하나 - 그날로 그리고 띠는 뺀다.
import { useNav } from '../../app/nav';
import FirstStepsBanner from '../lessons/FirstStepsBanner';
import TeachingBanner from '../lessons/TeachingBanner';
import DayBody from './DayBody';

export default function DayScreen({ printAt }: { printAt?: string }) {
  const navDate = useNav((s) => s.date);
  const date = printAt ?? navDate;

  return (
    <div data-screen="day" className="pb-12 flex flex-col gap-6">
      {!printAt && <TeachingBanner />}
      {!printAt && <FirstStepsBanner />}
      <DayBody date={date} />
    </div>
  );
}

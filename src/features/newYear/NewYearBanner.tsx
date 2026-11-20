// '🌱 새 학년도 준비' 띠의 문 (P9-2 · P49-3) - 껍데기에 늘 있다. 띠를 띄우는 날(2/15 ~ 3/31)에만 띠 몸(NewYearBannerBody)을 받는다 -
//   그 밖의 날에는 새 학년도 셈·학급·시간표 베끼기 코드가 첫 화면 JS에 실리지 않는다. 끊겨서 못 받으면 띠 없이(다음에 그릴 때 다시 받는다).
import { Suspense } from 'react';
import { lazyWithReload } from '../../app/lazyWithReload';
import { todayStr } from '../../domain/dateUtils';
import { newYearTarget } from '../../domain/newYearTarget';
import { useClock } from '../../ui/useClock';

const NewYearBannerBody = lazyWithReload(() => import('./NewYearBannerBody'), () => null);

export default function NewYearBanner() {
  useClock(true); // 날이 바뀌면 다시 본다
  const target = newYearTarget(todayStr());
  if (!target) return null;
  return (
    <Suspense fallback={null}>
      <NewYearBannerBody year={target} />
    </Suspense>
  );
}

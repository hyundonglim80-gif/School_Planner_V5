// '🌱 새 학년도 준비' 띠 (P9-2) - 2/15 ~ 3/31, 지난 자료가 있는 계정에 할 것(학급·시간표·방학·담임반)이 남았으면 본문 맨 위에.
// '준비하기' = 새 학년도 준비 창. '닫기' = 그 학년도에는 다시 띄우지 않는다(계정 common.newYearDone - 다른 기기에서도). 창은 ⏰ 시간표 창 머리줄 🌱에서 언제든.
// 학급·시간표·계정 설정을 받기 전에는 띄우지 않는다(받기 전의 '없음'은 모르는 것이다).
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { openWindow } from '../../app/windows';
import { todayStr } from '../../domain/dateUtils';
import { newYearTarget } from '../../domain/newYear';
import { useClock } from '../../ui/useClock';
import { useNewYear, useNewYearLoaded } from './useNewYear';

export default function NewYearBanner() {
  useClock(true); // 날이 바뀌면 다시 본다
  const target = newYearTarget(todayStr());
  return target ? <Banner year={target} /> : null;
}

function Banner({ year }: { year: number }) {
  const loaded = useNewYearLoaded();
  const done = useCommonSettings((s) => s.newYearDone);
  const { pending, past } = useNewYear(year);
  if (!loaded || done >= year || !past || !pending) return null;

  const dismiss = () => {
    setCommonSetting('newYearDone', year);
    showToast('🌱 띠를 닫았습니다. ⏰ 시간표 창 위 🌱 새 학년도에서 언제든 엽니다.');
  };

  return (
    <div role="status" data-new-year-banner={year} className="mb-3 flex items-center gap-2 flex-wrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
      <span className="font-bold">🌱 {year}학년도 준비</span>
      <span className="text-emerald-700">라벨·설정은 그대로 - 새 학급·시간표·방학만 정하면 됩니다.</span>
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-new-year-open
          onClick={() => openWindow('newYear', { year })}
          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
        >
          준비하기
        </button>
        <button type="button" data-new-year-dismiss onClick={dismiss} className="px-2 py-1 rounded-lg hover:bg-emerald-100 font-bold text-emerald-700 cursor-pointer">
          닫기
        </button>
      </span>
    </div>
  );
}

// 년간 화면 머리 '⚠️ 2027년 공휴일 표가 없습니다' (P14-3 ■3) - 관리자 계정에만(P33-1). 표가 없으면 설·추석·대체 공휴일이 말없이 빠진다(data/holidays).
// 올해, 9월부터는 내년도(domain/holidays holidayYearsToWarn). 누르면 환경설정 '관리자' 탭(받기 - DevHolidaysSection).
import { openWindow } from '../../app/windows';
import { useMissingHolidayYears } from '../../data/holidays';
import { useIsAdmin } from '../../data/admins';
import { holidayYearsToWarn } from '../../domain/holidays';
import { useToday } from '../../ui/useToday';

function Note() {
  const years = useMissingHolidayYears(holidayYearsToWarn(useToday()));
  if (years.length === 0) return null;
  return (
    <button
      type="button"
      data-holiday-missing={years.join(',')}
      onClick={() => openWindow('settings', { tab: 'dev' })}
      className="w-full text-left mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-100 cursor-pointer"
    >
      ⚠️ {years.join('·')}년 공휴일 표가 없습니다 - 환경설정 &gt; 관리자에서 받기
    </button>
  );
}

export default function HolidayMissingNote() {
  return useIsAdmin() ? <Note /> : null;
}

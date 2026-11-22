// 둘째 줄 토글 '📅 구글' (P36-4 - PLAN 5장 'P36-4 구글 캘린더 겹쳐 그리기 ■0 정한 것' ③): 겹쳐 그린 구글 캘린더 일정 보이기·숨기기.
//   고른 구글 캘린더가 있을 때만 선다(환경설정 보기 탭에서 고른다) · 이 기기에(gcalView sp5-gcal-view) · 주말·일정·수업 토글과 같은 꼴.
//   단축키 이름은 없다 - 자기 data-gcal-toggle이 있어 '단추 대신 누르기'(P28-3)로 키를 건다.
import { setGcalShown, useGcalPicked, useGcalView } from './gcalView';
import { Glyph } from '../../ui/Icon';

export default function GcalToggle() {
  const picked = useGcalPicked();
  const on = useGcalView((s) => s.on);
  if (!picked) return null;
  return (
    <button
      type="button"
      data-gcal-toggle
      aria-pressed={on}
      onClick={() => setGcalShown(!on)}
      title={`구글 캘린더 일정 ${on ? '숨기기' : '보이기'} (이 기기 - 고르기는 환경설정 보기 탭)`}
      className={`px-1.5 py-0.5 text-2xs sm:px-3 sm:py-1 sm:text-xs rounded-lg font-bold border transition-all whitespace-nowrap ${
        on ? 'bg-white text-primary border-primary/50' : 'bg-white text-slate-500 border-slate-200 line-through decoration-slate-300'
      }`}
    >
      <Glyph e="📅" /><span className="hidden sm:inline"> 구글</span>
    </button>
  );
}

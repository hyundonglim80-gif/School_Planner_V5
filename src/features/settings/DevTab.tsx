// 환경설정 '개발자' 탭 (P14-2 - 개발자 계정에만, domain/developers): 공휴일 받기 = DevHolidaysSection(P14-3) · 오류 기록 = DevErrorsSection.
import DevErrorsSection from './DevErrorsSection';
import DevHolidaysSection from './DevHolidaysSection';

export default function DevTab() {
  return (
    <div data-dev-tab>
      <DevHolidaysSection />
      <DevErrorsSection />
    </div>
  );
}

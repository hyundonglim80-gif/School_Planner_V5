// 환경설정 '관리자' 탭 (P14-2 '개발자' → P33-1 '관리자' - 관리자 계정에만, data/admins `useIsAdmin`):
// 관리자 계정 = AdminsSection(P33-1) · 공휴일 받기 = DevHolidaysSection(P14-3) · 오류 기록 = DevErrorsSection.
import AdminsSection from './AdminsSection';
import DevErrorsSection from './DevErrorsSection';
import DevHolidaysSection from './DevHolidaysSection';

export default function DevTab() {
  return (
    <div data-dev-tab>
      <AdminsSection />
      <DevHolidaysSection />
      <DevErrorsSection />
    </div>
  );
}

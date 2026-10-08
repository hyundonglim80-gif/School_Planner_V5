// 환경설정 '앱' 탭 (MENU 3-6): 앱으로 설치(■5) · 이 기기 사본 다시 받기(P2-2) · 빌드 번호.
import { Section } from './parts';

export default function AppTab() {
  return (
    <div>
      <Section id="build" title="빌드 번호" desc="문제를 알릴 때 이 번호를 함께 적어 주세요. 화면 오른쪽 아래에도 있습니다.">
        <code data-settings-build className="text-sm font-bold text-slate-700">
          {__BUILD_ID__}
        </code>
      </Section>
    </div>
  );
}

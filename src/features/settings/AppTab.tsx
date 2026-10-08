// 환경설정 '앱' 탭 (MENU 3-6): 앱으로 설치 · 이 기기 사본 다시 받기(P2-2) · 빌드 번호.
import { installApp, useInstall } from '../../app/install';
import { Section } from './parts';

export default function AppTab() {
  const { canPrompt, standalone } = useInstall();
  return (
    <div>
      <Section
        id="install"
        title="앱으로 설치"
        desc="휴대폰·PC에 앱처럼 설치하면 주소창 없이 열리고, 홈 화면·바탕화면의 SP5 아이콘으로 바로 엽니다."
      >
        <button
          type="button"
          data-install-pwa={canPrompt ? 'ready' : 'guide'}
          onClick={() => void installApp()}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
        >
          📱 앱으로 설치
        </button>
        {standalone && <p className="text-xs text-emerald-600 font-bold mt-2">지금 설치한 앱으로 열려 있습니다.</p>}
      </Section>
      <Section id="build" title="빌드 번호" desc="문제를 알릴 때 이 번호를 함께 적어 주세요. 화면 오른쪽 아래에도 있습니다.">
        <code data-settings-build className="text-sm font-bold text-slate-700">
          {__BUILD_ID__}
        </code>
      </Section>
    </div>
  );
}

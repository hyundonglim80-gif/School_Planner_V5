// 환경설정 '앱' 탭 (MENU 3-6): 앱으로 설치 · 이 기기 사본 다시 받기(P2-2) · 빌드 번호.
import { useState } from 'react';
import { installApp, useInstall } from '../../app/install';
import { showErrorToast, showToast } from '../../app/toast';
import { useMirror } from '../../data/mirror/store';
import { resetMirror } from '../../data/mirror/sync';
import { Section } from './parts';

/** 이 기기 사본: 어디에 두나(IndexedDB / 메모리로만)·몇 개 - 다시 받기 */
function MirrorSection() {
  const persisted = useMirror((s) => s.persisted);
  const count = useMirror((s) => Object.values(s.colls).reduce((n, c) => n + Object.keys(c.docs).length, 0));
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await resetMirror();
      showToast('🔄 이 기기 사본을 지우고 서버에서 다시 받습니다.');
    } catch (e) {
      showErrorToast('이 기기 사본을 지우지 못했습니다. 다른 탭을 닫고 다시 해 주세요.', e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      id="mirror"
      title="이 기기 사본"
      desc="일정·메모·기록·라벨을 이 기기에도 담아 두어 앱을 열면 곧바로 보이고, 인터넷이 끊겨도 볼 수 있습니다. 화면이 서버와 다르게 보이면 다시 받으세요(지워지는 것은 이 기기 사본뿐입니다)."
    >
      <p data-mirror-state={persisted ?? 'none'} className="text-xs text-slate-500 mb-2">
        {persisted === 'memory'
          ? '⚠️ 이 브라우저가 사본 저장을 막아 메모리로만 받고 있습니다(서버 자료는 그대로 들어옵니다).'
          : persisted === 'disk'
            ? '이 기기에 담아 두고 있습니다.'
            : '준비하는 중…'}{' '}
        <span data-mirror-count={count}>({count}개)</span>
      </p>
      <button
        type="button"
        data-mirror-reset
        disabled={busy}
        onClick={() => void run()}
        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
      >
        🔄 이 기기 사본 다시 받기
      </button>
    </Section>
  );
}

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
      <MirrorSection />
      <Section id="build" title="빌드 번호" desc="문제를 알릴 때 이 번호를 함께 적어 주세요. 화면 오른쪽 아래에도 있습니다.">
        <code data-settings-build className="text-sm font-bold text-slate-700">
          {__BUILD_ID__}
        </code>
      </Section>
    </div>
  );
}

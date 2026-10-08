// 앱으로 설치 (V4 Layout의 beforeinstallprompt·'sp-install-pwa'). 서비스 워커 등록도 여기서 한다.
//
// 크롬은 설치할 수 있는 페이지면 beforeinstallprompt를 한 번 보낸다. 그 이벤트를 붙잡아 두었다가 환경설정 '앱' 탭의
// '📱 앱으로 설치'를 누르면 설치 창을 띄운다. 이벤트는 화면이 그려지기 전에 올 수 있어 main.tsx에서 일찍 듣는다.
// 이미 설치했거나 사파리처럼 설치 창이 없는 브라우저면 손으로 하는 길을 알려 준다.
import { create } from 'zustand';
import { showToast } from './toast';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** 설치 창을 띄울 수 있다 (크롬이 beforeinstallprompt를 보냈다) */
  canPrompt: boolean;
  /** 설치한 앱으로 열려 있다 (주소창 없이) */
  standalone: boolean;
}

export const useInstall = create<InstallState>(() => ({ canPrompt: false, standalone: false }));

let deferred: InstallPromptEvent | null = null;

const isStandalone = () =>
  !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** 앱을 열 때 한 번 (main.tsx): 서비스 워커를 등록하고 설치 이벤트를 듣는다 */
export function startInstall() {
  useInstall.setState({ standalone: isStandalone() });
  window.addEventListener('beforeinstallprompt', (e) => {
    // 크롬이 스스로 띄우는 작은 안내 대신 '앱으로 설치' 단추로
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    useInstall.setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    useInstall.setState({ canPrompt: false });
    showToast('📱 앱으로 설치했습니다. 홈 화면·바탕화면의 SP5 아이콘으로 열 수 있습니다.');
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err: unknown) => console.warn('[sw] 서비스 워커 등록 실패:', err));
    });
  }
}

/** 환경설정 '📱 앱으로 설치' */
export async function installApp() {
  if (deferred) {
    const e = deferred;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') {
      deferred = null;
      useInstall.setState({ canPrompt: false });
    }
    return;
  }
  showToast(
    useInstall.getState().standalone
      ? '📱 지금 설치한 앱으로 열려 있습니다.'
      : "📱 이미 이 기기에 설치되어 있거나, 이 브라우저는 바로 설치를 지원하지 않습니다. 아이폰·아이패드(사파리)는 아래 '공유' 단추 → '홈 화면에 추가'로 설치합니다.",
    8000,
  );
}

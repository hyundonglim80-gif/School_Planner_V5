// 끊겨서 받지 못한 창·화면의 대신 그림 (app/lazyWithReload). 새 판으로 연 바로 뒤, 서비스 워커가 이 판의 파일을
// 다 담기 전에 끊기면 생긴다 - 다 담은 뒤에는(앱을 열고 1분쯤) 끊겨도 모두 열린다.
import { useEffect } from 'react';
import { useChunkRetry } from './lazyWithReload';
import { showToast } from './toast';
import type { WindowProps } from './windows';

export const OFFLINE_WINDOW_MESSAGE = '📴 인터넷이 끊겨 이 칸을 아직 열 수 없습니다 - 인터넷이 이어지면 다시 눌러 주세요.';

/** 창: 안내하고 닫는다 (다음에 열 때 새로 받는다) */
export function OfflineWindow({ close }: WindowProps) {
  const { renew } = useChunkRetry();
  useEffect(() => {
    renew();
    showToast(OFFLINE_WINDOW_MESSAGE, 5000, 'error');
    close();
    // 그린 그때 한 번만
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** 화면: 그 자리에 안내 - 인터넷이 이어지면 저절로 다시 받는다 */
export function OfflineScreen() {
  const { retry } = useChunkRetry();
  useEffect(() => {
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [retry]);
  return (
    <div data-screen-offline className="p-6 text-center text-sm text-slate-500">
      <p>📴 인터넷이 끊겨 이 화면을 아직 받지 못했습니다.</p>
      <p className="text-xs text-slate-400 mt-1">인터넷이 이어지면 저절로 열립니다.</p>
      <button
        type="button"
        data-screen-offline-retry
        onClick={retry}
        className="mt-3 px-4 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-xs font-bold cursor-pointer"
      >
        다시 시도
      </button>
    </div>
  );
}

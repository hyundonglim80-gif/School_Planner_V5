// 서버가 아직 받지 않은 저장이 있을 때 머리줄 안내 (P14-6 ■1 - 10-30 사용자 휴대폰 (a) ②: 끊긴 채 저장하고 앱을 닫으면 메모가 없었다).
//   - 인터넷이 끊겼거나(navigator.onLine) 3초 넘게 기다리면 "앱을 닫지 마세요 (n개)" - 끊긴 동안 쓰기는 메모리에만 있다(data/pendingWrites).
//   - 기다리던 것을 서버가 다 받으면 띠를 거두고 '저장을 마쳤습니다' 안내 한 번.
//   - 탭·창을 닫을 때는 브라우저가 묻는다(app/pendingWritesGuard - 휴대폰 앱은 묻지 못할 수 있어 띠가 먼저다).
//   - floating = 창 위에 떠서(body로 portal - 머리줄은 backdrop-blur라 그 안의 fixed는 머리줄에 붙는다): 휴대폰에서 창이 화면을 덮을 때·새 창.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePendingWrites } from '../data/pendingWrites';
import { showToast } from './toast';

/** 인터넷이 이어져 있어도 이만큼 넘게 기다리면 띠를 띄운다 */
export const PENDING_NOTICE_MS = 3000;

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export default function PendingWritesBanner({ floating = false }: { floating?: boolean }) {
  const { count, since } = usePendingWrites();
  const online = useOnline();
  // 3초가 지난 때를 다시 그린다 (기다리는 동안만)
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (since === null) {
      // 기다리는 것이 없어지면 다음 쓰기는 다시 3초를 센다
      // oxlint-disable-next-line react/set-state-in-effect
      setLate(false);
      return;
    }
    const left = since + PENDING_NOTICE_MS - Date.now();
    if (left <= 0) {
      // oxlint-disable-next-line react/set-state-in-effect
      setLate(true);
      return;
    }
    const t = setTimeout(() => setLate(true), left);
    return () => clearTimeout(t);
  }, [since]);

  const shown = count > 0 && (!online || late);
  // 띠를 보인 뒤 다 받으면 한 번 알린다 (띠 없이 지나간 짧은 저장은 알리지 않는다)
  const wasShown = useRef(false);
  useEffect(() => {
    if (shown) wasShown.current = true;
    else if (count === 0 && wasShown.current) {
      wasShown.current = false;
      showToast('✅ 기다리던 저장을 마쳤습니다.');
    }
  }, [shown, count]);

  if (!shown) return null;
  const bar = (
    <div
      role="status"
      data-pending-writes={count}
      data-pending-offline={online ? undefined : ''}
      data-pending-floating={floating ? '' : undefined}
      className={`flex items-center gap-x-2 gap-y-0.5 flex-wrap rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900${floating ? ' shadow-lg' : ''}`}
    >
      <span className="font-bold">
        {online ? '⏳ 저장을 기다립니다' : '📴 인터넷이 끊겨 저장을 기다립니다'} - 앱을 닫지 마세요 ({count}개)
      </span>
      <span className="text-amber-700">인터넷이 이어지면 저절로 저장됩니다.</span>
    </div>
  );
  if (!floating) return bar;
  // 창(z 1000~) 위, 안내(toast) 아래. 누르기는 아래 창으로 지나간다(✕·저장 단추를 막지 않게)
  return createPortal(<div className="fixed top-1 inset-x-2 z-[99000] pointer-events-none flex justify-center">{bar}</div>, document.body);
}

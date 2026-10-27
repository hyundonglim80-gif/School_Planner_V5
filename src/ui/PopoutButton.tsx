// 머리 ↗ - 오른쪽 칸을 새 창으로 옮긴다 (10-28 사용자 요청, ui/popout). ✕ 바로 왼쪽에 둔다.
// 오른쪽 줄에 붙은 창의 맨 바깥 틀 안에서만 그린다(틀이 PopoutTargetContext를 건다) - 휴대폰 배너·가운데 창·새 창 안에서는 없다.
import { useContext } from 'react';
import { popOutWindow } from '../app/popout';
import { PopoutTargetContext } from './popout';

export default function PopoutButton({ className = 'w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100' }: { className?: string }) {
  const key = useContext(PopoutTargetContext);
  if (key === null) return null;
  return (
    <button
      type="button"
      data-popout-open
      onClick={() => void popOutWindow(key)}
      title="새 창으로 옮기기 - 화면 밖(다른 모니터)에 따로 둡니다. 저장하지 않은 것은 먼저 저장합니다"
      aria-label="새 창으로 옮기기"
      className={`flex items-center justify-center shrink-0 transition-colors cursor-pointer ${className}`}
    >
      {/* 네모에서 나가는 화살표 */}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 4h6v6" />
        <path d="M20 4l-9 9" />
        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    </button>
  );
}

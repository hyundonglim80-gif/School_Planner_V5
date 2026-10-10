// 머리줄 '📅 못 보낸 일정 N' (V4 data-gcal-pending) - 구글 캘린더로 보낼 일정이 큐에 남았을 때만. 누르면 로그인 창을 열고 보낸다.
import { sendGcalNow, useGcal } from './auto';

export default function GcalPendingButton({ className }: { className: string }) {
  const pending = useGcal((s) => s.pending);
  const flushing = useGcal((s) => s.flushing);
  if (!pending || flushing) return null;
  return (
    <button
      type="button"
      data-gcal-pending={pending}
      onClick={() => void sendGcalNow()}
      className={`${className} bg-sky-50 hover:bg-sky-100 text-sky-700`}
      title="구글 캘린더에 아직 보내지 못한 일정이 있습니다. 누르면 구글 로그인을 확인하고 보냅니다."
      aria-label={`구글 캘린더에 못 보낸 일정 ${pending}개 보내기`}
    >
      <span>📅</span>
      <span className="hidden sm:inline">못 보낸 일정</span>
      <span className="font-bold">{pending}</span>
    </button>
  );
}

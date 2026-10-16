// ⏰ 알림이 울릴 때 화면 가운데 깜빡이는 큰 창 (V4 components/EventAlarmPopup.tsx 그대로).
// 창 목록·오른쪽 칸에 서지 않는다 - 무엇을 하던 중이든 가운데를 덮어야 한다(V4 그대로).
// 소리: 3초마다, 환경설정 '알림 소리' 길이만큼(한 번 · 10초 = 3번(기본 - V4 2026-10-08) · 30초 · 1분 · 5분 · 확인할 때까지 - P10-1).
// 확인·'소리 끄기'를 누르면 바로 멈춘다.
// 브라우저가 소리를 막았으면(휴대폰에서 앱을 막 열었거나 뒤에서 돌아옴 - 10-16 '알림은 뜨는데 알람이 안 울림') '🔔 소리 켜기'를 보인다 - 누르면 바로 울린다.
import { useEffect, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { audioContext, playAlarmChime, soundAllowed } from '../../app/sound';
import { CHIME_EVERY_MS, chimeCount } from '../../domain/eventAlarm';
import { useVisualViewport } from '../../ui/useVisualViewport';

export interface RingingAlarm {
  id: string;
  date: string;
  text: string;
}

export default function EventAlarmPopup({ alarms, onDismiss }: { alarms: RingingAlarm[]; onDismiss: () => void }) {
  const isOpen = alarms.length > 0;
  const vv = useVisualViewport(isOpen);
  // 새 알림이 더해지면 다시 울린다 (껐던 소리도 새 알림에는 다시 켠다) - 끈 때의 알림 묶음을 기억해 두고 견준다
  const ringKey = alarms.map((a) => a.id).join('|');
  const [mutedKey, setMutedKey] = useState('');
  const muted = !!ringKey && mutedKey === ringKey;
  const times = chimeCount(useCommonSettings((s) => s.alarmSound));
  // 소리가 막혔나 (울리기 시작할 때 본다) - 막혔으면 '🔔 소리 켜기'
  const [blockedKey, setBlockedKey] = useState('');
  const blocked = !!ringKey && blockedKey === ringKey;

  useEffect(() => {
    if (!ringKey || muted) return;
    let alive = true;
    void soundAllowed().then((ok) => alive && !ok && setBlockedKey(ringKey));
    playAlarmChime();
    if (times <= 1)
      return () => {
        alive = false;
      };
    let played = 1;
    const id = setInterval(() => {
      playAlarmChime();
      played += 1;
      if (played >= times) clearInterval(id);
    }, CHIME_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ringKey, muted, times]);

  /** 누른 김에 소리 장치를 깨우고 바로 한 번 (남은 회차는 그대로 이어 울린다) */
  const unblock = () => {
    void audioContext()?.resume?.().catch(() => {});
    playAlarmChime();
    setBlockedKey('');
  };

  if (!isOpen) return null;

  return (
    <div
      data-alarm-popup={ringKey}
      role="alertdialog"
      aria-label="일정 알림"
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-4 sp5-alarm-backdrop"
      style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height }}
    >
      <div className="relative w-full max-w-lg max-h-full overflow-y-auto rounded-[30px] border-8 border-yellow-300 p-8 text-center shadow-2xl sp5-alarm-content">
        <div className="text-7xl mb-5" aria-hidden>
          ⏰
        </div>
        <div className="space-y-4 mb-8">
          {alarms.map((a, i) => (
            <div key={a.id} data-alarm-item={a.id} className={i > 0 ? 'pt-4 border-t-2 border-dashed border-white/50' : ''}>
              <p className="text-xl sm:text-2xl font-black text-white whitespace-pre-wrap leading-relaxed break-words">🚨 {a.text}</p>
            </div>
          ))}
        </div>
        {blocked && !muted && (
          <button
            type="button"
            data-alarm-unmute
            onClick={unblock}
            className="block mx-auto mb-3 px-5 py-2.5 text-lg font-black text-slate-900 bg-yellow-300 border-2 border-white rounded-xl hover:bg-yellow-200 cursor-pointer"
          >
            🔔 소리 켜기
          </button>
        )}
        {!muted && (
          <button
            type="button"
            data-alarm-mute
            onClick={() => setMutedKey(ringKey)}
            className="block mx-auto mb-4 px-4 py-2 text-base font-bold text-white bg-black/30 border-2 border-white/70 rounded-xl hover:bg-black/40 cursor-pointer"
          >
            🔇 소리 끄기
          </button>
        )}
        <button
          type="button"
          data-alarm-dismiss
          onClick={onDismiss}
          className="px-10 py-4 text-xl sm:text-2xl font-black text-slate-900 bg-white border-4 border-slate-900 rounded-2xl shadow-lg hover:bg-slate-100 active:scale-95 transition-transform cursor-pointer"
        >
          확 인 (알림 끄기)
        </button>
      </div>
    </div>
  );
}

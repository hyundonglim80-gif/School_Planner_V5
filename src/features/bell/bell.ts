// 수업 종 (V4 hooks/useClassBell.ts) - 설정은 계정 설정 common.classBell(고르는 즉시 - 1초 뒤 올라간다), 울리기는 껍데기(Shell)에서 한 번.
// 소리는 app/sound(Web Audio, 파일 없이). 브라우저는 사용자가 한 번 누르기 전에는 소리를 막으므로, 처음 누르거나 키를 칠 때 소리 장치를 깨워 둔다.
// 앱(탭)이 열려 있을 때만 울린다 - 닫혀 있으면 울리지 않는다. '이 기기에서 울리기'는 이 기기에만(localStorage).
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { playBell, wakeAudioOnGesture } from '../../app/sound';
import { showToast } from '../../app/toast';
import { BELL_MUTE_KEY, bellDay, bellMessage, bellsDue, bellTimes, sanitizeBell, type ClassBellSettings } from '../../domain/classBell';
import { timesOf } from '../../domain/periodTimes';

export const useClassBell = () => useCommonSettings((s) => s.classBell);

export function saveClassBell(bell: ClassBellSettings) {
  setCommonSetting('classBell', sanitizeBell(bell));
}

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(BELL_MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

/** 이 기기에서 울리지 않기 (교실 PC에서만 울리고 집 PC·휴대폰은 조용히) */
export const useBellMutedHere = create<{ muted: boolean }>(() => ({ muted: readMuted() }));

export function setBellMutedHere(muted: boolean) {
  try {
    if (muted) localStorage.setItem(BELL_MUTE_KEY, '1');
    else localStorage.removeItem(BELL_MUTE_KEY);
  } catch {
    // 시크릿 모드 등 - 이 탭에서만
  }
  useBellMutedHere.setState({ muted });
}

const secOfDay = (d: Date) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();

/** 껍데기에서 한 번. 교시 시각에 맞춰 종을 울리고 안내를 띄운다 */
export function useClassBellRunner() {
  const bell = useClassBell();
  const periods = useCommonSettings((s) => s.periods);
  const muted = useBellMutedHere((s) => s.muted);
  const state = useRef({ bell, periods, muted, prev: 0 });
  useEffect(() => {
    state.current = { ...state.current, bell, periods, muted };
  }, [bell, periods, muted]);

  // 처음 누르거나 키를 칠 때 소리 장치를 깨운다 (브라우저가 그 전에는 소리를 막는다)
  useEffect(() => {
    if (!bell.enabled) return;
    return wakeAudioOnGesture();
  }, [bell.enabled]);

  useEffect(() => {
    if (!bell.enabled) return;
    state.current.prev = secOfDay(new Date());
    const id = setInterval(() => {
      const now = new Date();
      const sec = secOfDay(now);
      const s = state.current;
      const prev = s.prev;
      s.prev = sec;
      if (!bellDay(s.bell, now) || s.muted) return;
      const due = bellsDue(bellTimes(timesOf(s.periods), s.bell, s.periods.length), prev, sec);
      if (due.length === 0) return;
      playBell();
      const b = due[due.length - 1];
      const msg = `🔔 ${bellMessage(b, s.bell, s.periods[b.period - 1]?.name)}`;
      (window as unknown as { __spBellLast?: string }).__spBellLast = msg; // 점검이 본다 (안내는 몇 초 뒤 사라진다)
      showToast(msg);
    }, 1000);
    return () => clearInterval(id);
  }, [bell.enabled]);
}

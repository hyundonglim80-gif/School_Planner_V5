// 앱이 내는 소리(일정 알림·수업 종 P6-3)가 함께 쓰는 소리 장치 (V4 lib/sound.ts). 소리는 Web Audio로 만든다(파일 없이).
// 브라우저는 사용자가 이 페이지를 한 번 누르거나 키를 치기 전에는 소리를 막는다 - wakeAudioOnGesture로
// 처음 누를 때 깨워 둔다. 한 번도 누르지 않은 탭에서는 소리가 나지 않을 수 있다 - 일정 알림은 그때 OS 알림을 함께 띄워
// 기기 알림 소리로 울린다(soundAllowed, features/events/EventAlarms).

/** 점검이 몇 번 울렸는지 본다 (window.__spAlarmSoundCount·__spBellCount) */
type SoundCounters = { __spAlarmSoundCount?: number; __spBellCount?: number };
type AudioWindow = typeof globalThis & SoundCounters & { webkitAudioContext?: typeof AudioContext };

let audio: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  try {
    const w = window as unknown as AudioWindow;
    const Ctor = w.AudioContext || w.webkitAudioContext;
    if (!Ctor) return null;
    if (!audio) audio = new Ctor();
    return audio;
  } catch {
    return null;
  }
}

/** 처음 누르거나 키를 칠 때 소리 장치를 깨운다. 돌려준 함수로 듣기를 그만둔다 */
export function wakeAudioOnGesture(): () => void {
  const wake = () => void audioContext()?.resume?.();
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
  return () => {
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
}

/**
 * 지금 소리를 낼 수 있나 - 막혀 있으면 한 번 깨워 보고(0.3초) 본다.
 * 이 탭을 한 번도 누르지 않았으면(앱을 막 열었을 때·새로 고친 뒤) 대개 false - 새 주소라 브라우저가 자동 재생을 허락하지 않은 곳도.
 */
export async function soundAllowed(): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx) return false;
  if (ctx.state === 'running') return true;
  try {
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
  } catch {
    /* 막혔다 */
  }
  return (ctx.state as AudioContextState) === 'running'; // resume 뒤에 바뀐다(위에서 좁힌 타입이 아니다)
}

/** 음 하나 (at: ctx 시각, len: 초) */
function tone(ctx: AudioContext, freq: number, at: number, len: number, peak: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + len + 0.05);
}

/** 학교 종처럼 네 음 두 번 (딩동댕동) - 수업 종(P6-3) */
export function playBell() {
  const w = window as unknown as AudioWindow;
  w.__spBellCount = (w.__spBellCount || 0) + 1;
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume?.();
  const notes = [659.25, 523.25, 587.33, 392.0, 392.0, 587.33, 659.25, 523.25]; // 미 도 레 솔 / 솔 레 미 도
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((f, i) => tone(ctx, f, t0 + i * 0.55 + (i >= 4 ? 0.4 : 0), 1.1, 0.35));
}

/** 일정 알림 한 번 (삐삐삐 - 삐삐삐) */
export function playAlarmChime() {
  const w = window as unknown as AudioWindow;
  w.__spAlarmSoundCount = (w.__spAlarmSoundCount || 0) + 1;
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume?.();
  const t0 = ctx.currentTime + 0.05;
  [0, 0.18, 0.36, 0.8, 0.98, 1.16].forEach((dt) => tone(ctx, 1046.5, t0 + dt, 0.14, 0.3, 'square'));
}

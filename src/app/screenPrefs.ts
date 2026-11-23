// 화면 배치 고르기 (P59 - 11-23 사용자 'ui 개선점(PC·휴대폰) - 선택할 수 있는 요소는 환경설정에서 직접 선택할 수 있게').
//   환경설정 '화면 배치' 탭이 고르는 칸·카드 모양. 기본값은 모두 지금(P59 전) 모습 그대로 - 바꾸고 싶은 사람만 고른다(PLAN 5장 'P59' ②).
//   계정 기기 칸(PC·휴대폰 따로 - app/prefs DEVICE_PREFS)과 맞추고, 여기 값은 이 기기 사본(열자마자 그리기용 - layoutPrefs와 같은 꼴).
//
//   휴대폰(손가락 화면)에서만 듣는 것 - 환경설정도 휴대폰에서만 보인다:
//     memoNavAt   메모 화면 라벨 칸 - 왼쪽 칸(기본) / 위 칩 줄 (좁은 화면에서 왼쪽 칸이 116px을 차지해 카드가 100px쯤이었다)
//     phoneCols   일정·메모 카드 열 - 2열(기본) / 1열 (하루 일정·메모 칸, 메모 화면)
//     orderArrows 카드 ▲▼ - 늘(기본) / 칸 머리 ⇅를 눌렀을 때만 (html data-order-arrows - index.css가 숨긴다)
//     cardTime    메모 카드 쓴 시각 - 보이기(기본) / 숨기기 (html data-card-time - index.css가 숨긴다)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MemoNavAt = 'side' | 'top';
export type PhoneCols = 1 | 2;
export type OrderArrowsMode = 'always' | 'toggle';

export interface ScreenPrefs {
  memoNavAt: MemoNavAt;
  phoneCols: PhoneCols;
  orderArrows: OrderArrowsMode;
  cardTime: boolean;
}

export const SCREEN_DEFAULTS: ScreenPrefs = { memoNavAt: 'side', phoneCols: 2, orderArrows: 'always', cardTime: true };
export const SCREEN_KEYS = Object.keys(SCREEN_DEFAULTS) as ReadonlyArray<keyof ScreenPrefs>;

export const useScreenPrefs = create<ScreenPrefs>()(persist((): ScreenPrefs => ({ ...SCREEN_DEFAULTS }), { name: 'sp5-screen' }));

export const setScreenPref = <K extends keyof ScreenPrefs>(key: K, value: ScreenPrefs[K]) => useScreenPrefs.setState({ [key]: value } as Partial<ScreenPrefs>);

/** CSS로 되는 것은 html 표시로 - 카드마다 값을 읽지 않는다(그리기를 늘리지 않게) */
function applyHtmlMarks(p: ScreenPrefs) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (p.orderArrows === 'toggle') html.dataset.orderArrows = 'toggle';
  else delete html.dataset.orderArrows;
  if (!p.cardTime) html.dataset.cardTime = 'off';
  else delete html.dataset.cardTime;
}
applyHtmlMarks(useScreenPrefs.getState());
useScreenPrefs.subscribe(applyHtmlMarks);

// 같은 기기의 다른 창(큰 창 ↔ 팝업창 - 창 위치 '팝업창'이면 환경설정도 팝업창)이 바꾼 값은 저장소 알림으로 받는다
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'sp5-screen') void useScreenPrefs.persist.rehydrate();
  });
}

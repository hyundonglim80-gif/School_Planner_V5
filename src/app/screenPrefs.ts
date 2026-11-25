// 화면 배치 고르기 (P59 - 11-23 사용자 'ui 개선점(PC·휴대폰) - 선택할 수 있는 요소는 환경설정에서 직접 선택할 수 있게').
//   환경설정 '화면 배치' 탭이 고르는 칸·카드 모양. 기본값은 모두 지금(P59 전) 모습 그대로 - 바꾸고 싶은 사람만 고른다(PLAN 5장 'P59' ②).
//   계정 기기 칸(PC·휴대폰 따로 - app/prefs DEVICE_PREFS)과 맞추고, 여기 값은 이 기기 사본(열자마자 그리기용 - layoutPrefs와 같은 꼴).
//
//   휴대폰(손가락 화면)에서만 듣는 것 - 환경설정도 휴대폰에서만 보인다:
//     memoNavAt   메모 화면 라벨 칸 - 왼쪽 칸(기본) / 위 칩 줄 (좁은 화면에서 왼쪽 칸이 116px을 차지해 카드가 100px쯤이었다)
//     (옛 phoneCols '카드 열 2열 / 1열'은 칸마다 고르는 '카드 열'(app/cardCols - 이 기기에만, PC에서도)로 바꿨다 - 11-25 메모 요청 #206)
//     orderArrows 카드 ▲▼ - 늘(기본) / 칸 머리 ⇅를 눌렀을 때만 (html data-order-arrows - index.css가 숨긴다)
//     cardTime    메모 카드 쓴 시각 - 보이기(기본) / 숨기기 (html data-card-time - index.css가 숨긴다)
//
//   PC·휴대폰 모두 (P59-2):
//     monthFit    월간 칸 높이 - 내용만큼(기본) / 화면에 맞추기 (1400×900에서 달력 아래 250px가 비었다)
//     weekLessons 주간 수업 - 교시마다 한 줄(기본) / 과목 칩 (휴대폰 주간 하루 칸의 절반이 수업이었다)
//     monthLessons 월간 수업 - 과목 칩(기본) / '수업 n' 한 칩 (휴대폰 월간 칸마다 칩 세 줄이 일정을 두세 글자로 밀어냈다)
//     머리줄 '수업' 단추는 그대로 모든 화면의 수업을 켜고 끈다 - 이 둘은 켠 때의 모양
//     headerToggles 머리줄 둘째 줄 주말·일정·수업 단추 - 보이기(기본) / 숨기기 (같은 값을 환경설정 화면 표시·단축키로 바꾼다 - 휴대폰 날짜 제목 자리)
//     buildId     화면 오른쪽 아래 빌드 번호 - 보이기(기본) / 숨기기 (주간 일요일 칸 + 단추와 겹쳐 보였다 · 환경설정 앱 탭에는 늘 있다)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MemoNavAt = 'side' | 'top';
export type OrderArrowsMode = 'always' | 'toggle';
export type WeekLessons = 'rows' | 'chips';
export type MonthLessons = 'chips' | 'count';

export interface ScreenPrefs {
  memoNavAt: MemoNavAt;
  orderArrows: OrderArrowsMode;
  cardTime: boolean;
  monthFit: boolean;
  weekLessons: WeekLessons;
  monthLessons: MonthLessons;
  headerToggles: boolean;
  buildId: boolean;
}

export const SCREEN_DEFAULTS: ScreenPrefs = { memoNavAt: 'side', orderArrows: 'always', cardTime: true, monthFit: false, weekLessons: 'rows', monthLessons: 'chips', headerToggles: true, buildId: true };
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

// 카드 열 고르기 (11-25 메모 요청 #206 '카드형일 때 표시 단을 선택할 수 있게 - 1~5단, 기기마다 설정 값 저장').
//   환경설정 '화면 배치' 탭 '카드 열'에서 칸마다 고른다 - 하루 수업 칸 · 하루 일정 칸 · 하루 메모 칸 · 메모 화면(카드로 볼 때 - 목록은 늘 한 줄에 하나).
//   자동(기본) = 고르기 전 모습: 휴대폰은 수업·일정·메모 2열, PC는 수업·일정 1열·메모는 칸 폭에 따라 2~4열.
//   이 기기에만 둔다(계정에 올리지 않는다): 알맞은 열 수는 그 기기 화면 폭을 따른다 - 큰 모니터 PC와 노트북이 다르다(카드/목록 보기·오른쪽 칸 폭과 같다).
//   옛 '휴대폰 카드 열 2열 / 1열'(P59-1 phoneCols - 계정 기기 칸)은 이것으로 바꿨다: 그 휴대폰에서 1열을 골라 두었으면 처음 한 번 네 칸 모두 1열로 옮긴다.
//   한눈에 화면의 하루 칸(수업·일정·메모)도 같은 값을 쓴다(같은 부품).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CARD_COLS_DEFAULTS, type CardCols, type CardColsKey, type CardColsPrefs } from '../domain/cardCols';
import { detectDeviceKind } from './deviceKind';

const KEY = 'sp5-card-cols';

export const useCardCols = create<CardColsPrefs>()(persist((): CardColsPrefs => ({ ...CARD_COLS_DEFAULTS }), { name: KEY }));

export const setCardCols = (key: CardColsKey, value: CardCols) => useCardCols.setState({ [key]: value } as Partial<CardColsPrefs>);

/** 그리드 열 - Tailwind가 글을 읽어 만들므로 이름을 통째로 적어 둔다 */
export const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' };

/** 옛 휴대폰 '카드 열 1열'(P59-1) - 이 기기 사본(sp5-screen)에 남은 값 */
function legacyPhoneOneColumn(): boolean {
  try {
    if (localStorage.getItem(KEY) !== null) return false;
    const old = (JSON.parse(localStorage.getItem('sp5-screen') || 'null') as { state?: { phoneCols?: unknown } } | null)?.state?.phoneCols;
    return old === 1 && detectDeviceKind() === 'mobile';
  } catch {
    return false;
  }
}
if (typeof window !== 'undefined') {
  if (legacyPhoneOneColumn()) useCardCols.setState({ lessonCols: 1, eventCols: 1, journalCols: 1, memoCols: 1 });
  // 같은 기기의 다른 창(↗ 새 창·팝업창 환경설정)이 바꾼 값은 저장소 알림으로 받는다
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) void useCardCols.persist.rehydrate();
  });
}

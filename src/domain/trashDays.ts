// 휴지통 자동 비우기 기간 (P41-1). 계정 설정 `trashDays` = 고른 날 수(0 = 끄기), 칸이 없으면 '고르지 않음'(TRASH_DAYS_UNSET).
// 고르지 않은 계정은 기본 90일 - 다만 TRASH_DEFAULT_FROM부터(그 전에는 예전처럼 꺼짐). 기본이 바뀌는 것을 휴지통 창이 미리 알린다.
// 예전(V4·V5 11-17까지)에는 기본이 끄기였다 - 지운 항목이 끝없이 쌓여 새 기기 첫 받기·기기 사본에 모두 들었다(PLAN 5장 'P41 추천 셋' ①).

/** 고르지 않음 (계정 문서에 칸이 없다) */
export const TRASH_DAYS_UNSET = -1;
/** 고르지 않은 계정의 기간 */
export const TRASH_DEFAULT_DAYS = 90;
/** 이날부터 기본 기간이 선다 - 그 전에는 고르지 않은 계정의 휴지통을 지우지 않는다 */
export const TRASH_DEFAULT_FROM = '2026-12-01';

/** 지금 지키는 기간 (0 = 끄기). today = 'YYYY-MM-DD' */
export function effectiveTrashDays(value: number, today: string): number {
  if (value !== TRASH_DAYS_UNSET) return value > 0 ? value : 0;
  return today >= TRASH_DEFAULT_FROM ? TRASH_DEFAULT_DAYS : 0;
}

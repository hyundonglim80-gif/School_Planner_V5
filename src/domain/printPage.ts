// 인쇄 창이 처음 고르는 쪽 (P49-3 - domain/printPages에서 나눔: 껍데기의 Ctrl+P·⋮ '이 화면 인쇄'가 늘 부르는 작은 셈만 - 쪽 셈 전체는 인쇄 창을 열 때 받는다).

export type PrintPage = 'day' | 'week' | 'month' | 'year';

/** 보는 화면 → 처음 고른 쪽 (메모·학급 화면은 하루, 한눈에는 그 주 - 화면 꼴이 종이에 맞지 않는다, P24) */
export function printPageOfScope(scope: string): PrintPage {
  if (scope === 'board') return 'week';
  return scope === 'week' || scope === 'month' || scope === 'year' ? scope : 'day';
}

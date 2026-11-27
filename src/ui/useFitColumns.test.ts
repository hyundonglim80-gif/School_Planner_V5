import { describe, expect, it } from 'vitest';
import { MIN_PICKED_CARD_PX, MIN_PICKED_NOTE_PX, cappedColumns, fitColumns } from './useFitColumns';

describe('고른 카드 열을 칸 폭에 맞추기 (P61)', () => {
  it('한눈에 하루 일정 칸(약 230px)에 5열을 골라도 두 열만', () => {
    expect(cappedColumns(5, fitColumns(230, 12))).toBe(2);
  });

  it('휴대폰 360 하루 칸(안쪽 약 320px) 세 열은 그대로', () => {
    expect(cappedColumns(3, fitColumns(320, 12))).toBe(3);
  });

  it('넓은 칸은 고른 수 그대로, 자동(0)은 0 그대로', () => {
    expect(cappedColumns(5, fitColumns(1080, 16))).toBe(5);
    expect(cappedColumns(0, 1)).toBe(0);
  });

  it('아주 좁아도 한 열은 남는다 · 재기 전(Infinity)은 줄이지 않는다', () => {
    expect(fitColumns(40, 12)).toBe(1);
    expect(cappedColumns(4, Infinity)).toBe(4);
  });

  it('메모 카드는 더 넓게 재되 자동 열 수보다 적게는 줄이지 않는다', () => {
    expect(cappedColumns(5, fitColumns(560, 16, MIN_PICKED_NOTE_PX))).toBe(3); // 한눈에 메모 칸 약 560px
    expect(cappedColumns(5, fitColumns(560, 16, MIN_PICKED_NOTE_PX), 4)).toBe(4); // 자동이 네 열이면 네 열
    expect(cappedColumns(3, fitColumns(227, 16, MIN_PICKED_NOTE_PX), 2)).toBe(2); // 휴대폰 360 메모 화면(목록 227px) - 65px 카드 세 열 대신 두 열
  });

  it('카드가 최소 폭보다 좁아지는 순간 한 열 준다', () => {
    const w = 3 * MIN_PICKED_CARD_PX + 2 * 12; // 세 열이 꼭 맞는 폭
    expect(fitColumns(w, 12)).toBe(3);
    expect(fitColumns(w - 1, 12)).toBe(2);
  });
});

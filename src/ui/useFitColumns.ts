// 고른 카드 열이 칸 폭에 드나 (P61 11-27 - 전반 점검 #206 남은 일).
//   환경설정 '카드 열'(app/cardCols - 칸마다 1~5열)은 고른 수를 그대로 그렸다. 그런데 같은 값을 쓰는 한눈에 화면의 하루 칸은
//   일정 칸이 230px 남짓이라 5열이면 카드 하나가 38px - 글이 한 글자씩 세로로 섰고 알림 시각 칩이 카드 밖으로 26px 나갔다.
//   → 고른 수라도 카드가 MIN_PICKED_CARD_PX보다 좁아지면 칸 폭에 드는 만큼만. 자동(0)은 이것을 쓰지 않는다(칸마다 제 셈).
import { useEffect, useState } from 'react';

/** 고른 열이라도 카드가 이보다 좁아지면 열을 줄인다 - 휴대폰 360 세 열(카드 약 100px)은 그대로 된다 */
export const MIN_PICKED_CARD_PX = 96;
/** 메모 카드는 머리줄(☆·라벨 칩·날짜·☑ n/m)이 있어 더 넓게 - 하루 메모 칸·메모 화면 */
export const MIN_PICKED_NOTE_PX = 140;

/** 안쪽 폭 width에 min px 카드가 gap px 사이를 두고 몇 열 드는가 (적어도 한 열) */
export function fitColumns(width: number, gap: number, min = MIN_PICKED_CARD_PX): number {
  return Math.max(1, Math.floor((width + gap) / (min + gap)));
}

/** 고른 열 수를 칸 폭에 맞춘 값 - 고르지 않았으면(0) 0 그대로. floor = 자동일 때의 열 수(그보다 적게는 줄이지 않는다 - 휴대폰 메모 두 열) */
export const cappedColumns = <T extends number>(picked: T, fit: number, floor = 1): T => (picked > 0 ? (Math.min(picked, Math.max(fit, floor)) as T) : picked);

/**
 * 붙인 칸의 안쪽 폭에 드는 열 수. [ref 함수, 열 수] - 재기 전·ResizeObserver가 없으면 Infinity(줄이지 않는다).
 * enabled가 거짓이면 재지 않는다(카드 열 '자동'이면 다시 그리기를 늘리지 않게). 칸이 나중에 생겨도(접었다 펴기) ref 함수라 다시 붙는다.
 */
export function useFitColumns(gap: number, enabled = true, min = MIN_PICKED_CARD_PX): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState(Infinity);
  useEffect(() => {
    if (!enabled || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setFit(fitColumns(w, gap, min));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, enabled, gap, min]);
  return [setEl, enabled ? fit : Infinity];
}

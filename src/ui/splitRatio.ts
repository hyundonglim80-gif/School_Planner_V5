// 경계선(ui/SplitPane)의 셈 - 컴포넌트 파일과 나눈다(빠른 새로고침은 컴포넌트만 내보내는 파일에서만 된다).

/** 경계선 두께(px) - 잡을 자리. 가운데 가는 줄만 보인다 */
export const SPLIT_HANDLE_PX = 8;

export const MIN_RATIO = 5;
export const MAX_RATIO = 95;

/** 위치(px, 앞 칸 쪽 끝에서) → 비율. 칸마다 최소 크기를 지키고, 둘 다 지킬 수 없으면 null(그대로 둔다) */
export function ratioAt(pos: number, size: number, minFirst: number, minSecond: number): number | null {
  const lo = minFirst;
  const hi = size - minSecond - SPLIT_HANDLE_PX / 2;
  if (size <= 0 || hi < lo) return null;
  const px = Math.max(lo, Math.min(hi, pos));
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, (px / size) * 100));
}

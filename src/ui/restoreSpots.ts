// 자라는 글 칸(AutoTextarea)이 높이를 잰 뒤 둘레 스크롤 되돌리기 (P44-1).
/**
 * 잰 뒤 둘레 스크롤을 되돌린다 - **위로 당겨진 것만**. 'auto'로 줄인 순간 브라우저가 둘레를 위로 당긴 것(P10-5 5f)은 되돌리고,
 * 글 칸이 늘어 브라우저가 보던 것을 지키려 아래로 옮겨 준 것(스크롤 고정)은 그대로 둔다 - 그것까지 되돌려 긴 메모를 열자마자
 * 맨 아래로 내려 둔 Claude 대화를 글 맨 위로 끌어올렸다(P44-1 11-17 CI - 크롬에서 2020 → 256, 높이가 그대로인 판에서는 따라가기가 되돌리지 못했다).
 */
export function restoreSpots(spots: ReadonlyArray<readonly [{ scrollTop: number }, number]>) {
  for (const [n, top] of spots) if (n.scrollTop < top) n.scrollTop = top;
}

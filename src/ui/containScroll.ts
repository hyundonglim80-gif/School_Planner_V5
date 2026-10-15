// 옆 칸(오른쪽 줄·왼쪽 클립보드 칸) 위의 휠·손가락 밀기는 그 칸 안에서만 (P10-5 사용자 의견 6e).
//
// `overscroll-contain`은 칸에 스크롤할 것이 있을 때만 막는다 - 내용이 짧거나 끝에 닿으면 휠이 뒤 화면(창 스크롤)을 움직였다.
// 그래서 휠이 닿은 자리부터 칸까지 올라가며 그 방향으로 더 스크롤할 상자가 있는지 보고, 없으면 막는다.
// 가운데 창은 그대로(뒤 화면 스크롤을 잠근다 - useBodyScrollLock).

const SCROLLS = /(auto|scroll|overlay)/;

/** 이 상자가 dy 쪽(위 -, 아래 +)으로 더 스크롤할 수 있나 */
export function canScrollY(el: Element, dy: number): boolean {
  if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight + 1) return false;
  if (!SCROLLS.test(getComputedStyle(el).overflowY)) return false;
  return dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

/** target에서 box까지 dy 쪽으로 스크롤할 상자가 하나라도 있나 */
export function scrollsWithin(target: EventTarget | null, box: Element, dy: number): boolean {
  for (let n = target instanceof Element ? target : null; n; n = n.parentElement) {
    if (canScrollY(n, dy)) return true;
    if (n === box) break;
  }
  return false;
}

/** box 위의 세로 휠·손가락 밀기가 바깥(뒤 화면)으로 넘어가지 않게. 떼는 함수를 돌려준다 */
export function containScroll(box: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    // Ctrl + 휠은 확대·축소, 가로 휠은 그대로
    if (e.ctrlKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (!scrollsWithin(e.target, box, e.deltaY)) e.preventDefault();
  };
  let last: { x: number; y: number } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    last = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!last || e.touches.length !== 1) return;
    const { clientX: x, clientY: y } = e.touches[0];
    const dx = last.x - x;
    const dy = last.y - y;
    last = { x, y };
    // 가로로 미는 것(표 넘기기)은 그대로
    if (dy === 0 || Math.abs(dx) > Math.abs(dy)) return;
    if (!scrollsWithin(e.target, box, dy) && e.cancelable) e.preventDefault();
  };
  box.addEventListener('wheel', onWheel, { passive: false });
  box.addEventListener('touchstart', onTouchStart, { passive: true });
  box.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => {
    box.removeEventListener('wheel', onWheel);
    box.removeEventListener('touchstart', onTouchStart);
    box.removeEventListener('touchmove', onTouchMove);
  };
}

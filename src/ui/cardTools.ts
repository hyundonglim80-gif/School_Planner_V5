// 카드 위에 떠 있는 단추 묶음 (P41-2) - 수업·일정·메모 카드가 함께 쓴다.
//   - 마우스를 카드에 올리거나 키보드 초점이 그 단추에 들 때만 보이고, 숨어 있는 동안 **자리를 차지하지 않는다**(카드 오른쪽 위에 뜬다).
//     예전에는 안 보이는 단추가 자리를 차지해 좁은 칸(한눈에 오른쪽 하루 칸 277px)에서 수업 카드 첫 줄의 절반이 빈칸이었다(11-17 PC 확인).
//   - 바탕을 깔아 그 밑 글을 덮는다(올린 동안만).
//   - 휴대폰(sm 아래)에는 없다 - 마우스가 없으니 카드를 눌러 연 수정 칸에서 같은 단추를 누른다. 숫자·요약이 적힌 단추(📊 2·출결 요약·📑 n)는 이 묶음에 넣지 않고 카드에 늘 둔다.
//   - 숨어도 DOM에 있다(opacity) - 단추 대신 누르기 단축키가 `data-*`로 찾아 누르고(CLAUDE.md 3장), Tab 차례도 그대로다.
/**
 * 카드 왼쪽 ▲▼ 순서 단추 묶음 (P53-1): 마우스 화면(pointer: fine)에서는 카드에 올렸을 때·키보드 초점이 들 때만 보인다 - 카드마다 늘 보이던 ▲▼가
 * 글보다 먼저 눈에 걸렸다. 자리는 그대로 차지한다(나타나도 글이 밀리지 않게). 끌어 놓기가 함께 있다(ui/reorderDrag). 휴대폰은 늘 보인다(끌기가 없다).
 */
export const ORDER_ARROWS = 'transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:has-[:focus-visible]:opacity-100';

/**
 * 메모 카드의 쓴 시각·날짜 (P54-4 - 사용자가 고름 '올렸을 때만'): 마우스 화면에서는 카드에 올렸을 때·카드에 초점이 들 때만 보인다.
 * 자리는 그대로(나타나도 칩이 밀리지 않게) · 휴대폰은 늘 보인다(올릴 마우스가 없다) · 숨어도 DOM에 있다(점검·검색이 읽는다).
 */
export const HOVER_ONLY = 'transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100';

export const FLOAT_TOOLS =
  'hidden sm:flex items-center gap-0.5 absolute top-1 right-1 z-10 px-0.5 rounded-lg border border-slate-200 bg-white/95 shadow-xs opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100';

// 카드 위에 떠 있는 단추 묶음 (P41-2) - 수업·일정·메모 카드가 함께 쓴다.
//   - 마우스를 카드에 올리거나 키보드 초점이 그 단추에 들 때만 보이고, 숨어 있는 동안 **자리를 차지하지 않는다**(카드 오른쪽 위에 뜬다 - 일정·메모 카드는 위 테두리에 걸쳐, P57-3).
//     예전에는 안 보이는 단추가 자리를 차지해 좁은 칸(한눈에 오른쪽 하루 칸 277px)에서 수업 카드 첫 줄의 절반이 빈칸이었다(11-17 PC 확인).
//   - 바탕을 깔아 그 밑 글을 덮는다(올린 동안만).
//   - 휴대폰(sm 아래)에는 없다 - 마우스가 없으니 카드를 눌러 연 수정 칸에서 같은 단추를 누른다. 숫자·요약이 적힌 단추(📊 2·출결 요약·📑 n)는 이 묶음에 넣지 않고 카드에 늘 둔다.
//   - 숨어도 DOM에 있다(opacity) - 단추 대신 누르기 단축키가 `data-*`로 찾아 누르고(CLAUDE.md 3장), Tab 차례도 그대로다.
/**
 * 카드 왼쪽 ▲▼ 순서 단추 묶음 (P53-1): 마우스 화면(pointer: fine)에서는 카드에 올렸을 때·키보드 초점이 들 때만 보인다 - 카드마다 늘 보이던 ▲▼가
 * 글보다 먼저 눈에 걸렸다. 자리는 그대로 차지한다(나타나도 글이 밀리지 않게). 끌어 놓기가 함께 있다(ui/reorderDrag). 휴대폰은 늘 보인다(끌기가 없다).
 */
export const ORDER_ARROWS = 'order-arrows transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:has-[:focus-visible]:opacity-100';

/**
 * 메모 카드의 쓴 시각·날짜 (P54-4 - 사용자가 고름 '올렸을 때만'): 마우스 화면에서는 카드에 올렸을 때·카드에 초점이 들 때만 보인다.
 * 자리는 그대로(나타나도 칩이 밀리지 않게) · 휴대폰은 늘 보인다(올릴 마우스가 없다) · 숨어도 DOM에 있다(점검·검색이 읽는다).
 */
export const HOVER_ONLY = 'transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100';

/**
 * 카드 왼쪽 테두리에 걸친 ▲▼ 손잡이의 바탕 (P58-1 사용자 '마우스를 올릴 때 나오는 칩·단추가 미리 자리를 차지하지 않게 - 그 위에 불투명한 바탕으로'):
 * 마우스 화면에서는 카드 왼쪽 테두리에 걸쳐 뜨는 작은 손잡이(불투명 바탕) - 자리를 차지하지 않고 글도 덮지 않는다(카드 안으로는 8px - 카드 왼쪽 여백 안까지만).
 * 카드가 relative여야 하고(가장 가까운 relative가 카드여야 한다 - 그 사이에 relative가 있으면 그것에 붙는다), 카드 밖으로 12px 나가므로
 * 둘레 칸이 자르면(스크롤 칸) 그만큼 왼쪽 여백이 있어야 한다. 휴대폰은 ORDER_ARROWS 그대로(글 앞 칸·늘 보인다). 세로 자리는 아래 둘이 정한다.
 */
const ORDER_ARROWS_EDGE_BASE = `${ORDER_ARROWS} pointer-fine:absolute pointer-fine:-translate-y-1/2 pointer-fine:-left-3 pointer-fine:z-10 pointer-fine:w-5 pointer-fine:px-0 pointer-fine:py-0.5 pointer-fine:gap-0 pointer-fine:rounded-lg pointer-fine:border pointer-fine:border-slate-200 pointer-fine:bg-white pointer-fine:shadow-xs`;

/** 수업 카드 ▲▼ (P58-1): 카드 왼쪽 테두리 가운데 (둘레 칸 = 하루 수업 칸 p-5) */
export const ORDER_ARROWS_EDGE = `${ORDER_ARROWS_EDGE_BASE} pointer-fine:top-1/2`;

/**
 * 메모 카드 ▲▼ (메모 요청 #202 '메모의 순서 변경 칩도 수업과 같이 항목의 왼쪽 테두리 위에서'): 수업 카드와 같은 손잡이를 **머리줄 높이**에 -
 * 메모 카드는 펼치면 길어(28rem, 그날 메모 창은 끝까지) 가운데에 두면 손잡이가 머리줄(▼ 접기·☆)에서 멀리, 창에서는 화면 밖으로 간다.
 * 가운데가 첫 줄 가운데(1.75rem = 위 여백 16px + 첫 줄 반)쯤, 아주 짧은 카드는 카드 가운데(min). 일정 카드는 아직 ORDER_ARROWS(자리 그대로).
 */
export const ORDER_ARROWS_EDGE_HEAD = `${ORDER_ARROWS_EDGE_BASE} pointer-fine:top-[min(50%,1.75rem)]`;

// 떠 있는 묶음의 바탕은 불투명(P58-1 - 덮은 글이 비치지 않게. 어두운 화면의 bg-white는 카드 바탕색)
const FLOAT_BASE =
  'hidden sm:flex items-center gap-0.5 absolute z-10 px-0.5 rounded-lg border border-slate-200 bg-white shadow-xs opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100';

/**
 * 일정·메모 카드의 떠 있는 묶음 (P57-3): 카드 **위 테두리에 걸쳐** 오른쪽에 뜬다(수업 카드 ▲▼가 왼쪽 테두리에 걸친 것과 같은 꼴 - P58-1).
 * 안쪽으로는 카드 위 여백(일정 12px·메모 16px)까지만 든다 - 예전 '오른쪽 위 4px'는 좁은 카드에서 첫 줄 라벨 칩(누르면 완료)을 7~30px 덮었다
 * (긴 라벨·두 줄 칩·글자 150%). 묶음 가운데가 테두리 위(-12px - 묶음 높이 23px). 바깥 12px는 카드 사이 틈(8px)과 위 카드의 아래 여백에 든다 -
 * 카드를 담는 스크롤 칸은 위 여백이 12px 넘어야 첫 카드 묶음이 잘리지 않는다(DayEvents).
 */
export const FLOAT_TOOLS = `${FLOAT_BASE} -top-3 right-2`;

/**
 * 수업 카드의 떠 있는 묶음 (P58-1): 카드 첫 줄(relative)의 가운데에 맞춰 그 줄을 깨끗이 덮는다 - 카드 위 4px에 붙이면 첫 줄 글의 아래 절반이
 * 묶음 밑으로 비어져 나왔다(사용자 '불투명한 배경 위에').
 */
export const FLOAT_TOOLS_ROW = `${FLOAT_BASE} top-1/2 -translate-y-1/2 -right-1`;

/**
 * 진도 줄 끝에 겹쳐 뜨는 단추 묶음 (P58-1 - 🔗 이 차시에 메모 잇기 · 이 교시 밀기): PC에서는 올렸을 때만, 흐름 밖(자리 없음) · 불투명 바탕.
 * 부르는 쪽은 줄 끝 묶음(relative - 늘 보이는 🔗 n이 든다)에 넣는다 - 그 왼쪽(right-full)에 떠서 🔗 n을 덮지 않는다.
 * 🔗 n이 없으면 그 묶음 폭이 0이라 w-max가 없으면 글이 묶음 밖으로 넘친다(11-23 그림 - '이 교시 밀기'가 칸 밖으로).
 * 오른쪽 끝은 부르는 쪽이 정한다(🔗 n이 있으면 sm:mr-1 - 덮지 않게, 없으면 sm:-mr-1 - 수업 카드 위 묶음과 끝을 맞춘다).
 * 휴대폰은 흐름 안에 늘 보인다(올릴 마우스가 없다).
 */
export const FLOAT_LINE =
  'flex items-center gap-2 sm:absolute sm:right-full sm:w-max sm:-top-1 sm:z-10 sm:gap-0.5 sm:p-0.5 sm:rounded-lg sm:border sm:border-slate-200 sm:bg-white sm:shadow-xs sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:has-[:focus-visible]:opacity-100';

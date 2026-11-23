// 조사표 학생 표·모아 보기 표의 둘레 (11-23 사용자 요청 '학생 명단을 표 안에서 스크롤하지 않고, 넘치면 창(오른쪽 칸·팝업창) 전체를 스크롤')
//   예전에는 표 상자가 화면 60~65% 높이에서 잘려 표 안에서 스크롤했다 - 이제 표는 늘 다 그리고, 창 본문(ModalShell)이 세로·가로 모두 스크롤한다.
//   overflow-clip = 둥근 모서리만 자르고 스크롤 상자가 되지 않는다(hidden·auto면 머리 줄 sticky가 표 상자에 붙어 창을 내려도 함께 올라간다).
//   min-w-min = 표가 칸보다 넓으면 상자째 넓어져 잘리지 않고 창이 옆으로 스크롤한다.
export const EVAL_TABLE_BOX = 'border border-slate-200 rounded-xl overflow-clip min-w-min';

// 머리 줄·번호·이름 칸 고정 - 크롬은 sticky를 스크롤 상자의 여백 안쪽에 붙인다: ModalShell 본문 여백(px-5 py-4)만큼 바깥으로 당겨야
//   창 가장자리에 틈 없이 붙는다(틈이면 지나가는 학생 줄이 머리 줄 위로 비친다). ModalShell 본문 여백을 바꾸면 여기도 - inspect-evaluations가 견준다.
export const EVAL_STICKY_HEAD = 'sticky -top-4';
/** 첫 칸(번호·반) */
export const EVAL_STICKY_COL1 = 'sticky -left-5';
/** 둘째 칸(이름) - 첫 칸 폭 w-10 뒤: 2.5rem − 1.25rem */
export const EVAL_STICKY_COL2 = 'sticky left-5';

// 한눈에 화면 (P24 - 사용자 손 그림 11-06). 왼쪽 = 작은 달력 + 한 주 요일 칸(P24-2), 오른쪽 = 고른 날의 수업·일정·메모(하루 화면 칸 그대로).
// 고른 날 = 둘째 줄 날짜(app/nav), ◀▶ = 한 주. P24-3 전에는 주소 #/board/날짜로만 열린다(화면 탭·탭바·단축키에 없다).
import { useNav } from '../../app/nav';

export default function BoardScreen() {
  const date = useNav((s) => s.date);
  return <div data-screen="board" data-board-date={date} className="animate-fade-in pb-12" />;
}

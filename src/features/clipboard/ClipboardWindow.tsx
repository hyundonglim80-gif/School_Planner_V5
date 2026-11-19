// 📋 클립보드 탭 (P47-1 11-19 사용자 요청 '클립보드 통합' - 옛 왼쪽 클립보드 칸을 창 칸의 탭 하나로).
//   - 다른 창과 같은 줄·같은 폭·같은 탭 ×·ESC(오른쪽 줄 모두 닫기). 휴대폰은 다른 창처럼 위에 덮고 뒤로가기로 닫는다.
//   - 여닫기는 창 칸 쪽 가장자리의 📋 단추·단축키 '클립보드 칸 열기 / 닫기'(./capture toggleClipboard) - 열린 채 새로고침하면 다시 선다.
//   - 항목을 누르면 마지막으로 글을 쓰던 칸에 붙이고, 그 칸이 다른 탭에 있으면 그 탭을 보인다(./paste).
//   - 창 위치가 팝업창(PC)이면 창 목록이 이 창 대신 클립보드 팝업창(같은 id - ClipboardPopout)을 띄운다.
import type { WindowProps } from '../../app/windows';
import ModalShell from '../../ui/ModalShell';
import ClipboardList from './ClipboardList';
import { pasteClip } from './paste';

export default function ClipboardWindow({ close, raise }: WindowProps) {
  return (
    <ModalShell isOpen onClose={close} raise={raise} title="📋 클립보드" bare>
      <ClipboardList pasteWith={pasteClip} hint="누르면 글을 쓰던 칸에 붙여넣습니다. 이 기기에만 남습니다." />
    </ModalShell>
  );
}

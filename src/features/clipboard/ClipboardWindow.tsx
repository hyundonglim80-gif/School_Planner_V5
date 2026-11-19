// 📋 클립보드 탭 (P47-1 11-19 사용자 - 왼쪽 클립보드 칸을 없애고 창 칸의 탭 하나로, 물어 고름 '클립보드 = 창 칸의 탭 하나').
//   다른 창과 같은 줄·같은 폭·같은 ×(창 틀 ModalShell). 목록 칸은 클립보드 팝업창과 함께 쓰는 ClipboardPanel.
//   서 있는 동안 '열림'을 이 기기에 적어 두어(capture useClipboardPanel) 다시 열면 탭이 다시 선다(ClipboardColumn).
import { useEffect } from 'react';
import type { WindowProps } from '../../app/windows';
import ModalShell from '../../ui/ModalShell';
import { setClipboardOpen } from './capture';
import { ClipboardPanel } from './ClipboardColumn';
import { pasteClipShowingTarget } from './paste';

export default function ClipboardWindow({ close, raise }: WindowProps) {
  useEffect(() => {
    setClipboardOpen(true);
    return () => {
      setClipboardOpen(false);
    };
  }, []);

  return (
    <ModalShell isOpen onClose={close} raise={raise} title="📋 클립보드" bare>
      <ClipboardPanel titled={false} onClose={close} pasteWith={pasteClipShowingTarget} hint="누르면 글을 쓰던 칸에 붙여넣습니다. 이 기기에만 남습니다." />
    </ModalShell>
  );
}

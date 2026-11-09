// 클립보드 팝업창 (#140 - 창 위치 '팝업창'에서 왼쪽 📋를 누르면 - popupClip). 같은 앱을 ?popout={"id":"clipboard"}로 띄워 목록 칸만 창 가득 그린다.
//   - 목록·가져오기·모두 지우기·✕(휴지통)는 왼쪽 칸과 같다(ClipboardPanel). 다른 창에서 복사한 것도 곧바로 보인다(이 기기 저장소를 함께 쓴다).
//   - 항목을 누르면 마지막으로 글을 쓰던 창(큰 창·메모 팝업창)의 커서 자리에 붙는다. 그 창을 닫았으면 클립보드에 담는다(Ctrl+V).
//   - ✕·ESC = 이 팝업창 닫기. 자리·크기는 이 기기에 남겨 다음에 그 자리에 연다.
import { useEffect } from 'react';
import { rememberPopupRect } from '../../app/popupWindows';
import { CLIPBOARD_POPOUT_ID } from '../../ui/popout';
import { useClipboardCapture } from './capture';
import { ClipboardPanel } from './ClipboardColumn';
import { pasteFromPopup } from './popupClip';

const closeWindow = () => window.close();

export default function ClipboardPopout() {
  // 복사한 것 모으기 · 다른 창과 주고받기 · 시스템 클립보드를 잠깐마다 보기
  useClipboardCapture('clipboard');
  useEffect(() => rememberPopupRect(CLIPBOARD_POPOUT_ID), []);
  useEffect(() => {
    document.title = '📋 클립보드 - SP5';
    // 칸 밖(빈 곳)을 눌러 초점이 바깥에 있어도 ESC = 닫기
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeWindow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-popout={CLIPBOARD_POPOUT_ID} className="h-screen bg-bg-body text-slate-900">
      <ClipboardPanel
        onClose={closeWindow}
        pasteWith={pasteFromPopup}
        hint="누르면 마지막으로 글을 쓰던 창의 커서 자리에 붙여넣습니다(그 창을 닫았으면 클립보드에 담아 Ctrl+V). 이 기기에만 남습니다."
      />
    </div>
  );
}

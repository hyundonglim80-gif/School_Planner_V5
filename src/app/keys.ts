// 껍데기의 키 처리 한 곳 (V4 Layout handleKeyDown). ■3에서 단축키(SHORTCUT_ACTIONS)를 여기에 더한다.
//   ESC    : 오른쪽 줄 전체(창·쓰는 칸)를 닫는다 - 저장 안 한 글이 있으면 먼저 묻는다.
//   Ctrl+S : 브라우저 '다른 이름으로 저장'을 막는다. 저장은 커서가 든 칸·창이 받는다(ui/useSaveKey).
import { useEffect } from 'react';
import { isSaveKey } from '../ui/useSaveKey';
import { closeAllWindows } from './windows';

export function useAppKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isSaveKey(e)) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        closeAllWindows();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

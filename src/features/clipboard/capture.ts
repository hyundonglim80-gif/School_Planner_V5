// 클립보드 칸의 열림·폭과 '복사한 것 모으기' (V4 components/ClipboardPanel.tsx의 useClipboardCapture). Shell이 늘 부른다.
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setShortcutAction } from '../../app/keys';
import { addCopiedText, loadClipboard, readSystemClipboard } from '../../data/clipboard';
import { useSession } from '../../data/session';
import { rememberEditable, selectedTextForCopy } from './paste';

/** 왼쪽 칸의 기본 폭 */
export const LEFT_COLUMN_WIDTH = 'clamp(260px, 24vw, 380px)';
/** 경계선을 끌어 바꾼 폭(--left-column-w)이 있으면 그것. 오른쪽 화면이 320px은 남게 묶는다. */
export const LEFT_COLUMN_CSS_WIDTH = `min(var(--left-column-w, ${LEFT_COLUMN_WIDTH}), calc(100vw - 320px))`;

/** 칸이 열려 있는 동안 시스템 클립보드를 다시 보는 간격 (읽기를 허락해 둔 경우만) */
const POLL_MS = 2000;

/** 칸이 열려 있나 (이 기기에 기억 - 넓은 화면에서 열어 둔 채 다시 열면 그대로) */
export const useClipboardPanel = create<{ open: boolean }>()(persist((): { open: boolean } => ({ open: false }), { name: 'sp5-clipboard-open' }));
export const setClipboardOpen = (open: boolean) => useClipboardPanel.setState({ open });
export const toggleClipboard = () => setClipboardOpen(!useClipboardPanel.getState().open);

/** 복사한 것을 모은다. 칸이 닫혀 있어도 모은다 (Shell이 늘 부른다). */
export function useClipboardCapture() {
  const uid = useSession((s) => s.user?.uid ?? null);
  const open = useClipboardPanel((s) => s.open);

  useEffect(() => {
    if (uid) void loadClipboard(uid);
  }, [uid]);

  useEffect(() => {
    const onCopy = () => {
      const text = selectedTextForCopy();
      if (text) void addCopiedText(text);
    };
    const onFocusIn = (e: FocusEvent) => rememberEditable(e.target as Element);
    // 다른 프로그램에서 복사·캡처하고 돌아왔을 때 (읽기를 허락해 둔 경우만)
    const onReturn = () => {
      if (document.visibilityState === 'visible') void readSystemClipboard(false);
    };
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('cut', onCopy, true);
    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    const offKey = setShortcutAction('clipboard', toggleClipboard);
    return () => {
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('cut', onCopy, true);
      document.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
      offKey();
    };
  }, []);

  // 칸이 열려 있는 동안은 가끔 다시 본다 - copy 이벤트 없이 클립보드에 쓰는 앱의 '복사' 단추도 잡힌다
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void readSystemClipboard(false), POLL_MS);
    return () => clearInterval(t);
  }, [open]);
}

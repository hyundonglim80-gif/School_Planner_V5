// 📋 클립보드 탭의 열림과 '복사한 것 모으기' (V4 components/ClipboardPanel.tsx의 useClipboardCapture). Shell이 늘 부른다. P47-1 - 왼쪽 칸 → 창 칸의 탭.
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setShortcutAction } from '../../app/keys';
import { closeWindow, openWindow, shownWindowNow, useWindows } from '../../app/windows';
import { addCopiedText, loadClipboard, readSystemClipboard } from '../../data/clipboard';
import { useSession } from '../../data/session';
import { rememberEditable, selectedTextForCopy } from './paste';
import { markEditorWindow, openClipboardPopup, useClipboardBridge } from './popupClip';

/** 클립보드 탭의 창 id (= 단축키 id 'clipboard' - 단축키는 아래 toggleClipboard가 받는다) */
export const CLIPBOARD_WINDOW = 'clipboard';

/** 탭이 열려 있는 동안 시스템 클립보드를 다시 보는 간격 (읽기를 허락해 둔 경우만) */
const POLL_MS = 2000;

/** 클립보드 탭이 서 있나 (이 기기에 기억 - 넓은 화면에서 열어 둔 채 다시 열면 그대로 선다). 탭(ClipboardWindow)이 서고 닫힐 때 적는다 */
export const useClipboardPanel = create<{ open: boolean }>()(persist((): { open: boolean } => ({ open: false }), { name: 'sp5-clipboard-open' }));
export const setClipboardOpen = (open: boolean) => useClipboardPanel.setState({ open });
/**
 * 📋·단축키 (P47-1 11-19 - 왼쪽 칸을 없애고 창 칸의 탭 하나로): 탭이 없으면 창 칸에 '📋 클립보드' 탭을 세워 보이고,
 * 보이는 탭이면 닫고, 숨은 탭이면 앞으로. 창 위치가 팝업창(PC)이면 클립보드 팝업창을 연다(#140 - popupClip, 못 띄우면 이 창 안에 탭).
 */
export const toggleClipboard = () => {
  const tab = useWindows.getState().windows.find((w) => w.id === CLIPBOARD_WINDOW);
  if (tab && shownWindowNow()?.key === tab.key) return closeWindow(tab.key);
  if (!tab && openClipboardPopup()) return;
  openWindow(CLIPBOARD_WINDOW, undefined, { here: true });
};

/**
 * 복사한 것을 모은다. 칸이 닫혀 있어도 모은다 (Shell이 늘 부른다).
 * where: 'shell' = 큰 창 · 'popout' = 메모 등의 팝업창(시스템 클립보드를 잠깐마다 보지 않는다) · 'clipboard' = 클립보드 팝업창(늘 본다).
 */
export function useClipboardCapture(where: 'shell' | 'popout' | 'clipboard' = 'shell') {
  const uid = useSession((s) => s.user?.uid ?? null);
  const panelOpen = useClipboardPanel((s) => s.open);
  const open = where === 'clipboard' || (where === 'shell' && panelOpen);
  // 창 위치가 팝업창이면 다른 창(클립보드 팝업창)과 주고받는다 (#140)
  useClipboardBridge(uid);

  useEffect(() => {
    if (uid) void loadClipboard(uid);
  }, [uid]);

  useEffect(() => {
    const onCopy = () => {
      const text = selectedTextForCopy();
      if (text) void addCopiedText(text);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (rememberEditable(e.target as Element)) markEditorWindow();
    };
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

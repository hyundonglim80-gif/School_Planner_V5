// 클립보드 탭의 여닫기와 '복사한 것 모으기' (V4 components/ClipboardPanel.tsx의 useClipboardCapture). Shell이 늘 부른다.
// 클립보드는 창 목록의 창 'clipboard'다(P47-1 - 옛 왼쪽 칸을 창 칸의 탭 하나로, ClipboardWindow). 팝업창 모드면 같은 id가 클립보드 팝업창(ClipboardPopout).
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setShortcutAction } from '../../app/keys';
import { popupWindowsOn } from '../../app/layoutPrefs';
import { closeWindow, openWindow, useWindows, type OpenWindow } from '../../app/windows';
import { addCopiedText, loadClipboard, readSystemClipboard } from '../../data/clipboard';
import { useSession } from '../../data/session';
import { CLIPBOARD_POPOUT_ID } from '../../ui/popout';
import { activeOf, DOCK_MIN_WIDTH, useSidePopups } from '../../ui/sideColumn';
import { rememberEditable, selectedTextForCopy } from './paste';
import { markEditorWindow, useClipboardBridge } from './popupClip';

/** 클립보드 창의 id (= 단축키 id 'clipboard' = 클립보드 팝업창 id) */
export const CLIPBOARD_WINDOW = CLIPBOARD_POPOUT_ID;

/** 칸이 열려 있는 동안 시스템 클립보드를 다시 보는 간격 (읽기를 허락해 둔 경우만) */
const POLL_MS = 2000;

/**
 * 클립보드 탭이 열려 있었나 (이 기기에 기억 - 넓은 화면에서 열어 둔 채 새로고침하면 다시 선다). 큰 창이 창 목록을 따라 적는다.
 * 저장 이름은 옛 왼쪽 칸 그대로라 왼쪽 칸을 열어 둔 사람은 탭으로 이어 열린다.
 */
export const useClipboardPanel = create<{ open: boolean }>()(persist((): { open: boolean } => ({ open: false }), { name: 'sp5-clipboard-open' }));
export const setClipboardOpen = (open: boolean) => useClipboardPanel.setState({ open });

/** 이 창의 창 목록에 선 클립보드 탭 */
const clipboardWindowOf = (windows: OpenWindow[]) => windows.find((w) => w.id === CLIPBOARD_WINDOW);

/** 클립보드 탭이 보이고 있나 - 창 칸에 섰으면 보이는 탭인가, 칸 밖(휴대폰 덮기·가운데 창)이면 맨 위 창인가 */
function isShown(win: OpenWindow, windows: OpenWindow[], side: { order: string[]; active: string | null; owners: Record<string, number> }): boolean {
  const slot = side.order.find((id) => side.owners[id] === win.key);
  if (slot !== undefined) return activeOf(side) === slot;
  return windows.every((w) => w.raisedAt <= win.raisedAt);
}

/** 클립보드 탭 - 없음 · 탭으로 숨어 있음 · 보임 (📋 단추가 모양을 바꾼다) */
export function useClipboardTab(): 'closed' | 'hidden' | 'shown' {
  const win = useWindows((s) => clipboardWindowOf(s.windows));
  const windows = useWindows((s) => s.windows);
  const side = useSidePopups();
  if (!win) return 'closed';
  return isShown(win, windows, side) ? 'shown' : 'hidden';
}

/**
 * 📋·단축키: 탭이 없으면 열어 보이고, 다른 탭 뒤에 숨어 있으면 보이고, 보이고 있으면 닫는다 (5장 'P47' ⓑ).
 * 창 위치가 팝업창(PC)이면 창 목록이 클립보드 팝업창을 띄운다(열려 있으면 앞으로) - 브라우저가 막으면 큰 창 가운데에.
 */
export function toggleClipboard() {
  const { windows } = useWindows.getState();
  const win = clipboardWindowOf(windows);
  if (win && isShown(win, windows, useSidePopups.getState())) closeWindow(win.key);
  else openWindow(CLIPBOARD_WINDOW);
}

/**
 * 복사한 것을 모은다. 탭이 닫혀 있어도 모은다 (Shell이 늘 부른다).
 * where: 'shell' = 큰 창 · 'popout' = 메모 등의 팝업창(시스템 클립보드를 잠깐마다 보지 않는다) · 'clipboard' = 클립보드 팝업창(늘 본다).
 */
export function useClipboardCapture(where: 'shell' | 'popout' | 'clipboard' = 'shell') {
  const uid = useSession((s) => s.user?.uid ?? null);
  const tabOpen = useWindows((s) => !!clipboardWindowOf(s.windows));
  const open = where === 'clipboard' || (where === 'shell' && tabOpen);
  // 창 위치가 팝업창이면 다른 창(클립보드 팝업창)과 주고받는다 (#140)
  useClipboardBridge(uid);

  useEffect(() => {
    if (uid) void loadClipboard(uid);
  }, [uid]);

  // 열어 둔 채 닫았으면(새로고침) 다시 세운다 - 넓은 화면·오른쪽 칸 모드만. 휴대폰은 화면을 덮으므로 닫고 시작하고,
  // 팝업창 모드는 클립보드 팝업창이 브라우저 창으로 따로 남는다(방금 누르지 않아 띄우지도 못한다)
  useEffect(() => {
    if (where !== 'shell' || !useClipboardPanel.getState().open) return;
    const wide = !!window.matchMedia?.(`(min-width: ${DOCK_MIN_WIDTH}px)`).matches;
    if (wide && !popupWindowsOn()) openWindow(CLIPBOARD_WINDOW);
  }, [where]);
  // 탭이 열려 있나를 이 기기에 적는다 (큰 창만)
  useEffect(() => {
    if (where === 'shell') setClipboardOpen(tabOpen);
  }, [where, tabOpen]);

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

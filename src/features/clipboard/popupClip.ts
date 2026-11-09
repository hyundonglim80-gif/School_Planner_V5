// 클립보드 팝업창 (#140 - 환경설정 '창 위치'가 팝업창이면 왼쪽 📋가 클립보드를 브라우저 팝업창으로 연다).
//
//   - 팝업창은 같은 앱을 주소 ?popout={"id":"clipboard"}로 따로 띄운다(ClipboardPopout - 창 목록의 창이 아니다).
//     목록은 이 기기 저장소(IndexedDB)를 함께 쓰고, 한 창이 바꾸면 다른 창에 알려 다시 읽는다(BroadcastChannel).
//   - 항목을 누르면 마지막으로 글을 쓰던 창(큰 창·메모 팝업창 - 글 칸을 누를 때 그 창 표시 WIN_ID를 이 기기에 적는다)에 부탁해
//     그 창의 커서 자리에 넣는다(paste.pasteIntoTarget). 그 창을 닫았거나 받을 칸이 없으면 팝업창이 시스템 클립보드에 담는다(Ctrl+V).
//   - 브라우저가 팝업창을 막으면 지금처럼 왼쪽 칸이 열린다(capture.toggleClipboard). 휴대폰·오른쪽 칸 모드는 그대로 왼쪽 칸.
import { useEffect } from 'react';
import { popupWindowsOn, useLayoutPrefs, windowMode } from '../../app/layoutPrefs';
import { openPopupWindow } from '../../app/popupWindows';
import { copyClipToSystem, reloadClipboard, setClipboardWriteListener, type ClipItem } from '../../data/clipboard';
import { CLIPBOARD_POPOUT_ID, POPOUT } from '../../ui/popout';
import { pasteIntoTarget, type PasteResult } from './paste';

const CHANNEL = 'sp5-clipboard';
/** 마지막으로 글을 쓰던 창 (이 기기의 모든 창이 함께 본다) */
const LAST_EDITOR_KEY = 'sp5-clip-last-editor';
/** 그 창의 대답을 이만큼 기다린다 - 없으면 시스템 클립보드에 담는다 */
const ANSWER_MS = 1200;

type Msg =
  | { t: 'paste'; to: string; req: string; item: ClipItem }
  | { t: 'result'; req: string; pasted: boolean }
  | { t: 'changed'; uid: string; from: string };

/** 이 창의 표시 (열 때마다 새로) */
export const WIN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 이 창이 클립보드 팝업창인가 */
export const IN_CLIPBOARD_POPUP = POPOUT?.id === CLIPBOARD_POPOUT_ID;

let channel: BroadcastChannel | null = null;
const waiting = new Map<string, (pasted: boolean) => void>();

function post(msg: Msg) {
  try {
    channel?.postMessage(msg);
  } catch {
    /* 닫히는 중 */
  }
}

/** 큰 창에서 📋 = 클립보드 팝업창. 띄웠으면(이미 열린 것을 앞으로 가져왔으면) true - 못 띄우면 부르는 쪽이 왼쪽 칸을 연다. 누른 일 안에서 부른다 */
export function openClipboardPopup(): boolean {
  if (POPOUT || !popupWindowsOn()) return false;
  return openPopupWindow(CLIPBOARD_POPOUT_ID, null, () => true);
}

/** 글 칸을 눌렀다 - 이 창이 마지막으로 글을 쓰던 창 (팝업창 모드에서만 적는다) */
export function markEditorWindow() {
  if (IN_CLIPBOARD_POPUP || !popupWindowsOn()) return;
  try {
    localStorage.setItem(LAST_EDITOR_KEY, WIN_ID);
  } catch {
    /* 못 적으면 클립보드에 담는 길로 */
  }
}

function lastEditor(): string | null {
  try {
    return localStorage.getItem(LAST_EDITOR_KEY);
  } catch {
    return null;
  }
}

/** 그 창에 붙여넣기를 부탁한다 - 넣었으면 true */
function askPaste(to: string, item: ClipItem): Promise<boolean> {
  if (!channel) return Promise.resolve(false);
  const req = `${WIN_ID}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(req);
      resolve(false);
    }, ANSWER_MS);
    waiting.set(req, (pasted) => {
      clearTimeout(timer);
      waiting.delete(req);
      resolve(pasted);
    });
    post({ t: 'paste', to, req, item });
  });
}

/** 클립보드 팝업창에서 항목 누르기 = 마지막으로 글을 쓰던 창의 커서 자리에. 못 넣으면 시스템 클립보드에 담고 'copied' */
export async function pasteFromPopup(item: ClipItem): Promise<PasteResult> {
  const to = lastEditor();
  if (to && to !== WIN_ID && (await askPaste(to, item))) return 'pasted';
  return (await copyClipToSystem(item)) ? 'copied' : 'failed';
}

/** 받은 말 하나 (시험에서도 부른다) */
export function handleClipMessage(m: unknown, uid: string) {
  if (!m || typeof m !== 'object') return;
  const msg = m as Msg;
  if (msg.t === 'paste' && msg.to === WIN_ID) {
    let pasted = false;
    try {
      pasted = pasteIntoTarget(msg.item);
    } catch {
      pasted = false;
    }
    if (pasted) {
      try {
        // 붙인 창을 앞으로 (브라우저가 막으면 그 창을 한 번 눌러 이어 쓴다)
        window.focus();
      } catch {
        /* 앞으로 못 와도 글은 들어갔다 */
      }
    }
    post({ t: 'result', req: msg.req, pasted });
  } else if (msg.t === 'result') {
    waiting.get(msg.req)?.(msg.pasted);
  } else if (msg.t === 'changed' && msg.uid === uid && msg.from !== WIN_ID) {
    void reloadClipboard(uid);
  }
}

/**
 * 창 위치가 팝업창일 때 다른 창과 주고받기 - 큰 창·메모 팝업창·클립보드 팝업창이 늘 부른다(capture.useClipboardCapture).
 * 붙여넣기 부탁을 받고, 이 창이 목록을 바꾸면 알리고, 다른 창이 바꾸면 다시 읽는다.
 */
export function useClipboardBridge(uid: string | null) {
  const on = useLayoutPrefs((s) => IN_CLIPBOARD_POPUP || windowMode(s.popupStyle) === 'popup');
  useEffect(() => {
    if (!on || !uid || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    channel = ch;
    ch.onmessage = (e: MessageEvent) => handleClipMessage(e.data, uid);
    setClipboardWriteListener((u) => post({ t: 'changed', uid: u, from: WIN_ID }));
    // 닫히는 창은 '마지막으로 글을 쓰던 창'에서 뺀다 - 클립보드 팝업창이 곧바로 시스템 클립보드에 담는다
    const onHide = () => {
      if (lastEditor() !== WIN_ID) return;
      try {
        localStorage.removeItem(LAST_EDITOR_KEY);
      } catch {
        /* 대답이 없으면 기다린 뒤 담는다 */
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      setClipboardWriteListener(null);
      if (channel === ch) channel = null;
      ch.close();
    };
  }, [on, uid]);
}

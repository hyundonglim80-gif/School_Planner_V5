// 클립보드 칸 항목을 글 쓰던 칸에 붙여넣기 (V4 lib/clipboardHistory.ts의 붙여넣기 부분).
//   항목을 누르면 마지막으로 글을 쓰던 칸(입력칸·글 칸)의 커서 자리에 넣는다.
//   그림은 그 칸에 Ctrl+V 한 것처럼 넘긴다(메모·기록 칸은 가로채 드라이브에 올려 붙인다 - notes/attach).
//   글도 먼저 붙여넣기로 넘긴다(P48-5) - 표 칸·시간표·진도표 칸이 엑셀 범위 글을 Ctrl+V처럼 받고, 받지 않으면 커서 자리에 글.
//   받을 칸이 없으면 시스템 클립보드에 도로 담아 두고, 원하는 곳에서 Ctrl+V 하게 한다.
import { raiseWindow } from '../../app/windows';
import { copyClipToSystem, type ClipItem } from '../../data/clipboard';

const TEXT_INPUT_TYPES = ['text', 'search', 'url', 'email', 'tel', 'number', ''];

export function isEditable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.includes(el.type) && !el.readOnly && !el.disabled;
  return el.isContentEditable;
}

let lastEditable: HTMLElement | null = null;

/** 마지막으로 글을 쓰던 칸. 클립보드 칸 안의 칸은 세지 않는다. 기억했으면 true */
export function rememberEditable(el: Element | null): boolean {
  if (!isEditable(el)) return false;
  if (el.closest('[data-clipboard-panel]')) return false;
  lastEditable = el;
  return true;
}

export function getPasteTarget(): HTMLElement | null {
  const active = document.activeElement;
  if (isEditable(active) && !active.closest('[data-clipboard-panel]')) return active;
  return lastEditable && lastEditable.isConnected ? lastEditable : null;
}

/** 글자를 칸의 커서 자리에 넣는다. React가 바뀐 값을 알도록 input 이벤트도 일으킨다. */
function insertText(el: HTMLElement, text: string) {
  el.focus();
  // execCommand는 되돌리기(Ctrl+Z)까지 살려 주고, React의 onChange도 제대로 부른다
  let done = false;
  try {
    done = document.execCommand('insertText', false, text);
  } catch {
    done = false;
  }
  if (done) return;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    // React가 값을 쥐고 있는 칸은 value를 그냥 바꾸면 무시한다 - 원래 setter로 넣는다
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next);
    el.setSelectionRange(start + text.length, start + text.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    el.textContent = (el.textContent || '') + text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * 글 칸이 스스로 받는 붙여넣기 - Ctrl+V처럼 붙여넣기 이벤트로 넘긴다. 칸이 받았으면(preventDefault) true.
 * 표 칸(P48-5 - 엑셀 범위 글을 고른 칸부터 채운다)·시간표·진도표 칸이 클립보드 탭의 글도 Ctrl+V와 같게 받는다.
 */
function pasteAsEvent(el: HTMLElement, text: string): boolean {
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  } catch {
    return false;
  }
}

export type PasteResult = 'pasted' | 'copied' | 'failed';

/**
 * 이 창의 글 쓰던 칸에 넣는다. 넣었으면 true - 받을 칸이 없거나 그림을 못 받는 칸이면 false.
 * 클립보드 팝업창(#140)이 다른 창에 부탁할 때도 그 창에서 이것을 부른다(features/clipboard/popupClip).
 */
export function pasteIntoTarget(item: ClipItem): boolean {
  const target = getPasteTarget();
  if (!target) return false;
  if (item.kind === 'text') {
    target.focus();
    if (!pasteAsEvent(target, item.text || '')) insertText(target, item.text || '');
    return true;
  }
  if (item.kind === 'image' && item.blob) {
    target.focus();
    try {
      const ext = (item.blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const file = new File([item.blob], `clipboard.${ext}`, { type: item.blob.type || 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      target.dispatchEvent(ev);
      // 메모·기록 칸처럼 그림을 받는 칸은 붙여넣기를 가로채(preventDefault) 올린다
      return ev.defaultPrevented;
    } catch {
      return false;
    }
  }
  return false;
}

/** 붙여넣는다. 받을 칸이 없으면(또는 그림을 못 받는 칸이면) 시스템 클립보드에 담고 'copied' */
export async function pasteClip(item: ClipItem): Promise<PasteResult> {
  if (pasteIntoTarget(item)) return 'pasted';
  return (await copyClipToSystem(item)) ? 'copied' : 'failed';
}

/** 받을 칸이 든 창 (창 틀의 data-window-key - 창 밖 칸이면 null) */
export function windowKeyOf(el: Element | null): number | null {
  const key = Number(el?.closest('[data-window-key]')?.getAttribute('data-window-key'));
  return Number.isFinite(key) && key > 0 ? key : null;
}

const nextFrame = () => new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

/**
 * 창 칸의 📋 클립보드 탭에서 붙여넣기 (P47-1 ⓒ): 받을 칸이 든 창(탭)을 먼저 앞으로 보이고 붙인다 - 숨은 탭(display:none)의 칸에는
 * 커서를 둘 수 없고, 붙은 것이 보여야 한다. 칸이 창 밖(하루 화면 등)이면 탭은 그대로.
 */
export async function pasteClipShowingTarget(item: ClipItem): Promise<PasteResult> {
  const target = getPasteTarget();
  const key = windowKeyOf(target);
  if (target && key) {
    raiseWindow(key);
    // 그 탭이 그려져 칸이 보일 때까지 (몇 프레임)
    for (let i = 0; i < 10 && !target.getClientRects().length; i++) await nextFrame();
  }
  return pasteClip(item);
}

/** 칸이 스스로 정하는 복사 글 (고치는 표의 고른 범위 - 글 칸에는 고른 글이 없다) */
const copySources = new WeakMap<Element, () => string>();

/** 이 칸에서 복사하면 모을 글을 정한다 (빈 글이면 칸 안 고른 글 그대로) */
export function setCopySource(el: Element, get: () => string) {
  copySources.set(el, get);
}

/** 이 앱 안에서 복사(Ctrl+C)·잘라내기한 글자 - 비밀번호 칸은 빼고 */
export function selectedTextForCopy(): string {
  const active = document.activeElement;
  const own = active ? copySources.get(active)?.() : '';
  if (own) return own;
  if (active instanceof HTMLInputElement && active.type === 'password') return '';
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const { selectionStart: s, selectionEnd: e, value } = active;
    if (s != null && e != null && e > s) return value.slice(s, e);
  }
  return document.getSelection()?.toString() || '';
}

// 클립보드 칸 항목을 글 쓰던 칸에 붙여넣기 (V4 lib/clipboardHistory.ts의 붙여넣기 부분).
//   항목을 누르면 마지막으로 글을 쓰던 칸(입력칸·글 칸)의 커서 자리에 넣는다.
//   그림은 그 칸에 Ctrl+V 한 것처럼 넘긴다(메모·기록 칸은 가로채 드라이브에 올려 붙인다 - notes/attach).
//   받을 칸이 없으면 시스템 클립보드에 도로 담아 두고, 원하는 곳에서 Ctrl+V 하게 한다.
import { copyClipToSystem, type ClipItem } from '../../data/clipboard';

const TEXT_INPUT_TYPES = ['text', 'search', 'url', 'email', 'tel', 'number', ''];

export function isEditable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.includes(el.type) && !el.readOnly && !el.disabled;
  return el.isContentEditable;
}

let lastEditable: HTMLElement | null = null;

/** 마지막으로 글을 쓰던 칸. 클립보드 칸 안의 칸은 세지 않는다. */
export function rememberEditable(el: Element | null) {
  if (!isEditable(el)) return;
  if (el.closest('[data-clipboard-panel]')) return;
  lastEditable = el;
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

export type PasteResult = 'pasted' | 'copied' | 'failed';

/** 붙여넣는다. 받을 칸이 없으면(또는 그림을 못 받는 칸이면) 시스템 클립보드에 담고 'copied' */
export async function pasteClip(item: ClipItem): Promise<PasteResult> {
  const target = getPasteTarget();
  if (target && item.kind === 'text') {
    insertText(target, item.text || '');
    return 'pasted';
  }
  if (target && item.kind === 'image' && item.blob) {
    target.focus();
    try {
      const ext = (item.blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const file = new File([item.blob], `clipboard.${ext}`, { type: item.blob.type || 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      target.dispatchEvent(ev);
      // 메모·기록 칸처럼 그림을 받는 칸은 붙여넣기를 가로채(preventDefault) 올린다
      if (ev.defaultPrevented) return 'pasted';
    } catch {
      /* 아래에서 클립보드에 담는다 */
    }
  }
  return (await copyClipToSystem(item)) ? 'copied' : 'failed';
}

/** 이 앱 안에서 복사(Ctrl+C)·잘라내기한 글자 - 비밀번호 칸은 빼고 */
export function selectedTextForCopy(): string {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.type === 'password') return '';
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const { selectionStart: s, selectionEnd: e, value } = active;
    if (s != null && e != null && e > s) return value.slice(s, e);
  }
  return document.getSelection()?.toString() || '';
}

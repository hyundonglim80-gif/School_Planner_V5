// 화면을 덮는 창(가운데 창·휴대폰 배너)의 키보드 초점 (P22-7).
//   열면 초점을 창 안으로 옮긴다 - 안의 칸이 autoFocus로 이미 가져갔으면 그대로, 아니면 창 판 자체(tabIndex -1)에.
//   Tab·Shift+Tab은 창 안에서 돈다(뒤 화면은 덮여 누를 수 없다 - aria-modal). 닫으면 연 단추로 돌아온다
//   (초점이 창과 함께 사라졌을 때만 - 그새 다른 곳을 눌렀으면 그대로).
//   오른쪽 줄에 붙은 칸은 화면을 같이 쓰므로 쓰지 않는다(가두지 않는다).
import { useEffect, useState, type RefObject } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/** 창 안에서 Tab으로 갈 수 있는 것 (숨은 탭·접힌 칸은 뺀다) */
function focusables(card: HTMLElement): HTMLElement[] {
  return [...card.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 || el === document.activeElement);
}

export function useDialogFocus(active: boolean, cardRef: RefObject<HTMLElement | null>) {
  // 연 단추 = 창이 열리는 그 그리기에서 초점이 있던 곳 (안의 칸 autoFocus보다 먼저 잡는다 - 그리는 중에 앞 값과 견준다)
  const [wasActive, setWasActive] = useState(false);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpener(document.activeElement as HTMLElement | null);
  }

  useEffect(() => {
    const card = cardRef.current;
    if (!active || !card) return;
    if (!card.contains(document.activeElement)) card.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      // 문서에서 듣는다 - 창 안 칸이 Tab을 스스로 쓰면(표 칸 옮기기) 그쪽이 먼저 막는다(React는 뿌리에서 먼저 받는다)
      if (e.key !== 'Tab' || e.defaultPrevented || !(e.target instanceof Node) || !card.contains(e.target)) return;
      const list = focusables(card);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === card)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const now = document.activeElement;
      const lost = !now || now === document.body || !now.isConnected || card.contains(now);
      if (lost && opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, cardRef, opener]);
}

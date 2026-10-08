// 창·쓰는 칸 안에서 누른 Ctrl+S (V4 PopupFrame.useSaveKey + 쓰는 칸 EntryDrawer의 키 처리를 하나로).
//
// 받는 칸: 커서가 든 칸. 커서가 아무 데도 없으면(칸의 빈 곳이나 왼쪽 화면을 누른 뒤) 보이는 탭(오른쪽 줄) 또는 맨 위 창.
// 겹쳐 연 창에서 누른 Ctrl+S가 아래 창·쓰는 칸까지 저장하지 않게 받은 칸에서 멈춘다.
// ⚠️ 저장 함수는 ref로 들고 effect로 바꿔 끼운다 - 새 상태를 빠뜨리면 옛 값으로 저장한다(V4 교훈).
import { useEffect, useRef, type RefObject } from 'react';
import { isTopSideItem } from './sideColumn';

export const isSaveKey = (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's');

/** 열려 있는 창 판 가운데 맨 위인가 (오른쪽 줄 안이면 보이는 탭, 밖이면 나중에 그려진 것) */
function isTopDialog(el: HTMLElement) {
  if (el.closest('#side-column')) return isTopSideItem(el);
  const all = [...document.querySelectorAll('[data-popup-card]')].filter((c) => !c.closest('#side-column'));
  return all[all.length - 1] === el;
}

/**
 * onSave를 주지 않으면 글을 쓰던 입력칸이 든 <form>을 제출한다(D-Day·그룹 등 V4 그대로).
 * 둘 다 없으면 브라우저 '다른 이름으로 저장'만 막는다(껍데기의 키 처리).
 */
export function useSaveKey(isOpen: boolean, cardRef: RefObject<HTMLElement | null>, onSave?: () => void) {
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSaveKey(e)) return;
      const card = cardRef.current;
      if (!card) return;
      const active = document.activeElement;
      const inside = !!active && card.contains(active);
      const nowhere = !active || active === document.body;
      if (!inside && !(nowhere && isTopDialog(card))) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (saveRef.current) {
        saveRef.current();
        return;
      }
      const form = active instanceof Element ? active.closest('form') : null;
      if (form && card.contains(form)) form.requestSubmit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, cardRef]);
}

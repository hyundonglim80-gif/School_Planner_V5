// 카드를 끌어 놓아 순서 바꾸기 (▲▼ 단추에 더해서 - 일정·메모·수업 카드가 함께 쓴다).
//
// - 같은 무리(group) 안에서만 놓인다. 끌기 자료는 앱 안 변수에 둔다(날짜 옮기기 끌기 `events/drag`와 섞이지 않게 별도 MIME).
// - 마우스(정밀한 포인터)로 쓰는 화면에서만 끈다. 휴대폰은 ▲▼를 쓴다.
// - 놓을 카드 위에 끌고 오면 파란 테두리(`data-reorder-over`).
import type { DragEvent } from 'react';

const REORDER_MIME = 'application/x-sp5-reorder';

let dragging: { group: string; index: number } | null = null;

/** 마우스로 쓰는 화면인가 */
export function canReorderByDrag(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
  } catch {
    return false;
  }
}

const OVER_CLASS = ['ring-2', 'ring-primary', 'ring-offset-1'];
const setOver = (el: Element, on: boolean) => {
  if (on) el.setAttribute('data-reorder-over', '1');
  else el.removeAttribute('data-reorder-over');
  el.classList[on ? 'add' : 'remove'](...OVER_CLASS);
};

/**
 * 카드 하나에 붙이는 끌기 속성. group = 같은 무리끼리만 놓인다, index = 무리 안 자리,
 * onMove(from, to) = 놓았을 때(다른 자리일 때만). enabled가 아니면 아무것도 붙이지 않는다.
 */
export function reorderDragProps(group: string, index: number, onMove: (from: number, to: number) => void, enabled = true) {
  if (!enabled || !canReorderByDrag()) return {};
  return {
    draggable: true,
    'data-reorder-card': `${group}:${index}`,
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      dragging = { group, index };
      e.dataTransfer.setData(REORDER_MIME, group);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      dragging = null;
    },
    onDragOver: (e: DragEvent) => {
      if (!dragging || dragging.group !== group) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragging.index !== index) setOver(e.currentTarget, true);
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setOver(e.currentTarget, false);
    },
    onDrop: (e: DragEvent) => {
      setOver(e.currentTarget, false);
      if (!dragging || dragging.group !== group) return;
      e.preventDefault();
      e.stopPropagation();
      const from = dragging.index;
      dragging = null;
      if (from !== index) onMove(from, index);
    },
  };
}

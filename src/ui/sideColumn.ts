// 오른쪽 줄 (V4 components/PopupFrame.tsx의 앞부분에서 옮김).
//
// 넓은 화면에서 오른쪽에 붙는 칸(창·쓰는 칸)은 모두 한 줄(getSideColumn)에 선다.
//   - 폭은 모두 같다 (RIGHT_COLUMN_WIDTH). 창마다 폭이 달라 오갈 때 화면이 들썩였다.
//   - 칸이 하나면 줄을 꽉 채운다 (안쪽 목록이 스스로 스크롤하고 저장 줄은 바닥에 붙는다).
//   - 칸이 둘 이상이면 줄 위에 **탭**이 선다 (V4 2026-10-07 사용자 요청 - 높이를 나누는 방식은 거절). 새 칸을 열면 탭이 하나 더해지고
//     그 칸이 보인다. 안 보이는 칸도 그대로 살아 있어 적던 글이 남는다(display:none). 탭의 ×는 그 칸의 '닫기'를 누른다.
// 휴대폰 배너는 줄에 세우지 않는다 - 화면이 작아 쌓아 두면 쓸 수 없다. 위에 덮는다.
//
// 줄에 무엇이 서는지는 칸이 그려질 때 스스로 선다(useSideSlot) - 창 목록에 등록한 창도, 창 안에서 띄운 작은 창도 같은 줄이다.
// 줄 위의 탭은 SideTabs.tsx.
import { useEffect, useId, type CSSProperties } from 'react';
import { create } from 'zustand';
import { useMinWidth } from './useMinWidth';

/** 이 폭 이상이면 오른쪽 칸을 화면 옆에 붙인다. 그보다 좁으면(휴대폰) 화면을 덮는 배너. */
export const DOCK_MIN_WIDTH = 768;

/** 넓은 화면이면 옆에 붙는다 */
export function useDocked(): boolean {
  return useMinWidth(DOCK_MIN_WIDTH);
}

/**
 * 오른쪽 줄의 기본 폭. 모니터 절반(약 940px)에서도 왼쪽 화면이 반 넘게 남도록 36vw로 두고, 너무 좁거나 넓지 않게 묶는다.
 */
export const RIGHT_COLUMN_WIDTH = 'clamp(340px, 36vw, 512px)';

/**
 * 지금 오른쪽 줄의 폭. 경계선을 끌어 바꾼 폭(껍데기가 --right-column-w 로 건다)이 있으면 그것,
 * 없으면 기본 폭. 창을 좁혀도 왼쪽 화면이 320px은 남도록 묶는다.
 */
export const RIGHT_COLUMN_CSS_WIDTH = `min(var(--right-column-w, ${RIGHT_COLUMN_WIDTH}), calc(100vw - 320px))`;

/**
 * 지금 오른쪽 줄에 선 칸들. 연 순서(먼저 연 것이 앞) = 탭 차례. 껍데기는 하나라도 있으면 화면을 줄인다.
 * active: 탭에서 보이는 칸 (없으면 맨 나중에 연 것)
 */
export const useSidePopups = create<{ order: string[]; active: string | null }>(() => ({ order: [], active: null }));

/** 지금 보이는 칸 id (active가 줄에 없으면 맨 나중에 연 것) */
export const activeOf = (s: { order: string[]; active: string | null }) =>
  s.active && s.order.includes(s.active) ? s.active : s.order[s.order.length - 1] ?? null;

/** 탭을 눌러 그 칸을 보인다 */
export function activateSideSlot(id: string) {
  useSidePopups.setState({ active: id });
  getSideColumn().scrollTop = 0;
}

let columnEl: HTMLElement | null = null;

/** 오른쪽 줄. 칸들이 여기에 그려진다(createPortal). 비어 있으면 보이지 않는다. */
export function getSideColumn(): HTMLElement {
  if (columnEl && columnEl.isConnected) return columnEl;
  columnEl = document.createElement('div');
  columnEl.id = 'side-column';
  columnEl.setAttribute('data-side-column', '');
  columnEl.className =
    'fixed top-0 right-0 bottom-0 z-[45] flex flex-col bg-white border-l border-slate-200 shadow-xl overflow-y-auto overscroll-contain empty:hidden';
  columnEl.style.width = RIGHT_COLUMN_CSS_WIDTH;
  document.body.appendChild(columnEl);
  return columnEl;
}

export interface SideSlot {
  /** 줄 안의 이름 (탭이 칸을 찾는다) */
  id: string;
  /** 줄에 선 칸 수 */
  rows: number;
  /** 탭에서 지금 보이는 칸인가 */
  shown: boolean;
}

/**
 * 오른쪽 줄에 선다. 켜져 있는 동안 줄에 서고, 보이는 탭인지 돌려준다.
 * raise가 바뀌면 줄에서 빠졌다가 다시 서서 보이는 탭이 된다 (이미 열린 칸을 다시 열 때).
 */
export function useSideSlot(active: boolean, raise?: number): SideSlot {
  const id = useId();
  useEffect(() => {
    if (!active) return;
    // 방금 연(다시 연) 칸이 보이는 탭이 된다
    useSidePopups.setState((s) => ({ order: [...s.order.filter((x) => x !== id), id], active: id }));
    getSideColumn().scrollTop = 0;
    return () => {
      useSidePopups.setState((s) => {
        const order = s.order.filter((x) => x !== id);
        return { order, active: s.active === id ? order[order.length - 1] ?? null : s.active };
      });
    };
  }, [active, id, raise]);

  const order = useSidePopups((s) => s.order);
  const shownId = useSidePopups(activeOf);
  if (!active || !order.includes(id)) return { id, rows: 1, shown: true };
  return { id, rows: order.length, shown: shownId === id };
}

/** 줄 안에서 한 칸의 자리. 보이는 칸 하나만 줄을 채우고(order 0 - isTopSideItem), 나머지는 숨겨 둔다(적던 것은 그대로). */
export function sideSlotProps({ rows, id, shown }: SideSlot): { className: string; style: CSSProperties; 'data-side-slot': string } {
  if (rows > 1 && !shown) return { className: 'flex flex-col bg-white', style: { display: 'none', order: 1 }, 'data-side-slot': id };
  return {
    className: 'flex flex-col bg-white shrink-0',
    style: rows > 1 ? { order: 0, flex: '1 1 0%', minHeight: 0 } : { order: 0, height: '100%' },
    'data-side-slot': id,
  };
}

/**
 * 오른쪽 줄에서 보이는 칸인가 (줄 안의 차례는 CSS order - 0이 보이는 칸). 줄 밖이면 false.
 * 커서가 아무 데도 없을 때(칸의 빈 곳이나 왼쪽 화면을 누른 뒤) Ctrl+S를 누가 받을지 정한다.
 */
export function isTopSideItem(el: Element | null | undefined): boolean {
  const item = el?.closest('#side-column > *') as HTMLElement | null;
  return !!item && item.style.order === '0';
}

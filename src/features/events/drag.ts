// 일정을 끌어 다른 날 칸에 놓아 옮기기 (V4 hooks/useEventDrag.tsx). 주간 요일 카드·월간 날짜 칸·년간 자세히의 날 줄.
//
// - 마우스로 쓰는 화면에서만 끈다(휴대폰의 길게 누르기는 스크롤·글자 고르기·여러 개 고르기와 겹친다 - 휴대폰은 일정 칸의 날짜로).
//   여러 개 고르기 중에는 끄지 않는다(고른 것은 고르기 줄의 '옮기기'로).
// - 놓으면: 하루짜리는 곧바로 옮기고, 기간·반복 묶음이면 어디까지 묻는다(EventMoveChooser - 화면이 pending을 그린다).
// - 끌고 있는 동안 놓을 칸을 파랗게 짚는다. 처리 함수는 늘 같은 것이라 년간 달 카드(memo)가 끌 때마다 다시 그리지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { showToast } from '../../app/toast';
import { itemsOn, useDocs, useLabelTree } from '../../data/select';
import { todayStr } from '../../domain/dateUtils';
import { moveEventTo } from './actions';
import { orderAfter, type ItemDoc } from './eventOps';
import { movesForwardIntoPast, needsMoveScope } from './moveOps';
import { useMulti } from './multi';

/** 끌기 자료의 종류 (다른 곳 - 글 칸 - 에 놓이면 일정 글이 들어간다) */
export const EVENT_DRAG_MIME = 'application/x-sp5-event';

interface Dragged {
  id: string;
  /** 끈 칸의 날 (기간은 그 날) */
  day: string;
}

/** 마우스(정밀한 포인터)로 쓰는 화면인가 */
export function canDragEvents(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** 일정 하나에 붙이는 끌기 속성 (enabled가 아니면 아무것도). onEnd = 끌기가 끝났을 때(놓지 않았어도) */
export function eventDragProps(ev: Pick<ItemDoc, 'id' | 'text'>, day: string, enabled: boolean, onEnd?: () => void) {
  if (!enabled) return {};
  return {
    draggable: true,
    'data-drag-event': ev.id,
    onDragEnd: () => onEnd?.(),
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData(EVENT_DRAG_MIME, JSON.stringify({ id: ev.id, day } satisfies Dragged));
      e.dataTransfer.setData('text/plain', ev.text ?? '');
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}

const isEventDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes(EVENT_DRAG_MIME);

/** 날짜 칸에 붙이는 놓기 처리 (늘 같은 함수) */
export interface DropHandlers {
  over: (e: DragEvent, date: string) => void;
  leave: (e: DragEvent, date: string) => void;
  drop: (e: DragEvent, date: string) => void;
}

/** 날짜 칸에 붙이는 속성 */
export function dropTargetProps(handlers: DropHandlers, date: string) {
  return {
    'data-drop-date': date,
    onDragOver: (e: DragEvent) => handlers.over(e, date),
    onDragLeave: (e: DragEvent) => handlers.leave(e, date),
    onDrop: (e: DragEvent) => handlers.drop(e, date),
  };
}

/** 놓을 칸으로 짚었을 때 덧붙이는 모양 */
export const DROP_TARGET_CLASS = 'ring-2 ring-primary ring-offset-1 bg-blue-50/70';

/** 범위를 물어야 하는 옮기기 (기간·반복) */
export interface PendingMove {
  item: ItemDoc;
  day: string;
  to: string;
}

/**
 * 날짜 칸을 놓을 자리로. handlers = 칸에 붙일 것(dropTargetProps), overDate = 짚은 날, dragEnabled = 일정에 끌기를 붙일지,
 * clearOver = 일정 쪽 onDragEnd에, pending = 묶음이라 범위를 묻는 중(화면이 EventMoveChooser를 그린다).
 */
export function useEventDrop(sid: string | null) {
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const multiOn = useMulti((s) => s.on);
  const [overDate, setOverDate] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const latest = useRef({ sid, items, tree });
  useEffect(() => {
    latest.current = { sid, items, tree };
  });

  const overRef = useRef<string | null>(null);
  const setOver = useCallback((d: string | null) => {
    overRef.current = d;
    setOverDate(d);
  }, []);

  const handlers: DropHandlers = useMemo(
    () => ({
      over: (e, date) => {
        if (!isEventDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (overRef.current !== date) setOver(date);
      },
      leave: (e, date) => {
        // 칸 안의 다른 요소로 넘어가는 것은 떠난 것이 아니다
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (overRef.current === date) setOver(null);
      },
      drop: (e, to) => {
        if (!isEventDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(null);
        let dragged: Dragged;
        try {
          dragged = JSON.parse(e.dataTransfer.getData(EVENT_DRAG_MIME)) as Dragged;
        } catch {
          return;
        }
        if (!dragged?.id || dragged.day === to) return;
        const { sid: s, items: docs, tree: t } = latest.current;
        const item = docs[dragged.id];
        if (!s || !item || item.deletedAt) {
          showToast('옮길 일정을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.');
          return;
        }
        if (needsMoveScope(item)) {
          setPending({ item, day: dragged.day, to });
          return;
        }
        const ctx = { order: orderAfter(itemsOn(docs, to, 'event')), bounce: movesForwardIntoPast(item, dragged.day, to, todayStr(), t) };
        void moveEventTo(s, item, dragged.day, to, 'only', ctx).catch(() => {
          /* 안내는 저장 도우미가 했다 */
        });
      },
    }),
    [setOver],
  );

  const clearOver = useCallback(() => setOver(null), [setOver]);
  const cancel = useCallback(() => setPending(null), []);
  return { handlers, overDate, dragEnabled: canDragEvents() && !multiOn, clearOver, pending, cancel };
}

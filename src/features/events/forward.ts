// 이월 - 오늘로 따라오는 일정 고르기 (domain/forward의 판단을 기기 사본 위에서). 하루·주간(P5-1)이 함께 쓴다.
//
// 계산만 한다(원칙 4) - 이 훅은 아무것도 쓰지 않는다. 처음 따라올 때 carrying 한 번은 ForwardMarks(껍데기에 하나)가 적는다.
import { useMemo } from 'react';
import { todayStr } from '../../domain/dateUtils';
import { create } from 'zustand';
import { useCommonSettings } from '../../app/prefs';
import { compareOrder } from '../../domain/order';
import { carriedOf, staleOf, type LabelForward } from '../../domain/forward';
import { labelProps } from '../../domain/labels';
import { collKey, useMirror } from '../../data/mirror/store';
import { itemsOfKind, labelTreeOf, useDocs, useLabelTree, type Docs, type LabelTree } from '../../data/select';
import { useToday } from '../../ui/useToday';
import type { ItemDoc } from './eventOps';

const forwardCache = new WeakMap<LabelTree, LabelForward>();

/** 일정 라벨 → 이월을 켰나 (트리가 바뀔 때만 새로) */
export function labelForwardOf(tree: LabelTree): LabelForward {
  let map = forwardCache.get(tree);
  if (!map) {
    map = new Map(tree.list.map((l) => [l.id, labelProps(l.props).forward]));
    forwardCache.set(tree, map);
  }
  return map;
}

export interface Carried {
  today: string;
  /** 오늘로 따라오는 일정 (차례대로) */
  list: ItemDoc[];
  ids: ReadonlySet<string>;
  /** 지난 일정 - 이월 기간 안에 끝내지 않았고 따라오지 않는 것 ('📥 지난 일정 N개') */
  stale: ItemDoc[];
}

/** 지금 오늘로 따라오는 일정 (지금 공간 - sid를 주면 그 공간) */
export function useCarried(sid?: string | null): Carried {
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const forwardDays = useCommonSettings((s) => s.forwardDays);
  const today = useToday();
  return useMemo(() => {
    const events = itemsOfKind(items, 'event');
    const labels = labelForwardOf(tree);
    const list = carriedOf(events, labels, today, forwardDays).sort(compareOrder);
    return { today, list, ids: new Set(list.map((d) => d.id)), stale: staleOf(events, labels, today, forwardDays) };
  }, [items, tree, today, forwardDays]);
}

/** '📥 지난 일정' 줄을 폈나 (단축키 '지난 일정 오늘로 가져오기'가 오늘로 가서 편다 - MENU 3-8) */
export const usePastRow = create<{ open: boolean }>(() => ({ open: false }));
export const setPastRowOpen = (open: boolean) => usePastRow.setState({ open });

/** 지금 사본에서 센 지난 일정 수 (단축키가 줄을 펼 때 - 없으면 알린다) */
export function staleCountNow(sid: string): number {
  const colls = useMirror.getState().colls;
  const items = (colls[collKey(sid, 'items')]?.docs ?? {}) as unknown as Docs<'items'>;
  const labels = (colls[collKey(sid, 'labels')]?.docs ?? {}) as unknown as Docs<'labels'>;
  const tree = labelTreeOf(labels, 'event');
  return staleOf(itemsOfKind(items, 'event'), labelForwardOf(tree), todayStr(), useCommonSettings.getState().forwardDays).length;
}

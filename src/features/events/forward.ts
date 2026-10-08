// 이월 - 오늘로 따라오는 일정 고르기 (domain/forward의 판단을 기기 사본 위에서). 하루·주간(P5-1)이 함께 쓴다.
//
// 계산만 한다(원칙 4) - 이 훅은 아무것도 쓰지 않는다. 처음 따라올 때 carrying 한 번은 ForwardMarks(껍데기에 하나)가 적는다.
import { useMemo } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { compareOrder } from '../../domain/order';
import { carriedOf, type LabelForward } from '../../domain/forward';
import { labelProps } from '../../domain/labels';
import { itemsOfKind, useDocs, useLabelTree, type LabelTree } from '../../data/select';
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
}

/** 지금 오늘로 따라오는 일정 (지금 공간 - sid를 주면 그 공간) */
export function useCarried(sid?: string | null): Carried {
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const forwardDays = useCommonSettings((s) => s.forwardDays);
  const today = useToday();
  return useMemo(() => {
    const list = carriedOf(itemsOfKind(items, 'event'), labelForwardOf(tree), today, forwardDays).sort(compareOrder);
    return { today, list, ids: new Set(list.map((d) => d.id)) };
  }, [items, tree, today, forwardDays]);
}

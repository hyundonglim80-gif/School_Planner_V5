// 반복 묶음 고르기 (기기 사본에서 - 같은 seriesId의 살아 있는 항목과 series 문서). 일정 칸·지우기 창이 함께 쓴다.
import { useMemo } from 'react';
import { useDocs } from '../../data/select';
import type { ItemDoc } from './eventOps';
import { seriesItemsOf, type SeriesDoc } from './seriesOps';

export interface SeriesInfo {
  series: SeriesDoc | undefined;
  /** 묶음의 살아 있는 항목 (날짜 차례) */
  list: ItemDoc[];
  /** 이 항목이 몇째인가 (0부터, 없으면 -1) */
  index: number;
}

/** 이 항목의 반복 묶음 (묶음이 아니면 null) */
export function useSeriesOf(sid: string | null | undefined, item: ItemDoc | undefined): SeriesInfo | null {
  const items = useDocs('items', sid);
  const series = useDocs('series', sid);
  const seriesId = item?.seriesId;
  return useMemo(() => {
    if (!seriesId || !item) return null;
    const list = seriesItemsOf(items, seriesId);
    const doc = series[seriesId];
    return { series: doc && !doc.deletedAt ? doc : undefined, list, index: list.findIndex((d) => d.id === item.id) };
  }, [items, series, seriesId, item]);
}

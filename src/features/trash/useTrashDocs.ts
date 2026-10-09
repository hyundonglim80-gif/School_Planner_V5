// 휴지통이 보는 문서 묶음 (지운 표시가 붙는 컬렉션 - 휴지통 창·자동 비우기가 함께 쓴다). 컬렉션이 늘면 여기와 actions.TrashDocs에.
import { useMemo } from 'react';
import { useDocs } from '../../data/select';
import type { TrashDocs } from './actions';

export function useTrashDocs(sid: string | null): TrashDocs {
  const items = useDocs('items', sid);
  const labels = useDocs('labels', sid);
  const timetables = useDocs('timetables', sid);
  const progress = useDocs('progress', sid);
  const classes = useDocs('classes', sid);
  const seating = useDocs('seating', sid);
  const evaluations = useDocs('evaluations', sid);
  return useMemo(() => ({ items, labels, timetables, progress, classes, seating, evaluations }), [items, labels, timetables, progress, classes, seating, evaluations]);
}

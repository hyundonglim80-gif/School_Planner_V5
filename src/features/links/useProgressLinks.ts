// 메모 id → 그 메모를 이은 진도 차시 (P10-4 - 진도 쪽에만 적혀 있어 계산한다). 메모 카드의 🔗 n에 더한다.
import { useMemo } from 'react';
import { useDocs } from '../../data/select';
import { progressLinksByNote } from './linkOps';

export function useProgressNoteLinks(sid: string | null | undefined): Map<string, string[]> {
  const docs = useDocs('progress', sid);
  return useMemo(() => progressLinksByNote(docs), [docs]);
}

// 남은 쓰던 글 줄들 (P14-6 ■1b) - 보관(data/drafts)이 바뀌면 다시 읽는다. 창 'drafts'와 앱을 열 때 띠가 함께 쓴다.
import { useEffect, useState } from 'react';
import { listDrafts, onDraftsChange } from '../../data/drafts';
import { draftPlace, draftSummary, type DraftPlace } from './draftList';

export interface DraftRowView {
  key: string;
  place: DraftPlace;
  summary: string;
  savedAt: number;
}

export async function readDraftRows(uid: string): Promise<DraftRowView[]> {
  const out: DraftRowView[] = [];
  for (const d of await listDrafts(uid)) {
    const place = draftPlace(d.key, d.value);
    if (place) out.push({ key: d.key, place, summary: draftSummary(d.value), savedAt: d.savedAt });
  }
  return out;
}

/** 줄들 (처음 읽기 전에는 null) */
export function useDraftRows(uid: string | null): DraftRowView[] | null {
  const [rows, setRows] = useState<DraftRowView[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const load = () =>
      void readDraftRows(uid).then((r) => {
        if (alive) setRows(r);
      });
    load();
    const off = onDraftsChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [uid]);
  return rows;
}

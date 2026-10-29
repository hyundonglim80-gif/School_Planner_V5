// 저장하지 않은 글 창 'drafts' 열기 · 줄의 칸 열기 (P14-6 ■1b).
import { openWindow } from '../../app/windows';
import { openEventPanel } from '../events/open';
import { openNotePanel } from '../notes/open';
import type { DraftRowView } from './useDraftRows';

export const DRAFTS_WINDOW = 'drafts';

export function openDraftsWindow() {
  openWindow(DRAFTS_WINDOW);
}

/** 그 글의 칸을 같은 보관 열쇠로 다시 연다 → 칸 맨 위 '되살리기' */
export function openDraftRow({ place }: Pick<DraftRowView, 'place'>) {
  if (place.kind === 'note') openNotePanel({ sid: place.sid, date: place.date, ...(place.id ? { id: place.id } : {}) });
  else if (place.date) openEventPanel({ sid: place.sid, date: place.date, ...(place.id ? { id: place.id } : {}) });
}

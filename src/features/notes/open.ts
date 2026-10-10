// 메모·기록 쓰는 칸 열기 (하루 화면 기록 칸·메모 화면·＋ 새로·링크가 함께 쓴다). 창 목록의 쓰는 칸 'note'.
//
// - 새로 쓰는 칸 = { sid, date } - date가 있으면 그날 기록, null이면 메모. 같은 공간·같은 자리의 새 칸이 열려 있으면 그 탭을 보인다.
// - 수정 칸 = { sid, date, id } - 같은 항목이면 그 탭(자리는 보지 않는다 - 항목은 id로 찾는다, 원칙 2).
// - 저장한 새 칸은 그 항목의 수정 칸이 된다(setParams로 id를 더한다 - 적은 것은 그대로 남는다). 메모·기록 모두 같은 칸이다(V4 EntryDrawer).
import { closeWindow, getWindowDef, openWindow, useWindows } from '../../app/windows';
import { showToast } from '../../app/toast';
import type { YMD } from '../../data/types';

export const NOTE_PANEL = 'note';

export interface NotePanelParams {
  /** 칸을 연 순간의 공간 - 저장은 여기에 (V4 규칙) */
  sid: string;
  /** 새로 쓸 자리: 날짜면 그날 기록, null이면 메모. 수정 칸은 연 때의 자리(보이기만) */
  date: YMD | null;
  /** 고치는 항목 (없으면 새로) */
  id?: string;
  /** 새 칸에 미리 골라 둘 라벨 (라벨로 보기에서 고른 것 - P4-1) */
  labelIds?: string[];
  /** 새 칸에 미리 적어 둘 글 (공유받은 글 - P8-3) */
  draftText?: string;
  /** 공유받은 파일 - 칸에서 '드라이브에 올려 첨부'를 눌러야 올라간다 (P8-3) */
  draftFiles?: File[];
  /** 링크 연결 창의 '+ 새 00 만들어 연결' 쪽지 - 처음 저장하면 만든 항목을 연결 창에 돌려준다(links/open deliverLinkPick) */
  pickFor?: string;
}

export const sameNotePanel = (a: NotePanelParams, b: NotePanelParams) =>
  a.sid === b.sid && (a.id || b.id ? a.id === b.id : (a.date ?? null) === (b.date ?? null));

export function openNotePanel(params: NotePanelParams) {
  if (!getWindowDef(NOTE_PANEL)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(NOTE_PANEL, params);
}

/** 이 항목을 고치던 칸을 모두 닫는다 (지웠을 때) */
export function closeNotePanelsFor(sid: string, id: string) {
  for (const w of useWindows.getState().windows) {
    const p = w.params as NotePanelParams | undefined;
    if (w.id === NOTE_PANEL && p?.sid === sid && p.id === id) closeWindow(w.key);
  }
}

/** 지금 수정 칸이 열린 항목 id (카드를 파란 테두리로 짚는다) */
export function useEditingNoteIds(sid: string | null): ReadonlySet<string> {
  const key = useWindows((s) =>
    s.windows
      .filter((w) => w.id === NOTE_PANEL)
      .map((w) => w.params as NotePanelParams)
      .filter((p) => p.id && p.sid === sid)
      .map((p) => p.id)
      .join('\u0000'),
  );
  // 글자 열쇠로 받아 새 Set을 그릴 때마다 만들지 않는다 (같은 열쇠면 같은 Set)
  return editingSet(key);
}

let lastKey = '';
let lastSet: ReadonlySet<string> = new Set();
function editingSet(key: string): ReadonlySet<string> {
  if (key !== lastKey) {
    lastKey = key;
    lastSet = new Set(key ? key.split('\u0000') : []);
  }
  return lastSet;
}

// ── 그날 기록 보기 (주간·월간·년간 날짜 옆 📝 n - 창 'dayNotes') ──
export const DAY_NOTES = 'dayNotes';

export interface DayNotesParams {
  sid: string;
  date: YMD;
}

export const sameDayNotes = (a: DayNotesParams, b: DayNotesParams) => a.sid === b.sid && a.date === b.date;

export function openDayNotes(params: DayNotesParams) {
  if (getWindowDef(DAY_NOTES)) openWindow(DAY_NOTES, params);
}

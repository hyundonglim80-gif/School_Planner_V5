// 일정 칸 열기 (하루·주간·월간·년간·＋ 새로가 함께 쓴다). 창 목록의 쓰는 칸 'event'.
//
// - 새 일정 칸 = { sid, date } - 같은 공간·같은 날의 새 일정 칸이 열려 있으면 그 탭을 보인다.
// - 수정 칸 = { sid, date, id } - 같은 일정이면 그 탭(날짜는 보지 않는다 - 항목은 id로 찾는다, 원칙 2).
// - 저장한 새 일정 칸은 그 일정의 수정 칸이 된다(setParams로 id를 더한다 - 적은 것은 그대로 남는다).
import { closeWindow, getWindowDef, openWindow, useWindows } from '../../app/windows';
import { showToast } from '../../app/toast';
import type { YMD } from '../../data/types';

export const EVENT_PANEL = 'event';

export interface EventPanelParams {
  /** 칸을 연 순간의 공간 - 저장은 여기에 (V4 규칙) */
  sid: string;
  /** 새 일정: 저장할 날. 수정: 연 날 */
  date: YMD;
  /** 고치는 일정 (없으면 새 일정) */
  id?: string;
  /** 새 일정 칸에 미리 적어 둘 글 (학사일정 '일정으로 담기' - P6-3) */
  draftText?: string;
  /** 새 일정 칸을 '🔁 반복' 줄을 편 채로 (단축키 '반복 일정' - MENU 3-8) */
  recur?: boolean;
}

export const sameEventPanel = (a: EventPanelParams, b: EventPanelParams) =>
  a.sid === b.sid && (a.id || b.id ? a.id === b.id : a.date === b.date);

export function openEventPanel(params: EventPanelParams) {
  if (!getWindowDef(EVENT_PANEL)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(EVENT_PANEL, params);
}

/** 이 일정을 고치던 칸을 모두 닫는다 (지웠을 때) */
export function closeEventPanelsFor(sid: string, id: string) {
  for (const w of useWindows.getState().windows) {
    const p = w.params as EventPanelParams | undefined;
    if (w.id === EVENT_PANEL && p?.sid === sid && p.id === id) closeWindow(w.key);
  }
}

/** 지금 수정 칸이 열린 일정 id (목록에서 파란 테두리로 짚는다) */
export function useEditingEventIds(sid: string | null): ReadonlySet<string> {
  const key = useWindows((s) =>
    s.windows
      .filter((w) => w.id === EVENT_PANEL)
      .map((w) => w.params as EventPanelParams)
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

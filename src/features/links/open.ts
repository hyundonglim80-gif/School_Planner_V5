// 링크 창 열기 (V4 LinkerModal·LinkViewerModal 여는 길). 창 목록의 'linker'(🔗 링크 연결)·'links'(📑 연결된 항목).
//   openLinker({ sid, id })        - 일정·기록·메모 칸의 '🔗 링크 추가' (그 항목에 잇는다)
//   openLinkViewer({ sid, id })    - 카드의 '🔗 n' (그 항목에 이은 것을 본다 - 같은 항목이면 그 탭)
// '+ 새 00 만들어 연결': 연결 창이 쓰는 칸을 열 때 pickFor(쪽지)를 넘기고, 그 칸이 처음 저장하면 deliverLinkPick으로
// 만든 항목 id를 연결 창에 돌려준다 - 연결 창은 그것을 담아 둔다(V4 handleCreated).
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';

export const LINKER = 'linker';
export const LINK_VIEWER = 'links';

export interface LinkWindowParams {
  /** 항목이 있는 공간 */
  sid: string;
  /** 링크를 더하거나 볼 항목 */
  id: string;
}

export const sameLinkWindow = (a: LinkWindowParams, b: LinkWindowParams) => a.sid === b.sid && a.id === b.id;

function openIf(id: string, params: LinkWindowParams) {
  if (!getWindowDef(id)) {
    showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
    return;
  }
  openWindow(id, params);
}

export const openLinker = (params: LinkWindowParams) => openIf(LINKER, params);
export const openLinkViewer = (params: LinkWindowParams) => openIf(LINK_VIEWER, params);

// ── '+ 새 00 만들어 연결' 쪽지 ──
const pickers = new Map<string, (id: string) => void>();
let seq = 0;

/** 연결 창이 쪽지를 만든다 (창이 닫히면 off) */
export function listenLinkPick(onPick: (id: string) => void): { token: string; off: () => void } {
  const token = `pick${++seq}`;
  pickers.set(token, onPick);
  return { token, off: () => pickers.delete(token) };
}

/** 쓰는 칸이 처음 저장하면 쪽지의 주인(연결 창)에게 만든 항목을 돌려준다 (연결 창이 닫혔으면 아무 일도 없다) */
export function deliverLinkPick(token: string | undefined, id: string) {
  if (token) pickers.get(token)?.(id);
}

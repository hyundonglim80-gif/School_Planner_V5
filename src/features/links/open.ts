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
// 쪽지에는 잇는 쪽(공간·항목)을 적는다 - 쓰는 칸이 처음 저장하면 곧바로 잇는다(P28-1 사용자 요청, links/actions deliverLinkPick).
// 연결 창이 그새 닫혔어도 잇는다('만들어 연결'을 누른 뜻). 창이 열려 있으면 onPick으로 알린다(닫기·안내).

/**
 * 연결 창에 알리기. ok = 이어 저장했나(못 했으면 연결 창이 🛒에 담아 '연결 저장'으로 다시).
 * 돌려준 글은 저장 안내 뒤에 붙는다(담아 둔 다른 것 안내).
 */
export type LinkPickListener = (made: string, ok: boolean) => string | void;

export interface LinkPick extends LinkWindowParams {
  onPick?: LinkPickListener;
}

const pickers = new Map<string, LinkPick>();
let seq = 0;

/** 연결 창이 쪽지를 만든다 (창이 닫히면 off - 쪽지는 남아 그 뒤 저장해도 잇는다) */
export function listenLinkPick(at: LinkWindowParams, onPick: LinkPickListener): { token: string; off: () => void } {
  const token = `pick${++seq}`;
  const pick: LinkPick = { sid: at.sid, id: at.id, onPick };
  pickers.set(token, pick);
  return {
    token,
    off: () => {
      pick.onPick = undefined;
    },
  };
}

/** 쪽지가 가리키는 잇는 쪽 (모르는 쪽지면 undefined) */
export function linkPickOf(token: string | undefined): LinkPick | undefined {
  return token ? pickers.get(token) : undefined;
}

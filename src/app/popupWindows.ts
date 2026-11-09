// 환경설정 '창 위치' = 팝업창 (11-09 사용자 요청 - PC의 '가운데 창 (예전 방식)'을 바꿨다).
//
//   - PC에서 고르면 모든 창(검색·환경설정 … 메모·일정을 쓰는 칸까지)이 **브라우저 팝업창**으로 뜬다 - 오른쪽 칸 ↗(app/popout)와 같은 창이라
//     브라우저 밖·다른 모니터로 옮길 수 있다. 창 목록(app/windows.openWindow)이 열기 전에 여기로 넘긴다.
//   - 팝업창은 같은 앱을 주소 ?popout= 로 따로 띄운다(app/PopoutShell) - 그래서 열 때 1~2초 걸린다.
//   - 이 창 안에 띄우는 것(앱 안 가운데 창, 쓰는 칸은 오른쪽 칸):
//       · 연 창으로 값을 돌려주는 창(링크 고르기 pickFor·공유받은 파일처럼 글자로 옮길 수 없는 것 - portableParams)
//       · 방금 누르지 않았을 때(알림을 눌러 열기 등) - 브라우저가 막으므로 열어 보지 않는다
//       · 브라우저가 팝업을 막았을 때 - 한 번 알린다
//   - 이미 연 팝업창의 같은 창을 다시 열면 새로 띄우지 않고 그 팝업창을 앞으로(그 안에서 다시 연다).
//   - 팝업창 안에서 화면을 옮기는 일(검색 결과 누르기·그날로 가기)은 연 창(큰 창)으로 보낸다(sendNavToOpener).
//   - 팝업창의 자리·크기는 창마다 이 기기에 남겨 다음에 그 자리에 연다(rememberPopupRect).
// 창 목록을 import하지 않는다(창 목록이 이것을 부른다) - 팝업창 안에서 다시 열기는 부르는 쪽이 넘긴다.
import { useEffect } from 'react';
import { CLIPBOARD_POPOUT_ID, POPOUT, popoutUrl } from '../ui/popout';
import { useNav, type NavState } from './nav';
import { SCOPES } from './route';
import { showToast } from './toast';

const MSG = 'sp5-popup';

type BridgeMessage =
  | { kind: typeof MSG; type: 'open'; id: string; params: unknown }
  | { kind: typeof MSG; type: 'params'; id: string; params: unknown }
  | { kind: typeof MSG; type: 'nav'; nav: Pick<NavState, 'scope' | 'date' | 'classId'> };

interface OpenedPopup {
  id: string;
  /** 지금 그 팝업창이 그린 창의 params (새 메모가 저장되면 그 메모 id로 바뀐다 - 팝업창이 알린다) */
  params: unknown;
  win: Window;
}

/** 이 창이 연 팝업창 (닫힌 것은 열 때 걷는다) */
const opened: OpenedPopup[] = [];

/**
 * 팝업창으로 옮길 수 있는 params인가 - 글자(JSON)로 옮겨도 뜻이 그대로여야 한다.
 * 함수·파일(Blob)이 들었거나 연결 창 쪽지(pickFor - 이 창의 연결 창에만 돌아간다)가 있으면 아니다.
 */
export function portableParams(v: unknown, depth = 0): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'function' || typeof v === 'symbol') return false;
  if (typeof v !== 'object') return true;
  if (typeof Blob !== 'undefined' && v instanceof Blob) return false;
  if (depth > 6) return true;
  if (Array.isArray(v)) return v.every((x) => portableParams(x, depth + 1));
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (k === 'pickFor' && x !== undefined && x !== null) return false;
    if (!portableParams(x, depth + 1)) return false;
  }
  return true;
}

/** 같은 창·같은 params면 같은 이름 - 큰 창을 새로고침한 뒤 다시 열어도 그 팝업창을 찾는다 */
export function popupName(id: string, params: unknown): string {
  const s = JSON.stringify(params ?? null);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `sp5-pop-${id}-${h.toString(36)}`;
}

// ── 자리·크기 (창마다 이 기기에) ──

const RECT_KEY = 'sp5-popup-rects';
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function readRects(): Record<string, Rect> {
  try {
    const v = JSON.parse(localStorage.getItem(RECT_KEY) || '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, Rect>) : {};
  } catch {
    return {};
  }
}

const okRect = (r: Rect | undefined): r is Rect =>
  !!r && [r.x, r.y, r.w, r.h].every((n) => typeof n === 'number' && Number.isFinite(n)) && r.w >= 200 && r.h >= 200;

/** 새 팝업창 자리 - 남겨 둔 자리, 없으면 큰 창 오른쪽에 오른쪽 칸 폭으로(여럿이면 조금씩 비켜). 클립보드는 왼쪽에 좁게(#140 - 옛 왼쪽 칸 자리) */
export function popupFeatures(id: string): string {
  const saved = readRects()[id];
  if (okRect(saved)) return `popup=yes,width=${Math.round(saved.w)},height=${Math.round(saved.h)},left=${Math.round(saved.x)},top=${Math.round(saved.y)}`;
  const shift = 28 * (opened.filter((p) => !p.win.closed).length % 8);
  const onLeft = id === CLIPBOARD_POPOUT_ID;
  const width = onLeft ? 380 : 528;
  const height = Math.max(480, (window.outerHeight || 800) - 80);
  const left = onLeft ? Math.max(0, window.screenX + 8) : Math.max(0, window.screenX + (window.outerWidth || 1400) - width - 8 - shift);
  const top = Math.max(0, window.screenY + 40 + shift);
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

/** 팝업창 안에서 - 이 창의 자리·크기를 남긴다(옮기기는 알림이 없어 잠깐마다 본다). 그만두는 함수를 돌려준다 */
export function rememberPopupRect(id: string): () => void {
  let last = '';
  const save = () => {
    const r: Rect = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight };
    if (!okRect(r)) return;
    const s = JSON.stringify(r);
    if (s === last) return;
    last = s;
    try {
      localStorage.setItem(RECT_KEY, JSON.stringify({ ...readRects(), [id]: r }));
    } catch {
      /* 남기지 못하면 다음에 기본 자리 */
    }
  };
  const timer = window.setInterval(save, 1500);
  window.addEventListener('pagehide', save);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('pagehide', save);
  };
}

// ── 열기 ──

let toldBlocked = false;

function post(win: Window | null | undefined, msg: BridgeMessage) {
  try {
    if (win && !win.closed) win.postMessage(msg, window.location.origin);
  } catch {
    /* 닫히는 중 */
  }
}

/**
 * 창을 팝업창으로 연다. 띄웠으면(이미 열린 팝업창을 앞으로 가져왔으면) true. 못 띄웠으면 false - 부르는 쪽이 이 창 안에 띄운다.
 * same = 창 목록의 '같은 창인가'(그 창 id의 sameAs). 누른 일(click·키) 안에서 불러야 브라우저가 막지 않는다.
 */
export function openPopupWindow(id: string, params: unknown, same: (p: unknown) => boolean): boolean {
  for (let i = opened.length - 1; i >= 0; i--) if (opened[i].win.closed) opened.splice(i, 1);
  const live = opened.find((p) => p.id === id && same(p.params));
  if (live) {
    post(live.win, { kind: MSG, type: 'open', id, params });
    live.win.focus();
    return true;
  }
  // 방금 누르지 않았으면 브라우저가 막는다 - 열어 보지 않고 이 창 안에 (막힘 표시가 주소창에 남지 않게)
  const act = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  if (act && !act.isActive) return false;
  let win: Window | null = null;
  try {
    win = window.open('', popupName(id, params), popupFeatures(id));
  } catch {
    win = null;
  }
  if (!win) {
    if (!toldBlocked) {
      toldBlocked = true;
      showToast('브라우저가 팝업창을 막아 이 창 안에 띄웠습니다. 주소창 오른쪽의 팝업 차단 표시를 눌러 이 사이트를 허용해 주세요.', 6000);
    }
    return false;
  }
  // 같은 이름의 팝업창이 이미 있으면(큰 창을 새로고침했을 때) 새로 읽지 않고 그 안에서 다시 연다 - 적던 글이 남는다
  let already = false;
  try {
    already = win.location.href !== 'about:blank' && new URL(win.location.href).origin === window.location.origin;
  } catch {
    already = false;
  }
  if (already) {
    post(win, { kind: MSG, type: 'open', id, params });
  } else {
    try {
      win.document.title = '여는 중…';
      win.document.body.style.cssText = 'margin:0;font:14px sans-serif;color:#64748b;display:flex;align-items:center;justify-content:center;height:100vh';
      win.document.body.textContent = '여는 중…';
    } catch {
      // 빈 창에 글을 못 써도 여는 데는 지장이 없다
    }
    win.location.replace(popoutUrl(id, params, window.location.href));
  }
  opened.push({ id, params, win });
  win.focus();
  return true;
}

// ── 팝업창 ↔ 연 창 ──

/** 팝업창 안에서 - 그린 창이 가리키는 것이 바뀌었다고 연 창에 알린다(새 메모가 저장되어 그 메모의 수정 칸이 됐을 때) */
export function sendParamsToOpener(id: string, params: unknown) {
  if (POPOUT && portableParams(params)) post(window.opener as Window | null, { kind: MSG, type: 'params', id, params });
}

/** 팝업창 안에서 - 화면을 옮긴다(검색 결과·그날로 가기). 연 창이 팝업창이면 그 창이 다시 제 연 창으로 보낸다 */
export function sendNavToOpener(nav: Pick<NavState, 'scope' | 'date' | 'classId'>) {
  if (POPOUT) post(window.opener as Window | null, { kind: MSG, type: 'nav', nav });
}

const isBridge = (d: unknown): d is BridgeMessage => !!d && typeof d === 'object' && (d as { kind?: unknown }).kind === MSG;

/**
 * 팝업창과 주고받기 (큰 창의 껍데기·팝업창 껍데기에서 한 번). openHere = 팝업창 안에서 '그 창을 다시 열기'(창 목록의 openWindow를 이 창 안에).
 */
export function usePopupBridge(openHere?: (id: string, params: unknown) => void) {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !isBridge(e.data)) return;
      const m = e.data;
      if (m.type === 'open') {
        openHere?.(m.id, m.params);
      } else if (m.type === 'params') {
        const p = opened.find((x) => x.win === e.source);
        if (p && p.id === m.id) p.params = m.params;
      } else if (m.type === 'nav') {
        const { scope, date, classId } = m.nav;
        if (!SCOPES.includes(scope) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        if (POPOUT) sendNavToOpener({ scope, date, classId: classId ?? null });
        else useNav.setState({ scope, date, classId: classId ?? null });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [openHere]);
}

/** 시험에서만 */
export function resetPopupWindowsForTest() {
  opened.length = 0;
  toldBlocked = false;
}

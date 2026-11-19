// 오른쪽 칸을 새 창(브라우저 팝업 창)으로 옮기기 (10-28 사용자 요청 - 화면 밖·다른 모니터에 따로 둔다).
//
//   - 오른쪽 줄에 붙은 창·쓰는 칸의 머리 ↗(ui/PopoutButton) = 그 칸을 새 창으로 옮긴다(app/popout.popOutWindow).
//   - 새 창은 같은 앱을 주소 `?popout={창 id·params}`로 열어 **그 창 하나만** 창 가득 그린다(app/PopoutShell).
//     로그인·기기 사본은 이 기기의 것을 함께 쓰고, 다른 탭처럼 서버와 따로 맞춘다 - 같은 JS가 아니라서 키·portal·폭이 그 창 것이다.
//   - 새 창 안에서 연 다른 창(링크 연결 등)은 새 창 가운데에 뜬다(오른쪽 줄에 붙지 않는다 - useDocked가 늘 false).
// 여기는 순수한 것(주소 읽기·만들기)과 틀이 보는 context만 - 여는 일은 app/popout.
import { createContext } from 'react';

export const POPOUT_PARAM = 'popout';

/**
 * 클립보드 창의 id (= 단축키 id). 큰 창에서는 창 목록의 창 '📋 클립보드' 탭(P47-1 - features/clipboard/ClipboardWindow),
 * 창 위치 '팝업창'이면 같은 id의 팝업창(#140) - 그 팝업창은 창 틀 없이 app/App이 따로 그린다(features/clipboard/ClipboardPopout)
 */
export const CLIPBOARD_POPOUT_ID = 'clipboard';

/** 새 창이 그릴 창 */
export interface PopoutSpec {
  /** 창 목록의 id ('note'·'search' …) */
  id: string;
  params: unknown;
}

/** 주소의 ?popout= 를 읽는다. 없거나 모양이 틀리면 null */
export function readPopoutSpec(search: string): PopoutSpec | null {
  try {
    const raw = new URLSearchParams(search).get(POPOUT_PARAM);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PopoutSpec> | null;
    return v && typeof v.id === 'string' && v.id ? { id: v.id, params: v.params ?? undefined } : null;
  } catch {
    return null;
  }
}

/**
 * 창을 새 창으로 여는 주소. 지금 주소의 다른 물음(에뮬레이터 ?as= 등)은 두고, 화면 주소(#)는 뺀다.
 * params는 글자로 옮길 수 있는 것만 - 파일(공유받은 파일)과 연결 창 쪽지(pickFor - 이 창의 연결 창에만 돌아간다)는 뺀다.
 */
export function popoutUrl(id: string, params: unknown, href: string): string {
  const url = new URL(href);
  url.hash = '';
  const clean: unknown = JSON.parse(
    JSON.stringify(params ?? null, (k, v: unknown) =>
      k === 'pickFor' || (typeof Blob !== 'undefined' && (v instanceof Blob || (Array.isArray(v) && v.some((x) => x instanceof Blob)))) ? undefined : v,
    ),
  );
  url.searchParams.set(POPOUT_PARAM, JSON.stringify({ id, params: clean ?? undefined }));
  return url.toString();
}

/** 이 탭이 옮겨 온 새 창인가 (그렇다면 그릴 창) */
export const POPOUT: PopoutSpec | null = typeof window === 'undefined' ? null : readPopoutSpec(window.location.search);

/** 새 창이 창 가득 그리는 창(처음 연 그 창)의 key - app/PopoutShell이 연 뒤에 건다 */
let rootKey: number | null = null;
export const setPopoutRoot = (key: number | null) => {
  rootKey = key;
};
export const isPopoutRoot = (key: number) => POPOUT !== null && key === rootKey;

/**
 * 창 목록이 그린 창의 맨 바깥 틀에만 있는 것 (app/WindowHost가 건다, 틀이 제 안쪽에서는 null로 지운다 -
 * 창 안에서 띄운 작은 창이 '그 창'으로 셈되지 않게). fill = 새 창에서 창 가득 그린다.
 */
export const WindowSlotContext = createContext<{ key: number; fill: boolean } | null>(null);

/** 머리 ↗가 옮길 창 key - 오른쪽 줄에 붙은 틀이 제 안쪽에 건다(아니면 null = ↗를 그리지 않는다) */
export const PopoutTargetContext = createContext<number | null>(null);

// ── 새 창 안 분할 칸 (P43 11-17 사용자 요청) ──
// 새 창 안에서 연 창(링크 보기·링크 연결 …)은 가운데가 아니라 새 창 오른쪽에 나눠 붙는다(ui/sideColumn useDocked).
// 그때 새 창을 옆으로 넓혀 처음 칸이 좁아지지 않게 하고, 분할 칸이 모두 닫히면 되돌린다(app/PopoutShell).

/** 분할 칸 기본 폭 = 새 창의 반 (경계선을 끌면 그 새 창 안에서만 바뀐다) */
export const SPLIT_DEFAULT_WIDTH = '50vw';

/** 이만큼도 넓힐 수 없으면(이미 화면만큼 넓다 - 최대화) 그대로 두고 반씩 나눈다 */
const MIN_GROW_PX = 80;

/**
 * 분할 칸이 설 때 새 창을 얼마나 넓히고 옮길지. 두 배 폭까지, 그 화면 안에서(오른쪽이 넘치면 왼쪽으로 옮긴다).
 * win = 새 창의 화면 자리(screenX·outerWidth), screen = 그 화면의 쓸 수 있는 자리(availLeft·availWidth).
 * dx = 옆으로 옮길 만큼(왼쪽 -), dw = 넓힐 만큼. 넓히지 않으면 둘 다 0.
 */
export function splitGrowth(win: { x: number; width: number }, screen: { left: number; width: number }): { dx: number; dw: number } {
  const target = Math.min(win.width * 2, screen.width);
  const dw = Math.round(target - win.width);
  if (!(dw >= MIN_GROW_PX)) return { dx: 0, dw: 0 };
  const over = win.x + win.width + dw - (screen.left + screen.width);
  const dx = over > 0 ? -Math.min(over, Math.max(0, win.x - screen.left)) : 0;
  return { dx: Math.round(dx), dw };
}

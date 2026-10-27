// 오른쪽 칸을 새 창(브라우저 팝업 창)으로 옮기기 (10-28 사용자 요청 - 화면 밖·다른 모니터에 따로 둔다).
//
//   - 오른쪽 줄에 붙은 창·쓰는 칸의 머리 ↗(ui/PopoutButton) = 그 칸을 새 창으로 옮긴다(app/popout.popOutWindow).
//   - 새 창은 같은 앱을 주소 `?popout={창 id·params}`로 열어 **그 창 하나만** 창 가득 그린다(app/PopoutShell).
//     로그인·기기 사본은 이 기기의 것을 함께 쓰고, 다른 탭처럼 서버와 따로 맞춘다 - 같은 JS가 아니라서 키·portal·폭이 그 창 것이다.
//   - 새 창 안에서 연 다른 창(링크 연결 등)은 새 창 가운데에 뜬다(오른쪽 줄에 붙지 않는다 - useDocked가 늘 false).
// 여기는 순수한 것(주소 읽기·만들기)과 틀이 보는 context만 - 여는 일은 app/popout.
import { createContext } from 'react';

export const POPOUT_PARAM = 'popout';

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

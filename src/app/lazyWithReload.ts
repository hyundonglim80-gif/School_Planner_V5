// 창·화면 조각 싣기 (V4 lib/lazyWithReload.ts에서 옮김)
//
// 배포가 새로 나가면 자산 파일 이름이 바뀐다(SettingsModal-BwZ9B8To.js -> 다른 해시).
// 그런데 이미 열어 둔 탭은 옛 이름을 기억하고 있다. 그 상태에서 팝업을 열면
// 없는 파일을 받으러 가서 404가 나고, 화면이 하얗게 된다.
//   Failed to load resource: 404 (SettingsModal-BwZ9B8To.js)
//   Uncaught TypeError: Failed to fetch dynamically imported module
// F5를 누르면 새 이름을 받아오므로 그때는 잘 된다. 사용자가 그걸 알 리가 없다.
//
// 그래서 받아오기에 실패하면 한 번만 새로고침해 새 이름을 받아온다.
// 무한 새로고침을 막으려고 표시를 남긴다. 표시가 있는데 또 실패하면
// 새로고침으로 풀리는 문제가 아니므로 그대로 오류를 올린다.
//
// 끊겨서 못 받은 것은 다르다(10-29 휴대폰 - 새 판으로 연 바로 뒤, 서비스 워커가 이 판의 파일을 다 담기 전에 비행기 모드 →
// 새 메모 칸 '+ 추가'가 새로고침을 되풀이하다 '화면을 그리다 문제가 생겼습니다'). 새로고침해도 받을 수 없으니 하지 않고
// 대신 그림(offline - 창은 안내하고 닫기, 화면은 그 자리 안내)을 그린다. 다음에 그릴 때는 새로 받아 본다(크롬은 실패한 import를 다시 받는다).
import { createContext, createElement, lazy, useContext, useMemo, useReducer, type ComponentProps, type ComponentType } from 'react';
import { looksLikeStaleChunk } from '../domain/errorReport';

const RELOAD_MARK = 'sp5-chunk-reloaded';

/** 대신 그림이 쓴다 - renew = 다음에 그릴 때 새로 받게(창을 닫기 전에), retry = 지금 다시 그려 새로 받기(화면) */
const ChunkRetryContext = createContext<{ renew: () => void; retry: () => void }>({ renew: () => {}, retry: () => {} });
export const useChunkRetry = () => useContext(ChunkRetryContext);

// 인터넷이 이어지면 끊겨서 끝난 조각을 모두 새로 받게 한다 (그 화면을 떠나 있던 사이에 이어져도)
const renewers = new Set<() => void>();
if (typeof window !== 'undefined') window.addEventListener('online', () => renewers.forEach((renew) => renew()));

/** 서버에 닿나 - 닿지 않으면 새로고침해도 파일을 받을 수 없다 (서비스 워커는 asset-manifest.json을 가로채지 않는다) */
async function reachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    await fetch('/asset-manifest.json', { cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

export function lazyWithReload<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  /** 끊겨서 받지 못했을 때 그릴 것 (같은 props를 받는다) - 없으면 새로고침 갈래 그대로 */
  offline?: ComponentType<any>
): ComponentType<ComponentProps<T>> {
  // 끊겨서 대신 그림으로 끝난 lazy - 대신 그림이 renew·retry를 부를 때만 새 lazy로 바꾼다
  // (그리는 동안 바꾸면 React가 끝난 것을 다시 그리며 새 lazy를 곧바로 또 받아, 끊긴 동안 되풀이된다)
  const offlineDone = new WeakSet<object>();
  const make = () => {
    const chunk = lazy(async (): Promise<{ default: ComponentType<any> }> => {
      try {
        const mod = await load();
        // 한 번 제대로 받아왔으면 표시를 지운다 (다음 배포 때 다시 쓸 수 있게)
        try {
          sessionStorage.removeItem(RELOAD_MARK);
        } catch {
          /* 무시 */
        }
        return mod;
      } catch (err) {
        // 같은 문장 셈을 오류 알림(P14-2)도 쓴다 - 이 오류는 알리지 않는다
        if (!looksLikeStaleChunk(String((err as any)?.message || err || ''))) throw err;

        if (offline && !(await reachable())) {
          offlineDone.add(chunk);
          return { default: offline };
        }

        let already = false;
        try {
          already = sessionStorage.getItem(RELOAD_MARK) === '1';
          sessionStorage.setItem(RELOAD_MARK, '1');
        } catch {
          /* 세션 저장소를 못 쓰면 새로고침은 한 번만 시도한다 */
        }
        if (already) throw err;

        window.location.reload();
        // 새로고침이 시작되었으므로 이 약속은 끝내지 않는다
        return new Promise<{ default: T }>(() => {});
      }
    });
    return chunk;
  };
  let current = make();
  // React는 한 번 끝난 lazy를 그대로 기억한다 - 끊겨서 끝난 것이면 새 lazy로 (다음에 그릴 때 다시 받는다)
  const renew = () => {
    if (offlineDone.has(current)) current = make();
  };
  if (offline) renewers.add(renew);
  function Chunk(props: ComponentProps<T>) {
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const ctx = useMemo(() => ({ renew, retry: () => (renew(), bump()) }), []);
    return createElement(ChunkRetryContext.Provider, { value: ctx }, createElement(current, props));
  }
  return Chunk;
}

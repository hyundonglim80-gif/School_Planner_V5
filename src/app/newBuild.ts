// 새 판 알리기 (P8-3 오프라인 앱). 서비스 워커는 문서를 네트워크 먼저 받지만, 열어 둔 탭은 옛 판을 계속 돌린다.
// 창으로 돌아올 때·30분마다 '/'를 새로 받아 첫 스크립트(해시 붙은 /assets/index-….js)가 지금 것과 다르면 본문 위 띠로 알린다.
// 개발 서버는 그 스크립트가 없어 보지 않는다.
import { useEffect } from 'react';
import { create } from 'zustand';

export const useNewBuild = create<{ ready: boolean }>(() => ({ ready: false }));

const ENTRY = /<script[^>]*type="module"[^>]*src="([^"]*\/assets\/[^"]+\.js)"/;

export const entryOf = (html: string): string | null => html.match(ENTRY)?.[1] ?? null;

function currentEntry(): string | null {
  return document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute('src') ?? null;
}

export async function checkNewBuild(): Promise<void> {
  const mine = currentEntry();
  if (!mine || useNewBuild.getState().ready) return;
  try {
    const res = await fetch('/', { cache: 'no-store' });
    if (!res.ok) return;
    const next = entryOf(await res.text());
    if (next && next !== mine) useNewBuild.setState({ ready: true });
  } catch {
    // 오프라인 - 다음에
  }
}

/** Shell이 한 번 */
export function useNewBuildCheck(): void {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkNewBuild();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(() => void checkNewBuild(), 30 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, []);
}

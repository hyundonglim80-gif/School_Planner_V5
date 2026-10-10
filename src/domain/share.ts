// 공유받기 (Web Share Target - V4 lib/shareTarget.ts의 순수 부분, P8-3). 받기는 public/sw.js, 꺼내기는 features/share/receive.

/** 서비스 워커가 받은 것을 두는 캐시 (public/sw.js와 같은 이름·열쇠) */
export const SHARE_CACHE = 'sp5share-inbox';
export const shareKey = (origin: string, id: string, part: string) => `${origin}/__sp5share/${id}/${part}`;

/** 제목·글·주소를 한 덩어리 글로 (앱마다 넣는 칸이 달라 이미 든 것은 다시 적지 않는다) */
export function composeSharedText(title?: string, text?: string, url?: string): string {
  const t = (title || '').trim();
  const body = (text || '').trim();
  const u = (url || '').trim();
  const lines: string[] = [];
  if (t && !body.includes(t)) lines.push(t);
  if (body) lines.push(body);
  if (u && !body.includes(u) && !t.includes(u)) lines.push(u);
  return lines.join('\n');
}

/** 주소에 공유받은 표시가 있나 (?share=… 또는 GET으로 온 title·text·url) */
export function hasSharedParams(search: string): boolean {
  const p = new URLSearchParams(search);
  return p.has('share') || p.has('text') || p.has('url') || p.has('title');
}

/** 주소에서 공유 표시를 지운다 (새로고침해도 다시 열리지 않게). 다른 값(?as= 등)과 # 뒤는 둔다 */
export function stripSharedParams(href: string): string {
  const u = new URL(href);
  for (const k of ['share', 'title', 'text', 'url']) u.searchParams.delete(k);
  return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '') + u.hash;
}

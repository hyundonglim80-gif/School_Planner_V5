// 다른 앱에서 공유받은 것을 새 메모 쓰는 칸에 채워 연다 (V4 hooks/useShareReceiver·lib/shareTarget takeSharedPayload, P8-3).
// 흐름: 휴대폰 공유 창에서 SP5를 고르면 manifest의 share_target대로 '/share-target'에 POST → 서비스 워커(public/sw.js)가
// 글·파일을 캐시에 넣고 '/?share=<id>'로 연다 → 로그인한 뒤 Shell이 여기서 꺼내 **개인 공간의 새 메모 칸**에 채운다(저장은 사용자가 누를 때만).
import { useEffect } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { composeSharedText, hasSharedParams, SHARE_CACHE, shareKey, stripSharedParams } from '../../domain/share';
import { useSession } from '../../data/session';
import { personalSpaceId } from '../../data/space';
import { openNotePanel } from '../notes/open';

export interface SharedPayload {
  text: string;
  files: File[];
}

interface ShareMeta {
  title?: string;
  text?: string;
  url?: string;
  files?: Array<{ key: string; name: string; type: string }>;
}

/** 받은 것을 꺼내고 주소·캐시에서 지운다. 없으면 null. 서비스 워커가 받다가 실패했으면('?share=error') 던진다 */
export async function takeSharedPayload(loc: Location = window.location): Promise<SharedPayload | null> {
  if (!hasSharedParams(loc.search)) return null;
  const params = new URLSearchParams(loc.search);
  history.replaceState(history.state, '', stripSharedParams(loc.href));
  const id = params.get('share');
  if (!id) {
    // GET으로 온 경우 (서비스 워커 없이 열린 설치본 등)
    const text = composeSharedText(params.get('title') ?? '', params.get('text') ?? '', params.get('url') ?? '');
    return text ? { text, files: [] } : null;
  }
  if (id === 'error') throw new Error('공유받은 내용을 읽지 못했습니다.');
  if (!/^[a-z0-9]+$/i.test(id) || typeof caches === 'undefined') return null;
  const cache = await caches.open(SHARE_CACHE);
  const metaKey = shareKey(loc.origin, id, 'meta');
  const metaRes = await cache.match(metaKey);
  // 이미 꺼냈다(뒤로 가기로 다시 온 주소 등)
  if (!metaRes) return null;
  const meta = (await metaRes.json()) as ShareMeta;
  const files: File[] = [];
  for (const f of meta.files ?? []) {
    const res = await cache.match(f.key);
    if (!res) continue;
    const blob = await res.blob();
    files.push(new File([blob], f.name, { type: f.type || blob.type }));
    await cache.delete(f.key);
  }
  await cache.delete(metaKey);
  const text = composeSharedText(meta.title, meta.text, meta.url);
  return text || files.length > 0 ? { text, files } : null;
}

// 꺼내기는 한 번만 (꺼내면 주소·캐시에서 지운다). StrictMode가 효과를 두 번 돌려도 같은 약속을 기다린다.
let taking: Promise<SharedPayload | null> | null = null;
let opened = false;

/** Shell이 한 번 부른다 (로그인한 뒤에만 그려지므로 로그인 화면을 거쳐 와도 주소의 '?share='는 남아 있다) */
export function useShareReceiver(): void {
  const uid = useSession((s) => s.user?.uid);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    taking ??= takeSharedPayload();
    taking
      .then((payload) => {
        if (cancelled || !payload || opened) return;
        opened = true;
        openNotePanel({ sid: personalSpaceId(uid), date: null, draftText: payload.text, ...(payload.files.length > 0 ? { draftFiles: payload.files } : {}) });
        showToast(
          payload.files.length > 0
            ? "📥 공유받은 내용을 새 메모에 담았습니다. 파일은 '드라이브에 올려 첨부'를 누르고 저장하세요."
            : '📥 공유받은 내용을 새 메모에 담았습니다. 저장을 눌러야 남습니다.',
        );
      })
      .catch((e: unknown) => {
        if (!cancelled && !opened) {
          opened = true;
          showErrorToast('공유받은 내용을 읽지 못했습니다. 다시 공유해 주세요.', e);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
}

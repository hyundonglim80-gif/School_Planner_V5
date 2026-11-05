// Claude 답 받기 (P23-3) - Shell에 하나(큰 창만 - 새 창(↗)은 하지 않는다, 쪽지·대화와 같다).
//   - 앱을 연 뒤 온 답: '🤖 Claude 답이 왔습니다 - ✅ 배포됨 · 보기'(→ 그 메모 칸). 그 메모 칸이 보이면 띄우지 않는다. 다른 앱을 보는 동안도(돌아오기 전에 사라진다 - OS 알림이 뜬다). 답은 한 번에 하나씩 오므로 모으지 않는다.
//   - 푸시 알림을 눌러 연 앱: 주소 '?claude=<메모 id>'(public/sw.js notificationclick)를 꺼내 지우고 그 메모 칸(?chat= 본보기).
//   - 열린 앱 창에서 알림을 누름: 서비스 워커 메시지 'sp5-open-claude'.
// 요청은 개인 공간 메모뿐이고 개인 공간 사본은 보는 공간과 상관없이 늘 돈다 - 그룹을 보던 중에도 칸이 열린다.
import { useEffect } from 'react';
import { showToast } from '../../app/toast';
import { shownWindowNow } from '../../app/windows';
import { useClaudeRequests } from '../../data/claudeRequestStore';
import { usePersonalSpaceId } from '../../data/session';
import { claudeAnsweredNow, claudeBadge, claudeParamOf, stripClaudeParam } from '../../domain/claudeRequest';
import { NOTE_PANEL, openNotePanel, type NotePanelParams } from './open';

const NOTICE_MS = 6000;

/** 그 메모 칸이 지금 보이나 - 보이면 답이 말풍선에 곧바로 뜬다 */
function noteShown(sid: string, itemId: string): boolean {
  const w = shownWindowNow();
  const p = w?.params as NotePanelParams | undefined;
  return w?.id === NOTE_PANEL && p?.sid === sid && p.id === itemId;
}

/** 이 메모의 답 알림을 닫는다 - 본 답의 알림이 알림 줄에 남지 않게. 서비스 워커·알림이 없으면 아무것도 하지 않는다 */
export async function closeClaudeNotice(itemId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const list = (await reg?.getNotifications?.({ tag: `sp5-claude-${itemId}` })) ?? [];
    list.forEach((n) => n.close());
  } catch {
    /* 알림을 못 읽어도 칸은 그대로 */
  }
}

// ?claude=는 한 번만 (StrictMode가 효과를 두 번 돌려도)
let opened = false;

export function useClaudeReceiver(): void {
  const sid = usePersonalSpaceId();

  // 앱을 연 뒤 온 답
  useEffect(() => {
    if (!sid) return;
    return useClaudeRequests.subscribe((now, before) => {
      for (const id of claudeAnsweredNow(before.byId, now.byId)) {
        if (document.visibilityState !== 'visible' || noteShown(sid, id)) continue;
        showToast(`🤖 Claude 답이 왔습니다 - ${claudeBadge(now.byId[id]).text}`, NOTICE_MS, 'info', { label: '보기', run: () => openNotePanel({ sid, date: null, id }) });
      }
    });
  }, [sid]);

  // 푸시 알림을 눌러 연 앱 (로그인한 뒤에만 그려지므로 로그인 화면을 거쳐 와도 주소의 ?claude=는 남아 있다)
  useEffect(() => {
    if (!sid || opened) return;
    const id = claudeParamOf(window.location.search);
    if (!id) return;
    opened = true;
    history.replaceState(history.state, '', stripClaudeParam(window.location.href));
    openNotePanel({ sid, date: null, id });
  }, [sid]);

  // 열린 앱 창에서 알림을 누름
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw || !sid) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; item?: unknown } | null;
      if (m?.type !== 'sp5-open-claude') return;
      const id = claudeParamOf(`?claude=${String(m.item)}`);
      if (id) openNotePanel({ sid, date: null, id });
    };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, [sid]);
}

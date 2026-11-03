// 대화 창이 지금 그린 것 (P19-2 ■3) - 새 글 안내(receive.ts)가 본다: null = 창 없음 · '' = 목록 · 방 키 = 그 방.
// Firebase를 부르지 않는다(Shell 쪽 안내가 창 파일을 끌어오지 않게).
import { create } from 'zustand';

export const useChatView = create<{ room: string | null }>(() => ({ room: null }));

/**
 * 그 방의 OS 알림(대화 푸시 - public/sw.js showChatNotice, tag 'sp5-chat-<방 키>')을 닫는다 (P19-3 ■1).
 * 앱에서 그 방을 보면 부른다 - 다 본 글의 알림이 알림 줄에 남지 않게. 서비스 워커·알림이 없으면 아무것도 하지 않는다.
 */
export async function closeChatNotices(key: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const list = (await reg?.getNotifications?.({ tag: `sp5-chat-${key}` })) ?? [];
    list.forEach((n) => n.close());
  } catch {
    /* 알림을 못 읽어도 대화는 그대로 */
  }
}

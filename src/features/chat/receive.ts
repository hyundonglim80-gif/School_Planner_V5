// 대화 받기 (P19-2 ■1·■3) - Shell에 하나(큰 창만 - 새 창(↗)으로 옮긴 대화 창은 스스로 듣는다, ChatWindow).
//   - 내가 든 방 듣기(data/chat useChatWatch) → store = 대화 창 목록 · 머리줄 💬 n.
//   - 앱을 연 뒤 남이 쓴 새 글: '💬 이름 (그룹): 앞부분 - 보기'(→ 그 방). 대화 창이 보이고 그 방(또는 목록)을 그렸으면 띄우지 않는다,
//     🔕 끈 방도(안 읽은 수에는 든다). 한꺼번에 오면(400ms) '💬 새 대화 글 n개 - 보기'(→ 목록). 쪽지 안내(features/mail/receive) 본보기.
//   - 푸시 알림을 눌러 연 앱(P19-3 ■1): 주소 '?chat=<방 키>'(public/sw.js notificationclick)를 꺼내 지우고 대화 창 → 그 방(?mail= 본보기).
//   - 열린 앱 창에서 알림을 누름: 서비스 워커 메시지 'sp5-open-chat'.
import { useEffect } from 'react';
import { showToast } from '../../app/toast';
import { shownWindowNow } from '../../app/windows';
import { useChatWatch } from '../../data/chat';
import { useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { chatNotice, chatParamOf, parseRoomKey, stripChatParam, type ChatRoom } from '../../domain/chat';
import { CHAT_WINDOW, openChat } from './open';
import { useChatView } from './view';

/** 이 방의 새 글은 안내할 것이 없다 - 그 방(또는 목록)이 보이거나 🔕 */
function quiet(r: ChatRoom): boolean {
  const me = useSession.getState().user?.uid ?? '';
  if (r.muted.includes(me)) return true;
  const view = useChatView.getState().room;
  return view !== null && (view === '' || view === r.key) && shownWindowNow()?.id === CHAT_WINDOW;
}

// 한꺼번에 온 것을 모아 안내 하나로
const NOTICE_GATHER_MS = 400;
const NOTICE_MS = 6000;
let gathered: ChatRoom[] = [];
let gatherTimer: ReturnType<typeof setTimeout> | null = null;

function noticeNew(r: ChatRoom) {
  gathered.push(r);
  if (gatherTimer) return;
  gatherTimer = setTimeout(() => {
    const list = gathered.filter((x) => !quiet(x));
    gathered = [];
    gatherTimer = null;
    if (list.length === 0) return;
    if (list.length === 1) {
      const one = list[0];
      const group = useMySpaces.getState().groups.find((g) => g.id === one.sid)?.name ?? '';
      showToast(chatNotice(one, group), NOTICE_MS, 'info', { label: '보기', run: () => openChat({ room: one.key }) });
    } else showToast(`💬 새 대화 글 ${list.length}개`, NOTICE_MS, 'info', { label: '보기', run: () => openChat() });
  }, NOTICE_GATHER_MS);
}

// ?chat=은 한 번만 (StrictMode가 효과를 두 번 돌려도)
let opened = false;

export function useChatReceiver(): void {
  useChatWatch(noticeNew);
  const uid = useSession((s) => s.user?.uid);

  // 푸시 알림을 눌러 연 앱 (로그인한 뒤에만 그려지므로 로그인 화면을 거쳐 와도 주소의 ?chat=는 남아 있다)
  useEffect(() => {
    if (!uid || opened) return;
    const room = chatParamOf(window.location.search);
    if (!room) return;
    opened = true;
    history.replaceState(history.state, '', stripChatParam(window.location.href));
    openChat({ room });
  }, [uid]);

  // 열린 앱 창에서 알림을 누름
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; room?: unknown } | null;
      if (m?.type !== 'sp5-open-chat') return;
      const room = typeof m.room === 'string' && m.room.length <= 120 && parseRoomKey(m.room) ? m.room : undefined;
      openChat(room ? { room } : {});
    };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, []);
}

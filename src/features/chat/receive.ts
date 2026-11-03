// 대화 받기 (P19-2 ■1·■3) - Shell에 하나(큰 창만 - 새 창(↗)으로 옮긴 대화 창은 스스로 듣는다, ChatWindow).
//   - 내가 든 방 듣기(data/chat useChatWatch) → store = 대화 창 목록 · 머리줄 💬 n.
//   - 앱을 연 뒤 남이 쓴 새 글: '💬 이름 (그룹): 앞부분 - 보기'(→ 그 방). 대화 창이 보이고 그 방(또는 목록)을 그렸으면 띄우지 않는다,
//     🔕 끈 방도(안 읽은 수에는 든다). 한꺼번에 오면(400ms) '💬 새 대화 글 n개 - 보기'(→ 목록). 쪽지 안내(features/mail/receive) 본보기.
//   - ?chat=(푸시를 눌러 연 앱)·서비스 워커 'sp5-open-chat'은 P19-3 ■1에서 이 파일에 더한다.
import { showToast } from '../../app/toast';
import { useWindows } from '../../app/windows';
import { useChatWatch } from '../../data/chat';
import { useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { chatNotice, type ChatRoom } from '../../domain/chat';
import { activeOf, useSidePopups } from '../../ui/sideColumn';
import { CHAT_WINDOW, openChat } from './open';
import { useChatView } from './view';

/** 대화 창이 지금 보이나 - 오른쪽 줄의 보이는 탭, 줄이 비었으면(가운데 창·휴대폰) 맨 위 창 (features/mail/receive와 같은 셈) */
function chatWindowShown(): boolean {
  if (document.visibilityState !== 'visible') return false;
  const side = useSidePopups.getState();
  const id = activeOf(side);
  const wins = useWindows.getState().windows;
  const w = id === null ? wins.reduce<(typeof wins)[number] | undefined>((a, b) => (!a || b.raisedAt > a.raisedAt ? b : a), undefined) : wins.find((x) => x.key === side.owners[id]);
  return w?.id === CHAT_WINDOW;
}

/** 이 방의 새 글은 안내할 것이 없다 - 그 방(또는 목록)이 보이거나 🔕 */
function quiet(r: ChatRoom): boolean {
  const me = useSession.getState().user?.uid ?? '';
  if (r.muted.includes(me)) return true;
  const view = useChatView.getState().room;
  return view !== null && (view === '' || view === r.key) && chatWindowShown();
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

export function useChatReceiver(): void {
  useChatWatch(noticeNew);
}

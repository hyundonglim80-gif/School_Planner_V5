// 💬 대화 창의 방 하나 (P19-2 ■1·■2 - PLAN 6장 P19 '화면'). 글 줄: 날짜 나눔 줄 · 남의 글 왼쪽(잇단 글은 이름 한 번) · 내 글 오른쪽 · 시각 · 1:1 '1'. 아래 글 칸(ChatComposer).
//   - 방을 열면 최근 50개를 듣고(data/chat watchRoomMsgs) 맨 아래에서 시작한다. 위로 올리면(또는 '이전 글 더 보기') 50개씩 더.
//     듣기는 최근 50개뿐이라 새 글이 오면 지난 글이 듣기 밖으로 밀린다 - 밀린 글·위로 올려 받은 글은 따로 둔다(kept).
//     듣기에서 그냥 빠진 글(보내지 못해 되돌린 내 글)은 지운다 - 모두 모으면 '보내는 중…'으로 남는다.
//   - 스크롤은 창 본문(ModalShell의 data-scroll-lock)이 한다. 맨 아래를 보고 있으면 새 글을 따라 내려가고,
//     위를 보는 동안 남의 새 글이 오면 '↓ 새 글' 단추. 내가 보낸 글은 늘 맨 아래로.
//   - 보내기(■2): 그룹 방 = 경로의 그룹(나갔으면 보내지 않는다) · 1:1 = 보내기 직전 함께 든 그룹을 다시 고른다(dmSidOf - 방이 든 그룹을
//     둘 중 하나가 나갔으면 함께 든 다른 그룹으로 옮긴다, 없으면 '함께 든 그룹이 없어 보낼 수 없습니다'). 보내는 이름 = 그 그룹 구성원 이름.
//   - 새 1:1(방 문서가 아직 없음)은 듣지 않는다 - 규칙이 방 문서의 members로 글 읽기를 보므로 없는 방의 듣기는 permission-denied.
//     첫 글이 서버에 닿은 뒤(또는 상대가 먼저 보내 방이 생기면) 듣는다.
//   - 읽음(■3): 이 방이 보이는 동안(대화 창이 보이는 탭·맨 위 창이고 앱 화면이 켜져 있음) 안 읽은 글이 있으면 적는다 - 연 때는 곧바로,
//     그 뒤 새 글은 2초 모아 한 번, 모으는 동안 방을 떠나거나 창이 가려지면 그때(data/chat markRoomRead - 그룹 방 = 내 읽음 문서 한 칸, 1:1 = 방 reads.<나>).
//   - 그룹을 나갔거나 방에서 빠지면 듣기가 permission-denied로 끊긴다(P19-1 ■0) → '이 대화를 볼 수 없습니다'.
//   - 대화는 서버에만 있다(기기 사본·백업 없음) - 끊긴 채 열면 '인터넷이 필요합니다'.
//   - 이 방이 보이면 이 방의 OS 알림(푸시 - P19-3 ■1)을 닫는다(view closeChatNotices).
//   - 방 머리 🔔/🔕(P19-3 ■2) = 이 방 알림 끄기·켜기(방 muted.<나>) - 방 문서가 있을 때만(글이 없는 그룹 전체·새 1:1은 없음).
//   - 방 머리 ⋮(P19-4 ■1) = 방 정보(RoomInfo - 구성원 · 고른 사람 방 이름·사람 더하기·나가기).
//   - 글 줄은 ChatMsgRow - 내 글 지우기(P19-4 ■2 - 마우스를 올리면 🗑️ · 휴대폰 길게 누르기 → 묻기 → '지운 글').
//   - 새 고른 사람 방('+ 새 대화'에서 여럿 - create)은 1:1처럼 첫 글이 방 문서를 만든다(그 이름·사람 - 첫 보내기에만 싣는다).
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import { useShownWindowPick } from '../../app/windows';
import { deleteChatMsg, loadOlderMsgs, markRoomRead, sendChat, setRoomMuted, watchRoomMsgs, type ChatPage } from '../../data/chat';
import { useChatStore } from '../../data/chatStore';
import { useSession } from '../../data/session';
import type { GroupSpace } from '../../data/spaceChoice';
import type { Attachment } from '../../data/types';
import {
  chatRows,
  CHAT_PAGE,
  dmOtherOf,
  dmSidOf,
  isRoomUnread,
  mergeMsgs,
  myReadOf,
  parseRoomKey,
  unseenByOther,
  type ChatMsg,
  type ChatTarget,
} from '../../domain/chat';
import FileDropCover from '../../ui/FileDropCover';
import { useFileDrop } from '../../ui/fileDrop';
import ChatComposer, { type ChatComposerHandle } from './ChatComposer';
import ChatMsgRow from './ChatMsgRow';
import type { RoomCreate } from './NewChat';
import RoomInfo from './RoomInfo';
import { CHAT_WINDOW } from './open';
import { closeChatNotices } from './view';
import type { GroupPeople } from './people';

type Status = 'loading' | 'ok' | 'offline' | 'denied' | 'failed' | 'new';

/** 아래에서 이만큼 안이면 '맨 아래를 보고 있다' */
const BOTTOM_PX = 60;
/** 위에서 이만큼 안으로 올리면 지난 글을 더 받는다 */
const TOP_PX = 80;
/** 보는 동안 온 새 글의 읽음은 이만큼 모아 한 번 적는다 */
const READ_GATHER_MS = 2000;

interface Props {
  roomKey: string;
  uid: string;
  /** 방 머리 - 이름 · 흐린 덧말(1:1 함께 든 그룹·방 사람 수) */
  title: string;
  sub?: string;
  groups: readonly GroupSpace[];
  people: GroupPeople;
  /** 1:1을 연 곳의 그룹 ('+ 새 대화'·그룹 창) - 방이 없을 때 그 그룹에 만든다 */
  hintSid?: string;
  /** 새 고른 사람 방 - 첫 글이 이 이름·사람으로 방을 만든다 */
  create?: RoomCreate;
  onBack: () => void;
}

export default function ChatRoomView({ roomKey, uid, title, sub, groups, people, hintSid, create, onBack }: Props) {
  const ref = useMemo(() => parseRoomKey(roomKey), [roomKey]);
  const room = useChatStore((s) => s.rooms[roomKey]);
  const user = useSession((s) => s.user);
  /** 지금 듣는 최근 글 (오래된 것부터) */
  const [page, setPage] = useState<ChatMsg[]>([]);
  /** 듣기 밖의 글 - 위로 올려 받은 것 · 듣기에서 밀려난 것 */
  const [kept, setKept] = useState<ChatMsg[]>([]);
  const msgs = useMemo(() => mergeMsgs(kept, page), [kept, page]);
  /** 더 오래된 글을 받을 자리 - undefined = 서버에서 아직 받지 않음, null = 더 없음 */
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null | undefined>(undefined);
  // 새 1:1 = 서버에서 방 목록을 받았는데 이 방이 없다 · 새 고른 사람 방 = '+ 새 대화'에서 막 고른 방(연 때 한 번 본다)
  const [isNew] = useState(() => {
    const s = useChatStore.getState();
    return !s.rooms[roomKey] && ((ref?.kind === 'dm' && s.ready) || (ref?.kind === 'room' && !!create));
  });
  /** 새 고른 사람 방을 만드는 첫 글을 보냈다 (보내는 중 포함 - 잇달아 보낸 둘째 글이 방을 다시 만들지 않게) */
  const creating = useRef(false);
  const [info, setInfo] = useState(false);
  const [firstSent, setFirstSent] = useState(false);
  const listen = !!ref && (!isNew || firstSent || (!!room && room.lastFrom !== uid));
  const [status, setStatus] = useState<Status>(listen ? 'loading' : 'new');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [retry, setRetry] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = () => rootRef.current?.closest<HTMLElement>('[data-scroll-lock]') ?? null;
  const atBottom = useRef(true);
  /** 지난 글을 받기 전 '아래에서 잰 자리' - 받은 뒤 같은 글이 같은 자리에 오게 */
  const anchor = useRef<number | null>(null);
  const lastId = useRef<string | null | undefined>(undefined);
  const pageRef = useRef<ChatMsg[]>([]);
  const live = useRef({ cursor, busy });
  useEffect(() => {
    live.current = { cursor, busy };
  }, [cursor, busy]);

  // 방 글 듣기 (방마다 새로 그린다 - ChatWindow가 key={방 키})
  useEffect(() => {
    if (!ref || !listen) return;
    const onPage = (p: ChatPage) => {
      // 듣기 밖으로 밀린 글(가장 오래된 것보다 앞)은 따로 둔다 - 듣기에서 그냥 빠진 글은 버린다
      const oldest = p.msgs.find((m) => m.at !== null)?.at;
      const pushed =
        p.msgs.length >= CHAT_PAGE && oldest !== undefined && oldest !== null
          ? pageRef.current.filter((m) => m.at !== null && m.at <= oldest && !p.msgs.some((x) => x.id === m.id))
          : [];
      pageRef.current = p.msgs;
      if (pushed.length) setKept((k) => mergeMsgs(k, pushed));
      setPage(p.msgs);
      if (!p.offline) setCursor((c) => (c === undefined ? p.cursor : c));
      setStatus((s) => (!p.offline ? 'ok' : s === 'ok' ? 'ok' : 'offline'));
    };
    return watchRoomMsgs(ref, onPage, (e) => {
      console.warn('[chat] 대화를 받지 못했습니다.', e);
      setStatus((e as { code?: string })?.code === 'permission-denied' ? 'denied' : 'failed');
    });
  }, [ref, retry, listen]);

  const loadMore = async () => {
    const { cursor: c, busy: b } = live.current;
    if (!ref || !c || b) return;
    live.current.busy = true;
    setBusy(true);
    const el = scroller();
    try {
      const p = await loadOlderMsgs(ref, c);
      anchor.current = el ? el.scrollHeight - el.scrollTop : null;
      setKept((k) => mergeMsgs(p.msgs, k));
      setCursor(p.cursor);
    } catch (e) {
      console.warn('[chat] 지난 글을 받지 못했습니다.', e);
      showToast('지난 글을 받지 못했습니다. 인터넷 연결을 확인해 주세요.', 4000);
    } finally {
      setBusy(false);
    }
  };
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // 스크롤: 맨 아래인가 · 위로 올리면 더 받기
  useEffect(() => {
    const el = scroller();
    if (!el) return;
    const onScroll = () => {
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_PX;
      if (atBottom.current) setShowNew(false);
      if (el.scrollTop < TOP_PX && live.current.cursor) void loadMoreRef.current();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // 그림이 늦게 떠·글 칸이 늘어 높이가 바뀌어도 맨 아래를 보던 채로
    const list = rootRef.current;
    const ro = typeof ResizeObserver === 'undefined' || !list ? null : new ResizeObserver(() => atBottom.current && (el.scrollTop = el.scrollHeight));
    if (ro && list) ro.observe(list);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, []);

  // 글이 바뀐 뒤 자리 - 지난 글을 받았으면 그 자리 그대로, 새 글이면 맨 아래(보고 있었거나 내 글) 또는 '↓ 새 글'
  useLayoutEffect(() => {
    const el = scroller();
    if (!el) return;
    if (anchor.current !== null) {
      el.scrollTop = el.scrollHeight - anchor.current;
      anchor.current = null;
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_PX;
      return;
    }
    const last = msgs[msgs.length - 1];
    const id = last?.id ?? null;
    if (id === lastId.current) return;
    const first = !lastId.current;
    lastId.current = id;
    if (first || atBottom.current || last?.from === uid) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      setShowNew(false);
    } else setShowNew(true);
  }, [msgs, uid]);

  // ─── 읽음 ───
  const reads = useChatStore((s) => s.reads);
  const unread = !!room && isRoomUnread(room, uid, myReadOf(room, uid, reads));
  const shown = useShownWindowPick((w) => (w.id === CHAT_WINDOW ? 'chat' : null)) === 'chat';
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  // 이 방을 보면 이 방의 OS 알림(푸시)을 닫는다 (P19-3 ■1)
  useEffect(() => {
    if (ref && shown && visible) void closeChatNotices(roomKey);
  }, [ref, roomKey, shown, visible]);
  const markedOnce = useRef(false);
  useEffect(() => {
    if (!ref || !unread || !shown || !visible || status !== 'ok') return;
    let done = false;
    const mark = () => {
      if (done) return;
      done = true;
      markedOnce.current = true;
      void markRoomRead(uid, ref);
    };
    const t = setTimeout(mark, markedOnce.current ? READ_GATHER_MS : 0);
    // 모으는 동안 방을 떠나거나(← 목록·창 닫기) 창이 가려지면 그때 적는다 - 본 글이 목록에서 안 읽음으로 남지 않게
    return () => {
      clearTimeout(t);
      mark();
    };
  }, [ref, uid, unread, shown, visible, status]);

  const toBottom = () => {
    const el = scroller();
    if (el) el.scrollTop = el.scrollHeight;
    setShowNew(false);
  };

  // ─── 보내기 ───
  const other = ref?.kind === 'dm' ? dmOtherOf(ref.pairId, uid) : null;
  const send = async (text: string, attachments: Attachment[]): Promise<boolean> => {
    if (!ref || !user) return false;
    let target: ChatTarget;
    if (ref.kind === 'dm') {
      const sid = other ? dmSidOf([room?.sid, hintSid], uid, other, groups) : null;
      if (!other || !sid) {
        showToast('함께 든 그룹이 없어 보낼 수 없습니다.', 4000);
        return false;
      }
      target = { kind: 'dm', pairId: ref.pairId, other, sid };
    } else {
      if (!groups.some((g) => g.id === ref.sid)) {
        showToast('그룹을 나가 이 대화에 보낼 수 없습니다.', 4000);
        return false;
      }
      const make = ref.kind === 'room' && isNew && create && !creating.current && !room ? create : undefined;
      if (make) creating.current = true;
      target = ref.kind === 'all' ? { kind: 'all', sid: ref.sid } : { kind: 'room', sid: ref.sid, roomId: ref.roomId, create: make };
    }
    const fromName = people[target.sid]?.[uid] || user.displayName || user.email || '선생님';
    try {
      await sendChat(target, { from: uid, fromName, text, attachments });
      if (isNew && !firstSent) setFirstSent(true);
      return true;
    } catch (e) {
      // 방을 만들지 못했으면 다음 글이 다시 만든다
      if (target.kind === 'room' && target.create) creating.current = false;
      // 안내는 sendChat이 (failWithToast) - 글은 칸에 되돌린다(ChatComposer)
      if (!(e instanceof ShownError)) showErrorToast('보내지 못했습니다.', e);
      return false;
    }
  };

  const rows = useMemo(() => chatRows(msgs), [msgs]);

  // ─── 내 글 지우기 (P19-4 ■2) - 묻고, 기다리지 않는다(끊긴 동안도 곧바로 '지운 글' · 실패는 data/chat이 안내) ───
  const removeMsg = (msg: ChatMsg) => {
    if (!ref || !window.confirm("이 글을 지울까요? 이 방 모두에게 '지운 글'로 보이고 되돌릴 수 없습니다.")) return;
    deleteChatMsg(uid, ref, msg.id, room)
      // 위로 올려 받은 글(듣기 밖)은 듣기가 바꿔 주지 않는다 - 서버에 닿은 뒤 여기서
      .then(() => setKept((k) => k.map((m) => (m.id === msg.id ? { ...m, text: '', attachments: [], deleted: true } : m))))
      .catch(() => {});
  };

  let body: ReactNode;
  if (!ref) body = <Notice data="missing">이 대화를 찾을 수 없습니다.</Notice>;
  else if (status === 'denied') body = <Notice data="denied">이 대화를 볼 수 없습니다. 그룹을 나갔거나 이 대화에서 빠졌습니다.</Notice>;
  else if (status === 'failed')
    body = (
      <div data-chat-failed className="flex flex-col items-center gap-2 py-8 text-xs text-slate-500">
        <p>대화를 받지 못했습니다. 인터넷 연결을 확인해 주세요.</p>
        <button
          type="button"
          data-chat-retry
          onClick={() => {
            setStatus('loading');
            setRetry((n) => n + 1);
          }}
          className="rounded-lg border border-slate-300 px-2.5 py-1 font-bold hover:bg-slate-50 cursor-pointer"
        >
          다시 받기
        </button>
      </div>
    );
  else if (msgs.length === 0)
    body =
      status === 'loading' ? (
        <p className="py-8 text-center text-xs text-slate-400">불러오는 중…</p>
      ) : status === 'offline' ? null : (
        <p data-chat-empty={status === 'new' ? 'new' : 'room'} className="py-8 text-center text-xs text-slate-400">
          {status === 'new' ? '첫 글을 보내 대화를 시작해 보세요.' : '아직 글이 없습니다. 첫 글을 보내 보세요.'}
        </p>
      );
  else
    body = (
      <ol data-chat-msgs={msgs.length} className="flex flex-col px-3 pb-3">
        {rows.map(({ msg, day, head, time }) => {
          const mine = msg.from === uid;
          const unseen = room ? unseenByOther(room, uid, msg) : false;
          return (
            <Fragment key={msg.id}>
              {day && (
                <li data-chat-day className="my-3 text-center text-2xs text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5">{day}</span>
                </li>
              )}
              <ChatMsgRow msg={msg} mine={mine} head={head} time={time} unseen={unseen} onDelete={mine ? removeMsg : undefined} />
            </Fragment>
          );
        })}
      </ol>
    );

  const canWrite = !!ref && status !== 'denied';
  // 윈도우 파일을 방 어디에 놓아도 글 칸의 📎와 같다 (P21-1)
  const composer = useRef<ChatComposerHandle>(null);
  const fileDrop = useFileDrop((files) => composer.current?.attach(files), { disabled: !canWrite });

  // ─── 🔕 이 방 알림 (P19-3 ■2) - 푸시 함수가 거르고 앱 안내도 없다, 안 읽은 수에는 든다. 방 문서가 생긴 뒤에만(규칙 - 내 칸 고치기) ───
  const muted = !!room?.muted.includes(uid);
  const toggleMute = () => {
    if (!ref) return;
    void setRoomMuted(uid, ref, !muted);
    showToast(muted ? '🔔 이 대화의 알림을 켰습니다.' : '🔕 이 대화의 알림을 껐습니다. 새 글은 맨 위 💬 수로만 보입니다.');
  };

  return (
    <div ref={rootRef} data-chat-room-view={roomKey} data-chat-status={status} className="relative flex flex-1 flex-col" {...fileDrop.dropProps}>
      {fileDrop.over && <FileDropCover />}
      {/* 머리와 ⋮ 방 정보는 함께 위에 붙는다 - 방은 맨 아래에서 시작한다 */}
      <div className="sticky top-0 z-10">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
        <button type="button" data-chat-back onClick={onBack} className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
          ← 목록
        </button>
        <span data-chat-room-title className="min-w-0 truncate text-sm font-black text-slate-800">
          {title}
        </span>
        {sub && <span className="min-w-0 shrink truncate text-2xs text-slate-400">{sub}</span>}
        {room && canWrite && (
          <button
            type="button"
            data-chat-mute={muted ? 'on' : 'off'}
            onClick={toggleMute}
            title={muted ? '이 대화 알림 켜기' : '이 대화 알림 끄기'}
            aria-label={muted ? '이 대화 알림 켜기' : '이 대화 알림 끄기'}
            className={`ml-auto shrink-0 rounded-lg px-2 py-1 text-sm hover:bg-slate-100 cursor-pointer ${muted ? '' : 'opacity-60 hover:opacity-100'}`}
          >
            {muted ? '🔕' : '🔔'}
          </button>
        )}
        {ref && canWrite && (
          <button
            type="button"
            data-chat-room-menu={info ? 'open' : 'closed'}
            onClick={() => setInfo((v) => !v)}
            title="방 정보 (구성원·이름·사람 더하기·나가기)"
            aria-label="방 정보"
            aria-expanded={info}
            className={`${room ? '' : 'ml-auto'} shrink-0 rounded-lg px-2 py-1 text-sm font-black hover:bg-slate-100 cursor-pointer ${info ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}
          >
            ⋮
          </button>
        )}
      </div>
      {ref && canWrite && info && (
        <RoomInfo roomRef={ref} room={room} pendingMembers={create?.members} uid={uid} groups={groups} people={people} msgs={msgs} onLeft={onBack} />
      )}
      </div>
      {status === 'offline' && (
        <p data-chat-offline className="mx-3 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          📴 인터넷에 연결되어 있지 않아 대화를 받지 못했습니다. 대화는 서버에만 있어 인터넷이 필요합니다.
        </p>
      )}
      {cursor && status === 'ok' && (
        <button
          type="button"
          data-chat-more
          disabled={busy}
          onClick={() => void loadMore()}
          className="mt-2 self-center rounded-lg px-3 py-1 text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
        >
          {busy ? '불러오는 중…' : '이전 글 더 보기'}
        </button>
      )}
      <div className="flex-1">{body}</div>
      {canWrite && (
        <ChatComposer
          ref={composer}
          roomKey={roomKey}
          onSend={send}
          above={
            showNew && (
              <button type="button" data-chat-new onClick={toBottom} className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-lg hover:bg-primary/90 cursor-pointer">
                ↓ 새 글
              </button>
            )
          }
        />
      )}
    </div>
  );
}

function Notice({ data, children }: { data: string; children: ReactNode }) {
  return (
    <p data-chat-notice={data} className="px-4 py-8 text-center text-xs text-slate-500">
      {children}
    </p>
  );
}

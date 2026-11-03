// 💬 대화 창의 방 하나 (P19-2 ■1 - PLAN 6장 P19 '화면'). 글 줄: 날짜 나눔 줄 · 남의 글 왼쪽(잇단 글은 이름 한 번) · 내 글 오른쪽 · 시각 · 1:1 '1'.
//   - 방을 열면 최근 50개를 듣고(data/chat watchRoomMsgs) 맨 아래에서 시작한다. 위로 올리면(또는 '이전 글 더 보기') 50개씩 더.
//     받은 글은 모두 모은다(mergeMsgs) - 듣기는 최근 50개뿐이라 새 글이 오면 지난 글이 듣기 밖으로 밀린다.
//   - 스크롤은 창 본문(ModalShell의 data-scroll-lock)이 한다. 맨 아래를 보고 있으면 새 글을 따라 내려가고,
//     위를 보는 동안 남의 새 글이 오면 '↓ 새 글' 단추. 내가 보낸 글은 늘 맨 아래로.
//   - 그룹을 나갔거나 방에서 빠지면 듣기가 permission-denied로 끊긴다(P19-1 ■0) → '이 대화를 볼 수 없습니다'.
//   - 대화는 서버에만 있다(기기 사본·백업 없음) - 끊긴 채 열면 '인터넷이 필요합니다'.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { showToast } from '../../app/toast';
import { loadOlderMsgs, watchRoomMsgs } from '../../data/chat';
import { useChatStore } from '../../data/chatStore';
import { chatRows, chatTime, mergeMsgs, parseRoomKey, unseenByOther, type ChatMsg } from '../../domain/chat';
import MailAttachments from '../mail/MailAttachments';

type Status = 'loading' | 'ok' | 'offline' | 'denied' | 'failed';

/** 아래에서 이만큼 안이면 '맨 아래를 보고 있다' */
const BOTTOM_PX = 60;
/** 위에서 이만큼 안으로 올리면 지난 글을 더 받는다 */
const TOP_PX = 80;

interface Props {
  roomKey: string;
  uid: string;
  /** 방 머리 - 이름 · 흐린 덧말(1:1 함께 든 그룹·방 사람 수) */
  title: string;
  sub?: string;
  onBack: () => void;
}

export default function ChatRoomView({ roomKey, uid, title, sub, onBack }: Props) {
  const ref = useMemo(() => parseRoomKey(roomKey), [roomKey]);
  const room = useChatStore((s) => s.rooms[roomKey]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  /** 더 오래된 글을 받을 자리 - undefined = 서버에서 아직 받지 않음, null = 더 없음 */
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [retry, setRetry] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = () => rootRef.current?.closest<HTMLElement>('[data-scroll-lock]') ?? null;
  const atBottom = useRef(true);
  /** 지난 글을 받기 전 '아래에서 잰 자리' - 받은 뒤 같은 글이 같은 자리에 오게 */
  const anchor = useRef<number | null>(null);
  const lastId = useRef<string | null | undefined>(undefined);
  const live = useRef({ cursor, busy });
  useEffect(() => {
    live.current = { cursor, busy };
  }, [cursor, busy]);

  // 방 글 듣기 (방마다 새로 그린다 - ChatWindow가 key={방 키})
  useEffect(() => {
    if (!ref) return;
    return watchRoomMsgs(
      ref,
      (p) => {
        setMsgs((prev) => mergeMsgs(prev, p.msgs));
        if (!p.offline) setCursor((c) => (c === undefined ? p.cursor : c));
        setStatus((s) => (!p.offline ? 'ok' : s === 'ok' ? 'ok' : 'offline'));
      },
      (e) => {
        console.warn('[chat] 대화를 받지 못했습니다.', e);
        setStatus((e as { code?: string })?.code === 'permission-denied' ? 'denied' : 'failed');
      },
    );
  }, [ref, retry]);

  const loadMore = async () => {
    const { cursor: c, busy: b } = live.current;
    if (!ref || !c || b) return;
    live.current.busy = true;
    setBusy(true);
    const el = scroller();
    try {
      const p = await loadOlderMsgs(ref, c);
      anchor.current = el ? el.scrollHeight - el.scrollTop : null;
      setMsgs((prev) => mergeMsgs(p.msgs, prev));
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
    // 그림이 늦게 떠 높이가 늘어도 맨 아래를 보던 채로
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

  const toBottom = () => {
    const el = scroller();
    if (el) el.scrollTop = el.scrollHeight;
    setShowNew(false);
  };

  const rows = useMemo(() => chatRows(msgs), [msgs]);

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
        <p data-chat-empty className="py-8 text-center text-xs text-slate-400">
          아직 글이 없습니다.
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
              <li data-chat-msg={msg.id} data-chat-mine={mine ? 'yes' : 'no'} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${head ? 'mt-2' : 'mt-0.5'}`}>
                <div className={`flex min-w-0 max-w-[85%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && head && (
                    <span data-chat-name className="mb-0.5 px-1 text-2xs font-bold text-slate-500">
                      {msg.fromName}
                    </span>
                  )}
                  <div className={`flex min-w-0 items-end gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div className="flex min-w-0 flex-col gap-1">
                      {(msg.text || msg.deleted) && (
                        <p
                          data-chat-text
                          className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                            msg.deleted ? 'italic text-slate-400 bg-slate-50 border border-slate-200' : mine ? 'bg-primary text-white' : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {msg.deleted ? '지운 글' : msg.text}
                        </p>
                      )}
                      {msg.attachments.length > 0 && (
                        <div className="w-60 max-w-full">
                          <MailAttachments items={msg.attachments} />
                        </div>
                      )}
                    </div>
                    <span className={`flex shrink-0 flex-col text-[10px] leading-tight text-slate-400 ${mine ? 'items-end' : 'items-start'}`}>
                      {unseen && (
                        <span data-chat-unseen className="font-black text-amber-500" title="상대가 아직 읽지 않았습니다">
                          1
                        </span>
                      )}
                      {time && <span data-chat-time>{chatTime(msg.at)}</span>}
                    </span>
                  </div>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
    );

  return (
    <div ref={rootRef} data-chat-room-view={roomKey} className="relative flex flex-1 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
        <button type="button" data-chat-back onClick={onBack} className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
          ← 목록
        </button>
        <span data-chat-room-title className="min-w-0 truncate text-sm font-black text-slate-800">
          {title}
        </span>
        {sub && <span className="min-w-0 shrink truncate text-2xs text-slate-400">{sub}</span>}
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
      {showNew && (
        <button
          type="button"
          data-chat-new
          onClick={toBottom}
          className="sticky bottom-3 mx-auto mb-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-lg hover:bg-primary/90 cursor-pointer"
        >
          ↓ 새 글
        </button>
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

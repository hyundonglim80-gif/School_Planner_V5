// 💬 대화 창 (P19-2 ■1 - PLAN 6장 P19 '화면'). 오른쪽 칸 창 'chat' - 쪽지 창과 따로(5장 'P19 대화 창은 쪽지 창과 따로').
//   목록 = 1:1 묶음(상대 이름 · 함께 든 그룹 흐리게) + 그룹마다 '👥 그룹' 묶음(그룹 전체 · 고른 사람 방). 줄 = 이름 · 마지막 글 앞부분 · 시각 · 안 읽은 수 · 🔕.
//   - 방 목록은 Shell의 듣기(features/chat/receive)가 채운 store를 읽는다. 새 창(↗)으로 옮긴 대화 창은 Shell이 없어 스스로 듣는다.
//   - 그룹 전체 방은 첫 글이 오기 전에도 그룹마다 한 줄(누르면 빈 방 - 첫 글을 쓴다).
//   - 안 읽은 수 = 안 읽은 방만 서버에서 센다(방마다 읽기 1 - data/chat countUnread, 99+). 마지막 글이 바뀌면 다시.
//   줄을 누르면 방(ChatRoomView), 방 머리 '← 목록'으로 돌아온다. '+ 새 대화'(NewChat) = 그룹 → 사람 = 1:1.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { openWindow, type WindowProps } from '../../app/windows';
import { countUnread, useChatWatch } from '../../data/chat';
import { useChatStore } from '../../data/chatStore';
import { useSession } from '../../data/session';
import { useMySpaces, type GroupSpace } from '../../data/spaceChoice';
import { chatCountLabel, chatSections, dmOtherOf, isRoomUnread, myReadOf, parseRoomKey, roomPreview, type ChatRoom } from '../../domain/chat';
import { mailWhen } from '../../domain/mail';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { POPOUT } from '../../ui/popout';
import ChatRoomView from './ChatRoomView';
import NewChat from './NewChat';
import type { ChatParams } from './open';
import { personName, useGroupPeople, type GroupPeople } from './people';

// 새 창으로 옮긴 대화 창 - 그 창에는 Shell이 없어 방 목록을 스스로 듣는다(큰 창에서는 Shell이 듣는다 - 두 번 읽지 않게)
const useWatchInPopout: () => void = POPOUT ? () => useChatWatch() : () => {};

/** 두 사람이 함께 든 그룹 이름 */
const commonGroups = (groups: readonly GroupSpace[], me: string, other: string) => groups.filter((g) => g.members[me] && g.members[other]).map((g) => g.name);

/** 방 이름과 흐린 덧말 */
function roomTitle(key: string, room: ChatRoom | undefined, me: string, groups: readonly GroupSpace[], people: GroupPeople): { title: string; sub?: string } {
  const ref = parseRoomKey(key);
  if (!ref) return { title: '대화' };
  if (ref.kind === 'dm') {
    const other = dmOtherOf(key, me) ?? '';
    const common = commonGroups(groups, me, other);
    return { title: `👤 ${personName(people, other, room?.sid, room?.names[other])}`, sub: common.length ? `👥 ${common.join(', ')}` : '함께 든 그룹 없음' };
  }
  const groupName = groups.find((g) => g.id === ref.sid)?.name ?? '나간 그룹';
  if (ref.kind === 'all') return { title: `👥 ${groupName} 전체` };
  return { title: `💬 ${room?.name || '이름 없는 방'}`, sub: `${groupName} · ${room?.members.length ?? 0}명` };
}

/** 안 읽은 방의 글 수 - 방 키 → 수 (센 것만) */
function useUnreadCounts(rooms: readonly ChatRoom[], me: string, reads: Readonly<Record<string, number>>): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, { sig: string; n: number }>>({});
  const want = rooms.flatMap((r) => {
    const since = myReadOf(r, me, reads);
    return isRoomUnread(r, me, since) ? [{ key: r.key, since, sig: `${r.lastId}|${since}` }] : [];
  });
  const wantKey = want.map((w) => `${w.key}|${w.sig}`).join(',');
  const have = useRef(counts);
  useEffect(() => {
    have.current = counts;
  }, [counts]);
  useEffect(() => {
    let alive = true;
    for (const w of want) {
      const ref = parseRoomKey(w.key);
      if (!ref || have.current[w.key]?.sig === w.sig) continue;
      countUnread(ref, w.since)
        .then((n) => alive && setCounts((prev) => ({ ...prev, [w.key]: { sig: w.sig, n } })))
        .catch((e) => console.warn('[chat] 안 읽은 글 수를 받지 못했습니다.', e));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 안 읽은 방·마지막 글·내 읽음이 바뀔 때만
  }, [wantKey]);
  return Object.fromEntries(want.flatMap((w) => (counts[w.key]?.sig === w.sig ? [[w.key, counts[w.key].n]] : [])));
}

interface RowProps {
  roomKey: string;
  icon: string;
  name: string;
  sub?: string;
  room: ChatRoom | null;
  me: string;
  now: number;
  unread: boolean;
  count?: number;
  onOpen: () => void;
}

function RoomRow({ roomKey, icon, name, sub, room, me, now, unread, count, onOpen }: RowProps) {
  const preview = room ? roomPreview(room, me) : '';
  const muted = !!room?.muted.includes(me);
  return (
    <li>
      <button
        type="button"
        data-chat-room={roomKey}
        data-chat-unread={unread ? 'yes' : 'no'}
        onClick={onOpen}
        className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
      >
        <span aria-hidden className="mt-0.5 text-base leading-none">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className={`truncate text-sm ${unread ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{name}</span>
            {sub && <span className="min-w-0 shrink truncate text-2xs text-slate-400">{sub}</span>}
            {muted && (
              <span data-chat-muted className="shrink-0 text-2xs" title="이 대화는 알림을 껐습니다">
                🔕
              </span>
            )}
            {room?.lastId && <span className="ml-auto shrink-0 text-2xs text-slate-400">{mailWhen(room.lastAt, now)}</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <span data-chat-preview className={`min-w-0 flex-1 truncate text-xs ${unread ? 'font-bold text-slate-800' : preview ? 'text-slate-500' : 'text-slate-300'}`}>
              {preview || '아직 글이 없습니다'}
            </span>
            {unread && (
              <span data-chat-unread-count={count ?? ''} className="shrink-0 rounded-full bg-primary px-1.5 text-2xs font-black text-white">
                {count === undefined ? '•' : chatCountLabel(count)}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function ChatList({ me, groups, people, onOpen }: { me: string; groups: readonly GroupSpace[]; people: GroupPeople; onOpen: (key: string, sid?: string) => void }) {
  const [picking, setPicking] = useState(false);
  const roomsMap = useChatStore((s) => s.rooms);
  const reads = useChatStore((s) => s.reads);
  const ready = useChatStore((s) => s.ready);
  const loaded = useMySpaces((s) => s.loaded);
  const rooms = useMemo(() => Object.values(roomsMap), [roomsMap]);
  const sections = useMemo(() => chatSections(rooms, groups), [rooms, groups]);
  const counts = useUnreadCounts(rooms, me, reads);
  // 줄의 시각을 '오늘'과 견줄 때 (창을 연 때 - 그리는 사이에 바뀌지 않게)
  const [now] = useState(() => Date.now());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  // 방에서 돌아오면 목록 맨 위부터
  const top = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = top.current?.closest<HTMLElement>('[data-scroll-lock]');
    if (el) el.scrollTop = 0;
  }, []);

  const unreadOf = (r: ChatRoom | null) => !!r && isRoomUnread(r, me, myReadOf(r, me, reads));
  const row = (key: string, icon: string, name: string, room: ChatRoom | null, sub?: string) => (
    <RoomRow key={key} roomKey={key} icon={icon} name={name} sub={sub} room={room} me={me} now={now} unread={unreadOf(room)} count={counts[key]} onOpen={() => onOpen(key)} />
  );

  if (loaded && groups.length === 0 && sections.dms.length === 0)
    return (
      <div ref={top} data-chat-no-group className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-slate-500">
        <p>공유 그룹에 들어가면 같은 그룹 선생님과 대화할 수 있습니다.</p>
        <button type="button" data-chat-groups onClick={() => openWindow('group')} className="rounded-lg border border-slate-300 px-2.5 py-1 font-bold hover:bg-slate-50 cursor-pointer">
          👥 공유 그룹
        </button>
      </div>
    );

  return (
    <div ref={top} data-chat-list className="flex flex-col gap-3 p-3">
      {!ready && !online && (
        <p data-chat-offline className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          📴 인터넷에 연결되어 있지 않아 대화를 받지 못했습니다. 대화는 서버에만 있어 인터넷이 필요합니다.
        </p>
      )}
      {groups.length > 0 &&
        (picking ? (
          <NewChat me={me} groups={groups} people={people} onPick={onOpen} onClose={() => setPicking(false)} />
        ) : (
          <button
            type="button"
            data-chat-new-open
            onClick={() => setPicking(true)}
            className="self-end rounded-lg px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/5 cursor-pointer"
          >
            + 새 대화
          </button>
        ))}
      <section data-chat-section="dm">
        <h3 className="px-3 pb-1 text-2xs font-black text-slate-400">👤 1:1 대화</h3>
        {sections.dms.length > 0 ? (
          <ul className="flex flex-col">
            {sections.dms.map((r) => {
              const other = dmOtherOf(r.key, me) ?? '';
              const common = commonGroups(groups, me, other);
              return row(r.key, '👤', personName(people, other, r.sid, r.names[other]), r, common.length ? common.join(', ') : '함께 든 그룹 없음');
            })}
          </ul>
        ) : (
          <p className="px-3 py-1 text-xs text-slate-400">{ready || !online ? '아직 1:1 대화가 없습니다.' : '불러오는 중…'}</p>
        )}
      </section>
      {sections.groups.map((g) => (
        <section key={g.sid} data-chat-section={g.sid}>
          <h3 className="truncate px-3 pb-1 text-2xs font-black text-slate-400">👥 {g.name}</h3>
          <ul className="flex flex-col">
            {row(`${g.sid}~all`, '👥', '그룹 전체', g.all)}
            {g.rooms.map((r) => row(r.key, '💬', r.name || '이름 없는 방', r, `${r.members.length}명`))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function ChatWindow({ params, close, raise }: WindowProps<ChatParams | undefined>) {
  useWatchInPopout();
  const uid = useSession((s) => s.user?.uid ?? null);
  const groups = useMySpaces((s) => s.groups);
  const people = useGroupPeople(groups.map((g) => g.id));
  const [open, setOpen] = useState<string | null>(params?.room ?? null);
  /** 1:1을 연 곳의 그룹 - 방이 없을 때 그 그룹에 만든다 */
  const [hint, setHint] = useState(params?.sid);
  const openRoom = (key: string, sid?: string) => {
    setOpen(key);
    setHint(sid);
  };
  const room = useChatStore((s) => (open ? s.rooms[open] : undefined));
  // 열린 창을 다시 열면 그 방으로 (MailWindow 본보기 - openWindow는 열 때마다 새 params)
  const [asked, setAsked] = useState(params);
  if (params !== asked) {
    setAsked(params);
    if (params?.room) openRoom(params.room, params.sid);
  }
  // 계정이 바뀌면 목록으로 (창 목록은 로그아웃에도 남는다)
  const [shownFor, setShownFor] = useState(uid);
  if (shownFor !== uid) {
    setShownFor(uid);
    setOpen(null);
  }

  const head = open && uid ? roomTitle(open, room, uid, groups, people) : null;

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="lg" title="💬 대화" bare footer={open ? undefined : <ModalCloseButton onClose={close} />}>
      <div data-chat-window={open ? 'room' : 'list'} className="flex min-h-full flex-col">
        {!uid ? (
          <p className="py-6 text-center text-xs text-slate-400">로그인하면 대화를 볼 수 있습니다.</p>
        ) : open && head ? (
          <ChatRoomView key={open} roomKey={open} uid={uid} title={head.title} sub={head.sub} groups={groups} people={people} hintSid={hint} onBack={() => setOpen(null)} />
        ) : (
          <ChatList me={uid} groups={groups} people={people} onOpen={openRoom} />
        )}
      </div>
    </ModalShell>
  );
}

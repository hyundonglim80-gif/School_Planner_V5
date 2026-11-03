// 💬 방 머리 ⋮ - 방 정보 (P19-4 ■1). 방 머리 아래에 펴진다(창 안 - 따로 뜨는 창이 아니다).
//   구성원 = 그룹 전체는 지금 그 그룹 구성원, 1:1은 두 사람, 고른 사람 방은 방 사람(그룹을 나간 사람은 흐리게 '그룹을 나감' - 방에 남아도 글을 못 읽는다).
//   고른 사람 방만(방 문서가 있을 때): 이름 바꾸기 · 사람 더하기(그 그룹 사람, 50명까지) · 나가기(묻기 - 나만 뺀다, 남은 빼지 못한다 - 규칙).
//   쓰기는 기다리지 않는다(끊긴 동안도 기기에 곧바로 보이고 '저장을 기다립니다' 띠) - 실패는 data/chat이 안내한다.
import { useState } from 'react';
import { addRoomMembers, leaveRoom, renameRoom } from '../../data/chat';
import type { GroupSpace } from '../../data/spaceChoice';
import { CHAT_LIMITS, dmOtherOf, type ChatMsg, type ChatRoom, type ChatRoomRef } from '../../domain/chat';
import { personName, type GroupPeople } from './people';

interface Props {
  roomRef: ChatRoomRef;
  /** 방 문서 (아직 없으면 - 첫 글 전 - undefined) */
  room: ChatRoom | undefined;
  /** 새 고른 사람 방의 사람 (첫 글 전) */
  pendingMembers?: readonly string[];
  uid: string;
  groups: readonly GroupSpace[];
  people: GroupPeople;
  /** 받은 글 - 그룹을 나가 이름(people)이 지워진 사람은 그 사람 글의 이름으로 */
  msgs: readonly ChatMsg[];
  /** 나간 뒤 - 목록으로 */
  onLeft: () => void;
}

const ignore = () => {};

export default function RoomInfo({ roomRef, room, pendingMembers, uid, groups, people, msgs, onLeft }: Props) {
  const sid = roomRef.kind === 'dm' ? room?.sid : roomRef.sid;
  const group = groups.find((g) => g.id === sid);
  const groupMembers = group ? Object.keys(group.members) : [];
  const lastName = (who: string) => [...msgs].reverse().find((m) => m.from === who)?.fromName;
  const nameOf = (who: string) => personName(people, who, sid, room?.names[who] || lastName(who));
  const uids =
    roomRef.kind === 'all'
      ? groupMembers
      : roomRef.kind === 'dm'
        ? [uid, dmOtherOf(roomRef.pairId, uid) ?? ''].filter(Boolean)
        : (room?.members ?? pendingMembers ?? []);
  const list = [...uids].sort((a, b) => (a === uid ? -1 : b === uid ? 1 : nameOf(a).localeCompare(nameOf(b), 'ko')));
  const left = (who: string) => roomRef.kind === 'room' && !!group && !group.members[who];
  const canEdit = roomRef.kind === 'room' && !!room && !!group;

  const [name, setName] = useState(room?.name ?? '');
  // 남이 이름을 바꾸면 칸도 (고치던 중이어도 - 바뀐 이름을 보여야 한다)
  const [shownName, setShownName] = useState(room?.name);
  if (room?.name !== shownName) {
    setShownName(room?.name);
    setName(room?.name ?? '');
  }
  const [adding, setAdding] = useState<string[]>([]);
  const addable = canEdit ? groupMembers.filter((u) => !room!.members.includes(u)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ko')) : [];
  const room50 = (room?.members.length ?? 0) + adding.length > CHAT_LIMITS.roomMembers;

  const rename = () => {
    const n = name.trim();
    if (!n || n === room?.name) return;
    renameRoom(roomRef, n).catch(ignore);
  };
  const add = () => {
    if (!adding.length || room50) return;
    addRoomMembers(roomRef, adding).catch(ignore);
    setAdding([]);
  };
  const leave = () => {
    if (!window.confirm(`[${room?.name || '이 방'}] 대화방에서 나갈까요? 지난 글을 더 볼 수 없고, 다시 들어오려면 방 사람이 더해 주어야 합니다.`)) return;
    leaveRoom(uid, roomRef).catch(ignore);
    onLeft();
  };

  return (
    <div data-chat-room-info className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto overscroll-contain border-b border-slate-100 bg-slate-50 px-3 py-3 text-xs">
      <section>
        <h4 className="pb-1 text-2xs font-black text-slate-400">구성원 {list.length}명</h4>
        <ul className="flex flex-wrap gap-1.5">
          {list.map((who) => (
            <li
              key={who}
              data-chat-member={who}
              data-chat-member-left={left(who) ? 'yes' : 'no'}
              className={`rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-semibold ${left(who) ? 'text-slate-400 opacity-60' : 'text-slate-700'}`}
            >
              👤 {nameOf(who)}
              {who === uid && <span className="text-slate-400"> (나)</span>}
              {left(who) && <span className="text-2xs text-slate-400"> · 그룹을 나감</span>}
            </li>
          ))}
        </ul>
      </section>
      {canEdit && (
        <>
          <section className="flex items-center gap-1.5">
            <input
              data-chat-room-name
              value={name}
              maxLength={CHAT_LIMITS.roomName}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) rename();
              }}
              aria-label="방 이름"
              placeholder="방 이름"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-800"
            />
            <button
              type="button"
              data-chat-room-rename
              disabled={!name.trim() || name.trim() === room?.name}
              onClick={rename}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              이름 바꾸기
            </button>
          </section>
          <section>
            <h4 className="pb-1 text-2xs font-black text-slate-400">사람 더하기 ({group?.name})</h4>
            {addable.length === 0 ? (
              <p data-chat-add-none className="text-slate-400">그룹 사람이 모두 이 방에 있습니다.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {addable.map((who) => {
                  const on = adding.includes(who);
                  return (
                    <button
                      key={who}
                      type="button"
                      data-chat-add-person={who}
                      data-picked={on ? 'yes' : 'no'}
                      aria-pressed={on}
                      onClick={() => setAdding((a) => (on ? a.filter((x) => x !== who) : [...a, who]))}
                      className={`rounded-full border px-2.5 py-0.5 font-bold cursor-pointer ${
                        on ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary'
                      }`}
                    >
                      {on ? '✓' : '＋'} {nameOf(who)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-chat-add-save
                  disabled={!adding.length || room50}
                  onClick={add}
                  className="rounded-lg bg-primary px-2.5 py-0.5 font-bold text-white hover:bg-primary/90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  더하기{adding.length ? ` (${adding.length}명)` : ''}
                </button>
              </div>
            )}
            {room50 && <p className="pt-1 text-2xs font-bold text-red-600">한 방에는 {CHAT_LIMITS.roomMembers}명까지 들 수 있습니다.</p>}
          </section>
          <button
            type="button"
            data-chat-leave
            onClick={leave}
            className="self-start rounded-lg border border-red-200 bg-white px-2.5 py-1 font-bold text-red-600 hover:bg-red-50 cursor-pointer"
          >
            🚪 이 방 나가기
          </button>
        </>
      )}
    </div>
  );
}

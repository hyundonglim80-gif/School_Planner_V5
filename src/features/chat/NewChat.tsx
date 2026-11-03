// 💬 대화 창 '+ 새 대화' (P19-2 ■2 · P19-4 ■1). 그룹을 고르고(지금 보는 공간이 그룹이면 그 그룹이 먼저) 사람을 눌러 고른 뒤 '시작':
//   한 명 = 그 선생님과의 1:1 방(이미 있으면 그 방 - 두 사람에 방 하나, dmPairId) · 여러 명 = 고른 사람 방(새 방 - 이름을 비우면 사람 이름 셋 '…').
//   방 문서는 첫 글이 만든다(ChatRoomView '새 1:1'·'새 방') - 글을 보내지 않고 나가면 방은 생기지 않는다.
import { useState } from 'react';
import { newRoomId } from '../../data/chat';
import { useCurrentSpaceId, useSession } from '../../data/session';
import type { GroupSpace } from '../../data/spaceChoice';
import { CHAT_LIMITS, dmPairId, defaultRoomName } from '../../domain/chat';
import { personName, type GroupPeople } from './people';

/** 새 고른 사람 방 - 첫 글과 함께 만든다 */
export interface RoomCreate {
  name: string;
  members: string[];
}

interface Props {
  me: string;
  groups: readonly GroupSpace[];
  people: GroupPeople;
  /** 방 키 · 연 곳의 그룹 · (새 고른 사람 방) 이름·사람 */
  onPick: (key: string, sid: string, create?: RoomCreate) => void;
  onClose: () => void;
}

export default function NewChat({ me, groups, people, onPick, onClose }: Props) {
  const current = useCurrentSpaceId();
  const user = useSession((s) => s.user);
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const [picked, setPicked] = useState(() => groups.find((g) => g.id === current)?.id ?? sorted[0]?.id ?? '');
  const [chosen, setChosen] = useState<string[]>([]);
  const [name, setName] = useState('');
  const group = groups.find((g) => g.id === picked) ?? sorted[0];
  const nameOf = (uid: string) => personName(people, uid, group?.id);
  const members = group
    ? Object.keys(group.members)
        .filter((uid) => uid !== me)
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ko'))
    : [];
  // 고른 차례가 아니라 목록 차례로 (이름 셋도 그 차례)
  const chosenSorted = members.filter((uid) => chosen.includes(uid));
  const myName = (group && people[group.id]?.[me]) || user?.displayName || user?.email || '나';
  const fallbackName = defaultRoomName([myName, ...chosenSorted.map(nameOf)]);
  const tooMany = chosenSorted.length + 1 > CHAT_LIMITS.roomMembers;

  const toggle = (uid: string) => setChosen((c) => (c.includes(uid) ? c.filter((x) => x !== uid) : [...c, uid]));
  const start = () => {
    if (!group || chosenSorted.length === 0 || tooMany) return;
    if (chosenSorted.length === 1) onPick(dmPairId(me, chosenSorted[0]), group.id);
    else onPick(`${group.id}~${newRoomId()}`, group.id, { name: name.trim() || fallbackName, members: [me, ...chosenSorted] });
  };

  return (
    <div data-chat-new-picker className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-black text-slate-700">새 대화</span>
        {sorted.length > 1 ? (
          <select
            data-chat-new-group={group?.id ?? ''}
            value={group?.id ?? ''}
            onChange={(e) => {
              setPicked(e.target.value);
              setChosen([]);
            }}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
          >
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                👥 {g.name || '공유 그룹'}
              </option>
            ))}
          </select>
        ) : (
          <span data-chat-new-group={group?.id ?? ''} className="min-w-0 flex-1 truncate text-xs text-slate-500">
            👥 {group?.name}
          </span>
        )}
        <button type="button" data-chat-new-close onClick={onClose} title="새 대화 닫기" aria-label="새 대화 닫기" className="h-6 w-6 shrink-0 rounded-lg font-bold text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer">
          ✕
        </button>
      </div>
      {members.length === 0 ? (
        <p data-chat-new-none className="text-xs text-slate-500">
          이 그룹에는 아직 다른 선생님이 없습니다. 공유 그룹 창의 초대 코드를 보내 주세요.
        </p>
      ) : (
        <>
          <p className="text-2xs text-slate-500">선생님을 눌러 고르세요 - 한 명 = 1:1 대화, 여러 명 = 고른 사람 방.</p>
          <div className="flex flex-wrap gap-1.5">
            {members.map((uid) => {
              const on = chosen.includes(uid);
              return (
                <button
                  key={uid}
                  type="button"
                  data-chat-new-person={uid}
                  data-picked={on ? 'yes' : 'no'}
                  aria-pressed={on}
                  onClick={() => toggle(uid)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold cursor-pointer ${
                    on ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary'
                  }`}
                >
                  {on ? '✓' : '👤'} {nameOf(uid)}
                </button>
              );
            })}
          </div>
          {chosenSorted.length >= 2 && (
            <input
              data-chat-new-name
              value={name}
              maxLength={CHAT_LIMITS.roomName}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) start();
              }}
              placeholder={`방 이름 (비우면 '${fallbackName}')`}
              aria-label="방 이름"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            />
          )}
          {tooMany && <p className="text-2xs font-bold text-red-600">한 방에는 {CHAT_LIMITS.roomMembers}명까지 들 수 있습니다.</p>}
          <button
            type="button"
            data-chat-new-start={chosenSorted.length >= 2 ? 'room' : chosenSorted.length === 1 ? 'dm' : ''}
            disabled={chosenSorted.length === 0 || tooMany}
            onClick={start}
            className="self-end rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {chosenSorted.length >= 2 ? `💬 방 만들기 (${chosenSorted.length + 1}명)` : '💬 1:1 대화'}
          </button>
        </>
      )}
    </div>
  );
}

// 💬 대화 창 '+ 새 대화' (P19-2 ■2). 그룹을 고르고(지금 보는 공간이 그룹이면 그 그룹이 먼저) 사람을 누르면 그 선생님과의 1:1 방.
//   이미 1:1 방이 있으면 그 방이 열린다(두 사람에 방 하나 - dmPairId). 방 문서는 첫 글이 만든다(ChatRoomView '새 1:1').
//   P19-4: 여럿을 고르면 고른 사람 방.
import { useState } from 'react';
import { useCurrentSpaceId } from '../../data/session';
import type { GroupSpace } from '../../data/spaceChoice';
import { dmPairId } from '../../domain/chat';
import { personName, type GroupPeople } from './people';

interface Props {
  me: string;
  groups: readonly GroupSpace[];
  people: GroupPeople;
  /** 방 키 · 연 곳의 그룹 */
  onPick: (key: string, sid: string) => void;
  onClose: () => void;
}

export default function NewChat({ me, groups, people, onPick, onClose }: Props) {
  const current = useCurrentSpaceId();
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const [picked, setPicked] = useState(() => groups.find((g) => g.id === current)?.id ?? sorted[0]?.id ?? '');
  const group = groups.find((g) => g.id === picked) ?? sorted[0];
  const nameOf = (uid: string) => personName(people, uid, group?.id);
  const members = group
    ? Object.keys(group.members)
        .filter((uid) => uid !== me)
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ko'))
    : [];

  return (
    <div data-chat-new-picker className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-black text-slate-700">새 대화</span>
        {sorted.length > 1 ? (
          <select
            data-chat-new-group={group?.id ?? ''}
            value={group?.id ?? ''}
            onChange={(e) => setPicked(e.target.value)}
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
          <p className="text-2xs text-slate-500">1:1로 이야기할 선생님을 누르세요.</p>
          <div className="flex flex-wrap gap-1.5">
            {members.map((uid) => (
              <button
                key={uid}
                type="button"
                data-chat-new-person={uid}
                onClick={() => group && onPick(dmPairId(me, uid), group.id)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-primary hover:text-primary cursor-pointer"
              >
                👤 {nameOf(uid)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

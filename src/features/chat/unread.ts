// 안 읽은 방 수 (P19-2 ■3) - 머리줄 💬 n·계정 칸 '💬 대화'. Shell의 듣기(data/chat useChatWatch)가 채운 store를 센다(Firebase를 부르지 않는다).
import { useChatStore } from '../../data/chatStore';
import { useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { unreadRoomCount } from '../../domain/chat';

export function useChatUnread(): number {
  const uid = useSession((s) => s.user?.uid ?? '');
  const rooms = useChatStore((s) => s.rooms);
  const reads = useChatStore((s) => s.reads);
  const groupsKey = useMySpaces((s) => s.groups.map((g) => g.id).join(','));
  return uid ? unreadRoomCount(Object.values(rooms), uid, reads, groupsKey ? groupsKey.split(',') : []) : 0;
}

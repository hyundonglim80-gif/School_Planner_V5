// 머리줄 '💬 대화 n' (P19-2 ■3 - MENU 3-1, ✉ 쪽지 뒤). 든 그룹이 있으면 늘, 그룹을 나왔어도 안 읽은 대화(1:1)가 있으면.
// n = 안 읽은 방 수(Shell의 듣기 data/chat useChatWatch가 채운 store - 🔕 방도 센다, 100부터 '99+'). 누르면 단축키 'chat'(창 목록 id라 대화 창이 열린다).
import { runFromButton, useShortcutTitle } from '../../app/keys';
import { useMySpaces } from '../../data/spaceChoice';
import { chatCountLabel } from '../../domain/chat';
import { shortcutTarget } from '../../ui/shortcutTarget';
import { useChatUnread } from './unread';

export default function ChatHeaderButton({ className }: { className: string }) {
  const unread = useChatUnread();
  const hasGroup = useMySpaces((s) => s.groups.length > 0);
  const withShortcut = useShortcutTitle();
  if (!hasGroup && unread === 0) return null;
  const label = unread ? `대화 - 안 읽은 대화 ${chatCountLabel(unread)}개` : '대화';
  return (
    <button
      type="button"
      data-header-chat={unread}
      {...shortcutTarget('chat')}
      onClick={() => runFromButton('chat')}
      className={`${className} ${unread ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
      title={withShortcut(label, 'chat')}
      aria-label={label}
    >
      <span>💬</span>
      <span className="hidden sm:inline">대화</span>
      {unread > 0 && (
        <span data-header-chat-count className="min-w-4 rounded-full bg-primary px-1 text-center text-2xs font-black text-white">
          {chatCountLabel(unread)}
        </span>
      )}
    </button>
  );
}

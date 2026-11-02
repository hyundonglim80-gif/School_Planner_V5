// 머리줄 '✉ 쪽지 n' (P15-2 ■3 - MENU 3-1). 든 그룹이 있으면 늘(⋮에 없어 쪽지 창을 여는 큰 길이다), 그룹을 나왔어도 안 읽은 쪽지가 있으면.
// 안 읽은 수는 Shell의 구독(data/mail useMailWatch)이 store에 - 100부터 '99+'. 누르면 단축키 'mail'(창 목록 id라 쪽지 창이 열린다).
import { runFromButton, useShortcutTitle } from '../../app/keys';
import { useMailStore } from '../../data/mailStore';
import { useMySpaces } from '../../data/spaceChoice';
import { unreadLabel } from '../../domain/mail';
import { shortcutTarget } from '../../ui/shortcutTarget';

export default function MailHeaderButton({ className }: { className: string }) {
  const unread = useMailStore((s) => s.unread);
  const hasGroup = useMySpaces((s) => s.groups.length > 0);
  const withShortcut = useShortcutTitle();
  if (!hasGroup && unread === 0) return null;
  const label = unread ? `쪽지 - 안 읽은 쪽지 ${unreadLabel(unread)}개` : '쪽지';
  return (
    <button
      type="button"
      data-header-mail={unread}
      {...shortcutTarget('mail')}
      onClick={() => runFromButton('mail')}
      className={`${className} ${unread ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
      title={withShortcut(label, 'mail')}
      aria-label={label}
    >
      <span>✉</span>
      <span className="hidden sm:inline">쪽지</span>
      {unread > 0 && (
        <span data-header-mail-count className="min-w-4 rounded-full bg-primary px-1 text-center text-2xs font-black text-white">
          {unreadLabel(unread)}
        </span>
      )}
    </button>
  );
}

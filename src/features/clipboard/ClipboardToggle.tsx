// 📋 클립보드 단추 (P47-1 - 창 칸이 서는 쪽 화면 가장자리, 5장 'P47' ⓓ). Shell이 그린다.
//   창 칸이 닫혀 있으면 화면 오른쪽 가장자리 가운데, 칸이 열려 있으면 칸 안쪽 가장자리의 ▶(칸 모두 닫기) 바로 아래.
//   누르기 = 탭이 없으면 열고, 숨어 있으면 보이고, 보이고 있으면 닫는다(capture.toggleClipboard - 단축키와 같다).
import { useShortcutTitle } from '../../app/keys';
import { shortcutTarget } from '../../ui/shortcutTarget';
import { RIGHT_COLUMN_CSS_WIDTH, useDocked, useSidePopups } from '../../ui/sideColumn';
import { toggleClipboard, useClipboardTab } from './capture';

export default function ClipboardToggle() {
  const tab = useClipboardTab();
  const docked = useDocked();
  // 창 칸이 서 있으면 칸 안쪽 가장자리 (▶ 아래)
  const columnOpen = useSidePopups((s) => s.order.length > 0) && docked;
  const withShortcut = useShortcutTitle();
  const shown = tab === 'shown';
  const label = shown ? '클립보드 닫기' : tab === 'hidden' ? '클립보드 탭 보기' : '클립보드 열기 (복사한 것 모아 보기)';
  return (
    <button
      type="button"
      data-clipboard-toggle={shown ? 'open' : 'closed'}
      {...shortcutTarget('clipboard')}
      // 누르는 순간 글을 쓰던 칸의 커서를 빼앗지 않는다 (붙여넣을 자리를 잃지 않게)
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggleClipboard}
      title={withShortcut(label, 'clipboard')}
      aria-label={label}
      aria-pressed={shown}
      className={`fixed z-[46] w-6 h-14 flex items-center justify-center rounded-l-xl border border-r-0 shadow-md text-xs hover:w-7 transition-all cursor-pointer ${
        shown ? 'bg-primary/15 border-primary/40' : 'bg-white/90 border-slate-200 hover:bg-primary/10'
      }`}
      style={columnOpen ? { right: RIGHT_COLUMN_CSS_WIDTH, top: 'calc(50% + 2.25rem)' } : { right: 0, top: '50%', transform: 'translateY(-50%)' }}
    >
      📋
    </button>
  );
}

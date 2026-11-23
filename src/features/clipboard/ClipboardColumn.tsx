// 📋 클립보드 (V4 components/ClipboardPanel.tsx). P47-1(11-19 사용자) - 왼쪽 칸을 없애고 **창 칸의 탭 하나**('📋 클립보드' - ClipboardWindow).
//   - 이 파일: 화면 가장자리의 작은 📋 단추(창 칸이 서는 쪽) - 껍데기에 늘 있다. 목록 칸은 ./ClipboardList(ClipboardPanel - 탭을 열 때만 받는다, P49-3).
//   - 탭은 다른 창과 같은 줄·같은 폭·같은 ×. 휴대폰은 다른 창처럼 위에 덮고 뒤로가기로 닫는다. 단축키 '클립보드 열기 / 닫기'.
//   - 창 위치가 팝업창(PC)이면 📋가 탭 대신 클립보드 팝업창을 연다(#140 - popupClip·ClipboardPopout).
import { useEffect, useState } from 'react';
import { useShortcutTitle } from '../../app/keys';
import { popupWindowsOn, useSideLeft } from '../../app/layoutPrefs';
import { openWindow, useShownWindowPick, useWindows } from '../../app/windows';
import { RIGHT_COLUMN_CSS_WIDTH, useDocked, useSidePopups } from '../../ui/sideColumn';
import { CLIPBOARD_WINDOW, setClipboardOpen, toggleClipboard, useClipboardPanel } from './capture';
import { shortcutTarget } from '../../ui/shortcutTarget';
import { Glyph } from '../../ui/Icon';

/**
 * 화면 가장자리의 작은 📋 단추 (창 칸이 서는 쪽 - 지금은 오른쪽. 창 칸이 서 있으면 그 안쪽 가장자리에 붙는다).
 * 넓은 화면에서 탭을 열어 둔 채 앱을 다시 열면 탭을 다시 세운다. 휴대폰은 덮으므로 닫고 시작한다.
 */
export default function ClipboardColumn() {
  const docked = useDocked();
  const withShortcut = useShortcutTitle();
  const sideOpen = useSidePopups((s) => s.order.length > 0) && docked;
  // 창 칸이 서는 쪽 가장자리 (P47-2 왼쪽 칸 - 휴대폰·좁은 창은 창이 오른쪽에서 덮어 그대로 오른쪽)
  const left = useSideLeft() && docked;
  const tabOpen = useWindows((s) => s.windows.some((w) => w.id === CLIPBOARD_WINDOW));
  const shown = useShownWindowPick((w) => (w.id === CLIPBOARD_WINDOW ? 'clipboard' : null)) === 'clipboard';

  // 열어 둔 채 다시 열었으면 (처음 한 번): 넓은 화면은 탭을 다시 세우고, 휴대폰은 덮지 않게 닫는다. 팝업창 모드는 팝업창을 스스로 띄우지 않는다
  const [dockedAtStart] = useState(docked);
  useEffect(() => {
    if (!useClipboardPanel.getState().open) return;
    if (dockedAtStart && !popupWindowsOn()) openWindow(CLIPBOARD_WINDOW, undefined, { here: true });
    else setClipboardOpen(false);
  }, [dockedAtStart]);

  return (
    <button
      type="button"
      data-clipboard-toggle={tabOpen && shown ? 'open' : 'closed'}
      {...shortcutTarget('clipboard')}
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggleClipboard}
      title={withShortcut(tabOpen && shown ? '클립보드 닫기' : '클립보드 열기 (복사한 것 모아 보기)', 'clipboard')}
      aria-label={tabOpen && shown ? '클립보드 닫기' : '클립보드 열기'}
      aria-expanded={tabOpen && shown}
      // 늘 📋 - 바로 아래 '오른쪽 칸 닫기 ▶'와 헷갈리지 않게 글은 바꾸지 않고, 탭이 보이면 눌린 모양
      data-clipboard-edge={left ? 'left' : 'right'}
      // 창이 덮는 화면(휴대폰·좁은 창)은 화면 여백(13px) 안에 들게 가늘게 - 넓으면 오른끝 칸(월간 토요일·메모 카드)을 3~10px 덮어
      // 그 칸을 누르면 클립보드가 열렸다(P57-2). 화면 끝에 붙은 손잡이라 손가락이 더 나갈 곳이 없어 가늘어도 누르기 쉽다(높이는 그대로)
      className={`fixed top-1/2 -translate-y-1/2 z-[46] h-14 flex items-center justify-center border shadow-lg transition-all cursor-pointer ${docked ? 'w-6 text-xs hover:bg-primary/10 hover:w-7' : 'w-3 text-[0.625rem]'} ${left ? 'rounded-r-xl border-l-0' : 'rounded-l-xl border-r-0'} ${tabOpen && shown ? 'bg-primary/15 border-primary/40' : 'bg-white/90 border-slate-200'}`}
      // 창 칸이 서 있으면 그 안쪽 가장자리 - 가운데의 '오른쪽 칸 닫기 ▶' 손잡이(Shell) 바로 위
      style={sideOpen ? { [left ? 'left' : 'right']: RIGHT_COLUMN_CSS_WIDTH, top: 'calc(50% - 4rem)' } : { [left ? 'left' : 'right']: 0 }}
    >
      <Glyph e="📋" />
    </button>
  );
}

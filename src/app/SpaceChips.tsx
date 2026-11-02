// 공간 칩 줄 (P17-1 - MENU.md 3-2): 둘째 줄 ◀ 날짜 ▶ 오른쪽에 🔒 개인 · 👥 그룹들 · ⚙️(그룹 관리).
// 그냥 누르기 = 그 공간 하나를 본다(주 공간 - 이 기기에, data/spaceChoice. 겹쳐 보기는 끈다 - 라벨 칩 탐색기식). 하루·주간·월간·년간 화면만 -
// 둘째 줄이 없는 메모·학급 화면은 머리줄 📂 드롭다운(Header SpaceSelect). 둘이 한 화면에 함께 나오지 않는다.
// 겹쳐 보기(P17-2): Ctrl·Shift+누르기(휴대폰 길게 누르기) = 그 공간 일정을 주 공간 것 뒤에 더하기·빼기. 주 공간 칩에는 듣지 않는다.
//   겹친 칩과 겹친 일정은 공간 색 배경으로 구분한다(11-02 사용자 - 처음의 ✓·색 점 대신, domain/spaceColor).
//   aria-pressed는 주 공간 칩만(점검이 '보는 공간'을 찾는다) - 겹친 칩은 data-space-overlay.
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useOverlaySpaceIds } from '../data/select';
import { useCurrentSpaceId, useSession, useSpacePickerShown } from '../data/session';
import { clearOverlay, setSpaceChoice, toggleOverlay, useMySpaces } from '../data/spaceChoice';
import { spaceTone } from '../domain/spaceColor';
import { useLongPress } from '../ui/longPress';
import { runFromButton } from './keys';
import { shortcutTarget } from '../ui/shortcutTarget';

const CHIP = 'px-1.5 py-0.5 text-2xs sm:px-3 sm:py-1 sm:text-xs rounded-lg border transition-all whitespace-nowrap cursor-pointer';

interface Chip {
  sid: string;
  text: string;
  title: string;
  group: boolean;
}

export default function SpaceChips() {
  const shown = useSpacePickerShown();
  const uid = useSession((s) => s.user?.uid);
  const groups = useMySpaces((s) => s.groups);
  const current = useCurrentSpaceId();
  const overlay = useOverlaySpaceIds();
  if (!shown || !uid) return null;
  const chips: Chip[] = [
    { sid: `u_${uid}`, text: '🔒 개인', title: '개인 공간', group: false },
    ...groups.map((g) => ({ sid: g.id, text: `👥 ${g.name}`, title: `👥 ${g.name} (공유 그룹)`, group: true })),
  ];
  // 목록을 받기 전에는 고른 그룹을 믿는다(chooseSpace) - 이름은 아직 모른다
  if (current && !chips.some((c) => c.sid === current)) chips.push({ sid: current, text: '👥 그룹', title: '공유 그룹', group: true });
  const pick = (c: Chip) => {
    clearOverlay(uid);
    setSpaceChoice(uid, c.group ? c.sid : null);
  };
  const toggle = (c: Chip) => {
    if (c.sid !== current) toggleOverlay(uid, c.sid);
  };
  return (
    <div data-space-chips className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 min-w-0">
      {chips.map((c) => (
        <SpaceChip key={c.sid} chip={c} main={c.sid === current} overlaid={overlay.includes(c.sid)} onPick={() => pick(c)} onToggle={() => toggle(c)} />
      ))}
      <button
        type="button"
        data-space-chip-manage
        {...shortcutTarget('group')}
        onClick={() => runFromButton('group')}
        title="공유 그룹 관리"
        aria-label="공유 그룹 관리"
        className={`${CHIP} font-bold bg-white text-slate-500 border-slate-200 hover:bg-slate-50`}
      >
        ⚙️
      </button>
      {/* 겹쳐 보기를 보이는 글로 (P11-1 - '?'는 뜻을 몰랐다). 휴대폰은 설명서 - 자리가 없다 */}
      <span data-space-overlay-hint className="hidden xl:inline text-2xs text-slate-400 whitespace-nowrap">
        Ctrl+누르기 = 겹쳐 보기
      </span>
    </div>
  );
}

function SpaceChip({ chip: c, main, overlaid, onPick, onToggle }: { chip: Chip; main: boolean; overlaid: boolean; onPick: () => void; onToggle: () => void }) {
  const longPress = useLongPress(onToggle);
  const look = main
    ? `font-black shadow-xs ${c.group ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-slate-100 border-slate-400 text-slate-800'}`
    : overlaid
      ? 'font-bold bg-white text-slate-700'
      : 'font-bold bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:border-slate-300';
  const click = (e: ReactMouseEvent) => {
    if (longPress.consumed()) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) onToggle();
    else onPick();
  };
  const how = main ? '보는 공간 - 새 일정은 여기에' : overlaid ? 'Ctrl+누르기(길게 누르기) = 겹쳐 보기 끄기' : 'Ctrl+누르기(길게 누르기) = 이 공간 일정도 겹쳐 보기';
  return (
    <button
      type="button"
      data-space-chip={c.sid}
      data-space-overlay={overlaid ? '1' : undefined}
      aria-pressed={main}
      {...longPress.handlers}
      onClick={click}
      title={`${c.title} - 누르면 이 공간만 보기 · ${how}`}
      style={overlaid ? spaceTone(c.sid) : undefined}
      className={`${CHIP} ${look} select-none`}
    >
      <span className="block truncate max-w-32">{c.text}</span>
    </button>
  );
}

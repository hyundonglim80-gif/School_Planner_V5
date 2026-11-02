// 공간 칩 줄 (P17-1 - MENU.md 3-2): 둘째 줄 ◀ 날짜 ▶ 오른쪽에 🔒 개인 · 👥 그룹들 · ⚙️(그룹 관리).
// 그냥 누르기 = 그 공간을 본다(지금 공간 - 이 기기에, data/spaceChoice). 하루·주간·월간·년간 화면만 -
// 둘째 줄이 없는 메모·학급 화면은 머리줄 📂 드롭다운(Header SpaceSelect). 둘이 한 화면에 함께 나오지 않는다.
import { useCurrentSpaceId, useSession, useSpacePickerShown } from '../data/session';
import { setSpaceChoice, useMySpaces } from '../data/spaceChoice';
import { runFromButton } from './keys';

const CHIP = 'px-1.5 py-0.5 text-2xs sm:px-3 sm:py-1 sm:text-xs rounded-lg border transition-all whitespace-nowrap cursor-pointer';

export default function SpaceChips() {
  const shown = useSpacePickerShown();
  const uid = useSession((s) => s.user?.uid);
  const groups = useMySpaces((s) => s.groups);
  const current = useCurrentSpaceId();
  if (!shown || !uid) return null;
  const chips = [
    { sid: `u_${uid}`, text: '🔒 개인', title: '개인 공간 보기', group: false },
    ...groups.map((g) => ({ sid: g.id, text: `👥 ${g.name}`, title: `👥 ${g.name} 보기 (공유 그룹)`, group: true })),
  ];
  // 목록을 받기 전에는 고른 그룹을 믿는다(chooseSpace) - 이름은 아직 모른다
  if (current && !chips.some((c) => c.sid === current)) chips.push({ sid: current, text: '👥 그룹', title: '공유 그룹 보기', group: true });
  return (
    <div data-space-chips className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 min-w-0">
      {chips.map((c) => {
        const on = c.sid === current;
        const look = on
          ? `font-black shadow-xs ${c.group ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-slate-100 border-slate-400 text-slate-800'}`
          : 'font-bold bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:border-slate-300';
        return (
          <button
            key={c.sid}
            type="button"
            data-space-chip={c.sid}
            aria-pressed={on}
            onClick={() => setSpaceChoice(uid, c.group ? c.sid : null)}
            title={c.title}
            className={`${CHIP} ${look}`}
          >
            <span className="block max-w-32 truncate">{c.text}</span>
          </button>
        );
      })}
      <button
        type="button"
        data-space-chip-manage
        onClick={() => runFromButton('group')}
        title="공유 그룹 관리"
        aria-label="공유 그룹 관리"
        className={`${CHIP} font-bold bg-white text-slate-500 border-slate-200 hover:bg-slate-50`}
      >
        ⚙️
      </button>
    </div>
  );
}

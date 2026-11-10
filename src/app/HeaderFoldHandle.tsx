// 머리줄 접기 손잡이 (메모 요청 #142 - '필요시 상단 고정바를 접어서 내용만 전체화면으로'). Shell 머리줄의 마지막 자식.
//   펴져 있을 때 : 머리줄 아래 테두리 가운데에 걸친 작은 ▲ - 머리줄 안 자리를 쓰지 않는다(휴대폰 첫 줄은 이미 빠듯해 단추를 더하면 줄이 꺾인다).
//   접혔을 때   : 화면 위 가운데에 매달린 ▼ + 보는 날짜 - 하루 화면은 본문에 날짜가 없어, 단축키·밀기로 날을 옮길 때 어디인지 알게 한다.
// 머리줄은 sticky라 absolute의 기준이 된다 - 접힌 머리줄(높이 0)도 화면 위에 붙어 있어 손잡이가 늘 보인다.
// 누르는 자리는 보이는 것보다 조금 넓다(before - 손가락으로도 누르게). 초점은 가져가지 않는다(쓰던 칸의 Ctrl+S가 그대로 듣게).
import { shortcutTarget } from '../ui/shortcutTarget';
import { toggleHeaderFold } from './headerFold';
import { useShortcutTitle } from './keys';
import { dateLabel, useNav } from './nav';

const BASE =
  'absolute left-1/2 -translate-x-1/2 z-10 h-4 min-w-12 flex items-center justify-center gap-1 border border-slate-200 text-2xs leading-none font-bold text-slate-500 whitespace-nowrap select-none cursor-pointer transition-colors hover:text-primary hover:border-primary/50 print:hidden before:absolute before:-inset-x-2 before:-inset-y-1';

export default function HeaderFoldHandle({ folded }: { folded: boolean }) {
  const withShortcut = useShortcutTitle();
  const scope = useNav((s) => s.scope);
  const date = useNav((s) => s.date);
  const label = folded ? '머리줄 펴기' : '머리줄 접기 (내용만 크게 보기)';
  // 메모·학급 화면은 날짜가 없다 - 빈 글
  const when = folded ? dateLabel(scope, date) : '';
  return (
    <button
      type="button"
      data-header-fold={folded ? 'folded' : 'open'}
      {...shortcutTarget('toggleHeader')}
      aria-expanded={!folded}
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggleHeaderFold}
      title={withShortcut(label, 'toggleHeader')}
      aria-label={label}
      className={`${BASE} ${folded ? 'top-0 px-2.5 rounded-b-xl border-t-0 bg-white/90 shadow-md' : 'bottom-0 translate-y-1/2 px-2 rounded-full bg-white shadow-xs'}`}
    >
      <span aria-hidden="true">{folded ? '▼' : '▲'}</span>
      {when && <span data-header-fold-date>{when}</span>}
    </button>
  );
}

// 새 일정 빠른 입력 칩 (V4 components/QuickInputChips.tsx, ROADMAP 11-1). 셈은 domain/quickInput, 값을 넣는 일은 일정 칸(EventPanel)이 한다.
// 적는 대로 날짜·시각·라벨을 알아보고 칩으로 보인다. 누르기 전에는 아무것도 바꾸지 않는다.
export interface QuickChip {
  key: string;
  icon: string;
  label: string;
  title: string;
}

export default function QuickInputChips({
  chips,
  onApply,
  onApplyAll,
}: {
  chips: QuickChip[];
  onApply: (key: string) => void;
  /** 둘 이상이면 '모두 넣기' */
  onApplyAll?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1" data-quick-chips>
      <span className="text-2xs font-black text-slate-400 mr-0.5">빠른 입력</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onApply(c.key)}
          title={c.title}
          data-quick-chip={c.key}
          className="px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-2xs font-bold hover:bg-indigo-100"
        >
          {c.icon} {c.label}
        </button>
      ))}
      {onApplyAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onApplyAll}
          data-quick-chip="all"
          className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-2xs font-black hover:bg-indigo-700"
        >
          모두 넣기
        </button>
      )}
    </div>
  );
}

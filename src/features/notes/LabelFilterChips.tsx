// 라벨로 보기 칩 (V4 features/memo/MemoScreen의 filterChip·DayJournal의 라벨 버튼 - 메모 화면과 하루 기록 칸이 함께 쓴다).
//
// - 윈도우 탐색기처럼(domain/labelTree clickFilterLabel): 그냥 누르기 = 하나만, Ctrl = 더하기·빼기, Shift = 앞서 누른 것부터 범위. ESC = 모두 떼기(부르는 화면이 건다).
// - 하위가 있는 상위는 칩 안 왼쪽 ▸/▾로 접고 편다 - 화면을 열면 모두 접혀 있다. 상위를 고르면 하위도 함께(하위 칩이 옅게 칠해진다).
//   하위 끝 '기타'(점선 - 진짜 라벨이 아니다) = 하위 없이 그 상위만 붙은 항목. 접었어도 고른 하위·기타는 보인다.
// - 고른 칩은 ✓와 테두리 고리, 안 고른 칩은 흐리게(색이 옅은 라벨도 구분되게 - V4). 옆 숫자는 그 칩으로 걸리는 수(부르는 화면이 센다).
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { labelColor } from '../../domain/labels';
import { clickFilterLabel, filterChipOrder, isOtherKey, labelPath, otherKey, otherParentOf, type LabelFilter } from '../../domain/labelTree';
import type { LabelTree } from '../../data/select';

interface ChipProps {
  /** 점검용 data-filter-chip 값 (라벨 id·'기타:상위'·'fav'·'all') */
  chipKey: string;
  text: ReactNode;
  title?: string;
  count: number;
  selected: boolean;
  /** 상위를 골라 함께 걸러지는 하위·기타 */
  included?: boolean;
  /** '기타' 칩 */
  other?: boolean;
  /** 칩 안 왼쪽에 ▸/▾가 앉는다 */
  caret?: boolean;
  row?: boolean;
  selectedStyle?: CSSProperties;
  selectedClass?: string;
  onClick: (e: MouseEvent) => void;
}

/** 칩 하나 (라벨 칩·즐겨찾기·전체 모두 같은 모양) */
export function FilterChip({ chipKey, text, title, count, selected, included, other, caret, row, selectedStyle, selectedClass = '', onClick }: ChipProps) {
  const empty = !!other && count === 0;
  return (
    <button
      type="button"
      data-filter-chip={chipKey}
      aria-pressed={selected}
      onClick={onClick}
      // Shift+누르기가 글자를 긁어 고르지 않게
      onMouseDown={(e) => e.shiftKey && e.preventDefault()}
      title={title ?? (typeof text === 'string' ? text : undefined)}
      className={`relative ${row ? '' : 'w-full'} flex items-center justify-between gap-1 ${empty && !selected ? 'opacity-40' : ''} ${
        caret ? 'pl-6 pr-1.5 sm:pl-7 sm:pr-3' : 'px-1.5 sm:px-3'
      } ${row ? 'py-1' : 'py-1.5 sm:py-2'} rounded-lg sm:rounded-xl text-xs text-left border transition-all cursor-pointer ${
        selected
          ? `font-black ring-2 ring-slate-900/70 ring-offset-1 shadow-sm ${selectedClass}`
          : included
            ? 'font-bold bg-slate-100 text-slate-700 border-slate-400'
            : other
              ? 'font-bold bg-white text-slate-500 border-dashed border-slate-400 hover:opacity-100'
              : 'font-bold bg-slate-50 text-slate-600 border-slate-200 opacity-60 hover:opacity-100'
      }`}
      style={selected ? selectedStyle : undefined}
    >
      <span className="min-w-0 break-keep wrap-anywhere leading-tight">
        {selected && <span className="mr-0.5">✓</span>}
        {text}
      </span>
      <span
        className={`shrink-0 font-black ${
          row
            ? 'ml-1 px-1.5 rounded-full bg-black/10 text-current'
            : 'absolute -top-1.5 -right-1 min-w-4 h-4 px-1 rounded-full bg-slate-600 text-white text-2xs leading-4 text-center sm:static sm:min-w-0 sm:h-auto sm:px-1.5 sm:bg-black/10 sm:text-current sm:text-xs sm:leading-normal'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface Props {
  tree: LabelTree;
  filter: LabelFilter;
  onChange: (next: LabelFilter) => void;
  /** 칩으로 걸리는 수 (라벨 id 또는 otherKey) */
  countOf: (key: string) => number;
  /** 하루 기록 칸 - 한 줄로 */
  row?: boolean;
}

/** 라벨 칩들 (트리 차례) */
export default function LabelFilterChips({ tree, filter, onChange, countOf, row }: Props) {
  /** 펼친 상위 - 화면을 열면 모두 접혀 있다(펼친 것은 이 화면을 보는 동안만 - V4) */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const anchor = useRef<string | null>(null);
  const isSelected = (key: string) => (isOtherKey(key) ? filter.others.includes(otherParentOf(key)) : filter.labels.includes(key));
  const order = filterChipOrder(tree.rows, (p) => !!open[p], isSelected);
  const click = (key: string, e: MouseEvent) => {
    const c = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
    onChange(clickFilterLabel(filter, key, c, order, anchor.current));
    if (!c.shift) anchor.current = key;
  };
  const nameOf = (id: string) => tree.byId.get(id)?.name;

  const chip = (id: string, extra: { caret?: boolean; included?: boolean } = {}) => {
    const l = tree.byId.get(id);
    const c = labelColor(l?.color);
    return (
      <FilterChip
        key={id}
        chipKey={id}
        text={l?.name ?? ''}
        title={labelPath(id, tree.parents, nameOf)}
        count={countOf(id)}
        selected={isSelected(id)}
        included={extra.included}
        caret={extra.caret}
        row={row}
        selectedStyle={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
        onClick={(e) => click(id, e)}
      />
    );
  };

  return (
    <>
      {tree.rows
        .filter((r) => r.depth === 0)
        .map((r) => {
          if (!r.hasChildren) return chip(r.id);
          const isOpen = !!open[r.id];
          const parentOn = filter.labels.includes(r.id);
          const children = tree.rows.filter((c) => c.parent === r.id);
          const other = otherKey(r.id);
          const shown = isOpen ? children : children.filter((c) => filter.labels.includes(c.id));
          const showOther = isOpen || isSelected(other);
          const name = nameOf(r.id) ?? '';
          return (
            <div key={r.id} data-filter-group={r.id} className={row ? 'flex items-center gap-1 flex-wrap' : 'flex flex-col gap-1.5 sm:gap-1'}>
              <div className="relative">
                {chip(r.id, { caret: true })}
                <button
                  type="button"
                  data-filter-caret={r.id}
                  onClick={() => setOpen((prev) => ({ ...prev, [r.id]: !isOpen }))}
                  aria-expanded={isOpen}
                  aria-label={`${name} 하위 라벨 ${isOpen ? '접기' : '펼치기'}`}
                  title={`${name} 하위 라벨 ${isOpen ? '접기' : '펼치기'}`}
                  className="absolute left-0.5 sm:left-1 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded text-2xs text-slate-500 hover:bg-black/10 cursor-pointer"
                >
                  {isOpen ? '▾' : '▸'}
                </button>
              </div>
              {(shown.length > 0 || showOther) && (
                <div className={row ? 'flex items-center gap-1 flex-wrap pl-1 border-l-2 border-slate-200' : 'ml-2 sm:ml-3 pl-1.5 sm:pl-2 border-l-2 border-slate-200 flex flex-col gap-1.5 sm:gap-1'}>
                  {shown.map((c) => chip(c.id, { included: parentOn }))}
                  {showOther && (
                    <FilterChip
                      chipKey={`기타:${r.id}`}
                      text="기타"
                      title={`하위 라벨 없이 ${name}만 붙은 것`}
                      count={countOf(other)}
                      selected={isSelected(other)}
                      included={parentOn}
                      other
                      row={row}
                      selectedStyle={{ backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#94a3b8' }}
                      onClick={(e) => click(other, e)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
    </>
  );
}

/** 숨은 조작 안내 (V4 UX-AUDIT H4 - 키 조합은 글로 박지 않는다는 규칙의 예외: 마우스 누르기 방법이라 단축키가 아니다) */
export const FILTER_HELP = '누르기: 그 라벨 하나만 · Ctrl+누르기: 더하기·빼기 · Shift+누르기: 범위 · ESC: 모두 떼기 · 상위를 고르면 하위도 함께 (▸로 펴서 \'기타\' = 상위만)';

// 쓰는 칸의 라벨 고르기 (V4 EventDrawer '라벨 (다중 선택 가능)' · EntryDrawer '라벨 태그'). 여러 개 고른다.
//
// - 일정: 라벨 차례대로, 고른 칩은 라벨 색 + 테두리 고리.
// - 메모·기록: 트리 차례(하위는 └), 고른 칩은 파랑. 마우스를 올리면 '상위 › 하위'.
// - '+ 새 라벨'(onNewNamesChange를 주면): 목록에 없는 이름을 적고 Enter - 저장할 때 항목과 한 묶음으로 라벨 관리에도 생긴다
//   (data/labels ensureLabelOps). 있는 이름이면 그 라벨을 고른다.
// - ⚙️ 라벨 수정 = 라벨 관리 창의 그 탭.
// 고른 것은 라벨 id로 들고 있다(원칙 3) - 라벨 이름을 바꿔도 고른 것은 그대로다.
import { useState } from 'react';
import { openWindow } from '../../app/windows';
import { labelPath } from '../../domain/labelTree';
import { cleanLabelName, labelColor } from '../../domain/labels';
import type { LabelTree } from '../../data/select';
import type { ItemKind } from '../../data/types';

interface LabelPickerProps {
  kind: ItemKind;
  /** 그 종류의 라벨 (data/select useLabelTree) */
  tree: LabelTree;
  /** 고른 라벨 id */
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** 저장할 때 만들 새 라벨 이름. onNewNamesChange를 주면 '+ 새 라벨' 단추가 생긴다 */
  newNames?: readonly string[];
  onNewNamesChange?: (names: string[]) => void;
}

export default function LabelPicker({ kind, tree, selected, onChange, newNames = [], onNewNamesChange }: LabelPickerProps) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const nameOf = (id: string) => tree.byId.get(id)?.name;
  const rows = kind === 'note' ? tree.rows : tree.list.map((l) => ({ id: l.id, depth: 0 as const }));

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const addNew = () => {
    const name = cleanLabelName(draft).slice(0, 20);
    setDraft('');
    setTyping(false);
    if (!name || !onNewNamesChange) return;
    const have = tree.list.find((l) => cleanLabelName(l.name) === name);
    if (have) {
      if (!selected.includes(have.id)) onChange([...selected, have.id]);
    } else if (!newNames.includes(name)) {
      onNewNamesChange([...newNames, name]);
    }
  };

  return (
    <div data-label-picker={kind} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">라벨 (다중 선택 가능)</span>
        <button
          type="button"
          data-label-picker-settings
          onClick={() => openWindow('labels', { tab: kind })}
          title="라벨 관리 열기"
          className="text-xs text-primary hover:text-blue-700 font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <span aria-hidden>⚙️</span>
          <span>라벨 수정</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {rows.map(({ id, depth }) => {
          const on = selected.includes(id);
          const c = labelColor(tree.byId.get(id)?.color);
          const style = kind === 'event' && on ? { backgroundColor: c.bg, color: c.text, borderColor: c.border } : undefined;
          const cls =
            kind === 'event'
              ? on
                ? 'ring-2 ring-primary ring-offset-1 shadow-xs'
                : 'opacity-70 hover:opacity-100 bg-white text-slate-600 border-slate-200'
              : on
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-slate-100 text-slate-600 border-slate-100 hover:bg-slate-200';
          return (
            <button
              key={id}
              type="button"
              data-label-pick={id}
              aria-pressed={on}
              title={labelPath(id, tree.parents, nameOf)}
              onClick={() => toggle(id)}
              style={style}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${cls}`}
            >
              {depth === 1 && (
                <span className="mr-0.5 opacity-60" aria-hidden>
                  └
                </span>
              )}
              {kind === 'note' && on ? '✓ ' : ''}
              {nameOf(id)}
            </button>
          );
        })}
        {newNames.map((name) => (
          <button
            key={`new:${name}`}
            type="button"
            data-label-pick-pending={name}
            aria-pressed
            onClick={() => onNewNamesChange?.(newNames.filter((n) => n !== name))}
            title="새 라벨 - 저장할 때 라벨 관리에도 생깁니다 (누르면 뺀다)"
            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-dashed border-blue-400 bg-blue-50 text-blue-700 cursor-pointer"
          >
            ✓ {name}
          </button>
        ))}
        {onNewNamesChange &&
          (typing ? (
            <input
              autoFocus
              value={draft}
              data-label-pick-new-input
              aria-label="새 라벨 이름"
              placeholder="새 라벨 이름 + Enter"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addNew();
                } else if (e.key === 'Escape') {
                  // 칸 전체를 닫지 않고 이 입력만 접는다
                  e.stopPropagation();
                  setTyping(false);
                  setDraft('');
                }
              }}
              onBlur={addNew}
              className="px-2 py-1 rounded-lg text-xs border border-blue-300 w-36 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              data-label-pick-new
              onClick={() => setTyping(true)}
              title="라벨 목록에 없는 라벨을 만들어 붙입니다 (저장할 때 라벨 관리에도 생깁니다)"
              className="px-2.5 py-1 rounded-lg text-xs font-bold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 cursor-pointer"
            >
              + 새 라벨
            </button>
          ))}
        {rows.length === 0 && newNames.length === 0 && !onNewNamesChange && (
          <span className="text-xs text-slate-400">라벨이 없습니다 - ⚙️ 라벨 수정에서 더하세요.</span>
        )}
      </div>
    </div>
  );
}

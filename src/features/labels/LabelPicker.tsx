// 쓰는 칸의 라벨 고르기 (V4 EventDrawer '라벨' · EntryDrawer '라벨 태그'). 일정은 하나만, 메모·기록은 Ctrl+누르기로 여러 개
// (휴대폰은 길게 누르기 - P57-2 ■4, 공간 칩·일정 카드와 같은 길 ui/longPress).
//
// - 줄 = '라벨 [고른 라벨 ▾] ……… ⚙️ 라벨 수정' (11-25 메모 요청 #204 '라벨이 많아지면 칩이 칸을 많이 차지 - 버튼을 누르면 고르는 항목이 팝업'):
//   라벨 칩 목록은 단추를 누르면 그 아래에 겹쳐 뜨는 판에(흐름 밖 - 아래 칸을 밀지 않는다). 바깥 누르기·ESC(판만 - 쓰는 칸은 그대로)·단추로 닫는다.
//   판은 닫혀도 DOM에 있다(숨김) - 점검이 고른 칩(aria-pressed)을 그대로 센다(ui/cardTools 떠 있는 묶음과 같은 까닭).
// - 일정: 라벨 차례대로, 고른 칩은 라벨 색 + 테두리 고리. 누르면 그 라벨로 바꾸고 판을 닫는다.
// - 메모·기록: 트리 차례(하위는 └), 고른 칩은 파랑. 마우스를 올리면 '상위 › 하위'. 그냥 누르기 = 그 라벨 하나만(판을 닫는다),
//   Ctrl+누르기·길게 누르기 = 더하기·빼기(판은 열린 채).
// - '+ 새 라벨'(onNewNamesChange를 주면): 목록에 없는 이름을 적고 Enter - 저장할 때 항목과 한 묶음으로 라벨 관리에도 생긴다
//   (data/labels ensureLabelOps). 있는 이름이면 그 라벨을 고른다.
// - ⚙️ 라벨 수정 = 라벨 관리 창의 그 탭.
// 고른 것은 라벨 id로 들고 있다(원칙 3) - 라벨 이름을 바꿔도 고른 것은 그대로다.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { openWindow } from '../../app/windows';
import { labelPath } from '../../domain/labelTree';
import { cleanLabelName, labelColor } from '../../domain/labels';
import type { LabelTree } from '../../data/select';
import type { ItemKind } from '../../data/types';
import { Glyph } from '../../ui/Icon';
import { PICK_ON } from '../../ui/buttons';
import { useLongPress } from '../../ui/longPress';

/** 메모 라벨 고르는 법 - PC는 라벨 줄 제목·칩에 마우스를 올리면 (11-24 메모 요청 #200 - 늘 보이던 '(Ctrl+누르기 = 여러 개)' 대신), 휴대폰은 판 위 글 '길게 누르기 = 여러 개' */
const NOTE_PICK_HELP = '누르기 = 그 라벨 하나만 · Ctrl+누르기 = 여러 개 (더하기·빼기)';

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
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  // 새 라벨 칸을 Enter·ESC로 접으면 '+ 새 라벨' 단추로 초점을 돌린다 (칸이 사라지며 초점이 body로 빠지면 다음 ESC가 쓰는 칸 전체를 닫는다)
  const refocusNew = useRef(false);
  const nameOf = (id: string) => tree.byId.get(id)?.name;
  const rows = kind === 'note' ? tree.rows : tree.list.map((l) => ({ id: l.id, depth: 0 as const }));
  // 지웠거나 모르는 라벨은 단추에 적지 않는다
  const picked = selected.filter((id) => tree.byId.has(id));

  /** 판 닫기 - back이면 초점을 단추로 (판 안에 있던 초점이 숨은 칩과 함께 body로 빠지지 않게) */
  const close = (back: boolean) => {
    setOpen(false);
    if (back) openRef.current?.focus();
  };

  // 바깥을 누르면 닫는다 (초점은 누른 곳에 둔다)
  useEffect(() => {
    if (!open) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    doc.addEventListener('mousedown', onDown);
    return () => doc.removeEventListener('mousedown', onDown);
  }, [open]);

  // 열면 고른 칩(없으면 첫 칩)에 초점 - 판 안의 ESC를 판이 받고, 키보드로는 곧바로 Tab·Enter
  useEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    const first = pop?.querySelector<HTMLElement>('[data-label-pick][aria-pressed="true"]') ?? pop?.querySelector<HTMLElement>('[data-label-pick], [data-label-pick-new]');
    first?.focus({ preventScroll: true });
    // 판이 쓰는 칸 아래로 나가면 보이게 굴린다
    pop?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);

  useEffect(() => {
    if (typing || !refocusNew.current) return;
    refocusNew.current = false;
    newRef.current?.focus();
  }, [typing]);

  // 일정: 하나만(누르면 그 라벨로 바꾸고, 고른 하나를 다시 누르면 뗀다) - 판을 닫는다.
  // 메모·기록: 그냥 누르기 = 그것만(판을 닫는다), Ctrl(맥은 ⌘)·길게 누르기 = 더하기·빼기(판은 열린 채).
  const pick = (id: string, multi: boolean) => {
    const has = selected.includes(id);
    if (kind === 'note' && multi) {
      onChange(has ? selected.filter((x) => x !== id) : [...selected, id]);
      return;
    }
    if (kind === 'note' && newNames.length > 0) onNewNamesChange?.([]);
    onChange(has && selected.length === 1 ? [] : [id]);
    close(true);
  };

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

  /** ESC = 판만 닫는다 (쓰는 칸 전체 닫기로 번지지 않게) */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open || e.key !== 'Escape' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    close(true);
  };

  const summaryChip = (id: string) => {
    const c = labelColor(tree.byId.get(id)?.color);
    return (
      <span
        key={id}
        data-label-picked={id}
        style={kind === 'event' ? { backgroundColor: c.bg, color: c.text, borderColor: c.border } : undefined}
        className={`min-w-0 truncate max-w-[9rem] px-2 py-0.5 rounded-lg border ${kind === 'event' ? '' : PICK_ON}`}
      >
        {nameOf(id)}
      </span>
    );
  };
  const pickedNames = [...picked.map((id) => labelPath(id, tree.parents, nameOf)), ...newNames.map((n) => `${n} (새 라벨)`)];

  return (
    <div data-label-picker={kind} data-label-picker-state={open ? 'open' : 'closed'} ref={rootRef} onKeyDown={onKeyDown} className="relative">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span data-label-picker-hint title={kind === 'note' ? NOTE_PICK_HELP : undefined} className="shrink-0 text-xs font-bold text-slate-500">
            라벨
          </span>
          {/* 고른 라벨을 담은 단추 - 누르면 라벨 판 (#204) */}
          <button
            ref={openRef}
            type="button"
            data-label-picker-open={picked.length + newNames.length}
            aria-expanded={open}
            aria-haspopup="true"
            onClick={() => (open ? close(false) : setOpen(true))}
            title={pickedNames.length > 0 ? `${pickedNames.join(', ')} - 눌러서 라벨 고르기` : '눌러서 라벨 고르기'}
            className={`tap-area min-w-0 max-w-full flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              open ? PICK_ON : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300'
            }`}
          >
            {picked.length + newNames.length > 0 ? (
              <span className="flex items-center gap-1 min-w-0 overflow-hidden">
                {picked.map(summaryChip)}
                {newNames.map((name) => (
                  <span key={`new:${name}`} className="min-w-0 truncate max-w-[9rem] px-2 py-0.5 rounded-lg border border-dashed border-blue-400 bg-blue-50 text-blue-700">
                    {name}
                  </span>
                ))}
              </span>
            ) : (
              <span data-label-picker-none className="px-1 text-slate-500">
                라벨 고르기
              </span>
            )}
            <span aria-hidden className="shrink-0 text-slate-500">
              <Glyph e="▾" />
            </span>
          </button>
        </div>
        <button
          type="button"
          data-label-picker-settings
          onClick={() => openWindow('labels', { tab: kind })}
          title="라벨 관리 열기"
          className="tap-area shrink-0 text-xs text-primary hover:text-blue-700 font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <span aria-hidden><Glyph e="⚙" /></span>
          <span>라벨 수정</span>
        </button>
      </div>
      {/* 라벨 판 - 단추 아래에 겹쳐 뜬다(흐름 밖). 닫혀도 DOM에 남는다(숨김) */}
      <div
        ref={popRef}
        data-label-picker-pop
        role="group"
        aria-label="라벨 고르기"
        className={`${open ? '' : 'hidden'} absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-lg p-2.5 space-y-1.5`}
      >
        {kind === 'note' && <p className="hidden pointer-coarse:block text-2xs text-slate-500">길게 누르기 = 여러 개</p>}
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
                  ? PICK_ON
                  : 'bg-slate-100 text-slate-600 border-slate-100 hover:bg-slate-200';
            return (
              <PickChip
                key={id}
                id={id}
                on={on}
                title={kind === 'note' ? `${labelPath(id, tree.parents, nameOf)}\n${NOTE_PICK_HELP}` : labelPath(id, tree.parents, nameOf)}
                style={style}
                className={cls}
                onPick={(multi) => pick(id, multi)}
                long={kind === 'note'}
              >
                {depth === 1 && (
                  <span className="mr-0.5 opacity-60" aria-hidden>
                    └
                  </span>
                )}
                {kind === 'note' && on ? '✓ ' : ''}
                {nameOf(id)}
              </PickChip>
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
                    refocusNew.current = true;
                    addNew();
                  } else if (e.key === 'Escape') {
                    // 판·칸 전체를 닫지 않고 이 입력만 접는다
                    e.stopPropagation();
                    refocusNew.current = true;
                    setTyping(false);
                    setDraft('');
                  }
                }}
                onBlur={addNew}
                className="px-2 py-1 rounded-lg text-xs border border-blue-300 w-36 focus:outline-none"
              />
            ) : (
              <button
                ref={newRef}
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
            <span className="text-xs text-slate-500">라벨이 없습니다 - <Glyph e="⚙" /> 라벨 수정에서 더하세요.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 라벨 칩 하나 - 메모는 길게 누르기(손가락) = Ctrl+누르기(더하기·빼기). 길게 누른 뒤 손을 뗀 click은 넘긴다 */
function PickChip({ id, on, title, style, className, onPick, long, children }: {
  id: string;
  on: boolean;
  title: string;
  style?: CSSProperties;
  className: string;
  onPick: (multi: boolean) => void;
  long: boolean;
  children: ReactNode;
}) {
  const press = useLongPress(() => long && onPick(true));
  return (
    <button
      type="button"
      data-label-pick={id}
      aria-pressed={on}
      title={title}
      {...(long ? press.handlers : {})}
      onClick={(e) => {
        if (press.consumed()) return;
        onPick(e.ctrlKey || e.metaKey);
      }}
      style={style}
      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer select-none ${className}`}
    >
      {children}
    </button>
  );
}

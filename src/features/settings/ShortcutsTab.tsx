// 환경설정 '단축키' 탭 (V4 components/ShortcutModal.tsx를 탭으로 → P28-1 사용자 요청으로 '키가 걸린 것만').
//
// 단축키를 더하는 길은 '⌨️ 단축키 설정'(눌러서 고르기 - app/shortcutRecord) 하나다(11-09 사용자 '일원화' - PLAN 5장 'P28').
// 이 탭에는 키가 걸린 것만(기본 키 + 내가 만든 것 - 기능·창 안 탭) 줄로 보이고, 줄마다 [키 바꾸기](띠의 키 단계로 곧바로)·[해제].
// 모두 누르는 즉시 저장된다(예전의 기능 52개마다 키 칸 + '저장'은 없앴다). 해제·기본값으로는 안내의 '되돌리기'로 되돌린다.
// 누를 단추가 없는 기능(NO_BUTTON)은 키가 없어도 늘 줄이 있다 - 눌러서 고를 수 없으니 여기서 [키 정하기](없으면 해제한 뒤 다시 걸 길이 없다).
// 겹친 줄(⚠)은 옛 자료에서만 나온다 - 눌러서 정하면 겹친 쪽에서 키를 뺀다(domain/shortcuts assignBinding).
// 끝나면 이 탭이 그 줄을 짚는다(focusId - 같은 줄을 또 바꿔도 다시 짚게 focusToken = 연 params).
import { useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../../app/toast';
import { canRun, setCustomShortcuts, setExtraShortcuts, setShortcutOverrides, setTabShortcuts, useExtraBindings, useShortcutOverrides } from '../../app/keys';
import { detectDeviceKind } from '../../app/prefs';
import { shortcutLabel, TAB_SHORTCUTS } from '../../app/tabShortcuts';
import { customShortcutOf } from '../../app/customShortcuts';
// 환경설정 값 키의 이름·할 일을 단다(팝업창에서 이 탭만 열어도 이름이 보이게)
import '../../app/optionShortcuts';
import '../../app/pressShortcuts';
import {
  allBindings,
  assignBinding,
  bindingOf,
  findConflicts,
  FIXED_SHORTCUTS,
  formatAnyBinding,
  isCustomShortcutId,
  isExtraShortcutId,
  overridesFromBindings,
  resolveBindings,
  SHORTCUT_ACTIONS,
  type AnyShortcutId,
  type Binding,
  type BindingEntry,
  type CustomBindings,
  type ShortcutId,
  type ShortcutOverrides,
  type TabBindings,
} from '../../domain/shortcuts';
import { isPressShortcutId } from '../../domain/pressTarget';

const NONE: Binding = { ctrl: false, alt: false, shift: false, key: '' };
/** 창 안 탭(P18-2) 묶음 이름 - 기능 묶음 뒤 */
const TAB_GROUP = '창 안 탭';
/** 환경설정 값(P28-2) 묶음 이름 - 창 안 탭 뒤 */
const CUSTOM_GROUP = '환경설정 값';
/** 단추 대신 누르기(P28-3) 묶음 이름 - 맨 뒤 */
const PRESS_GROUP = '단추';
const GROUP_TITLE: Record<string, string> = {
  [TAB_GROUP]: '내가 만든 단축키 (창 안 탭)',
  [CUSTOM_GROUP]: '내가 만든 단축키 (환경설정 값)',
  [PRESS_GROUP]: '내가 만든 단축키 (단추 대신 누르기)',
};
const SMALL_BTN = 'px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer shrink-0';

/**
 * 누를 단추가 없는(또는 다른 단추와 하는 일이 달라 표시를 달지 않은) 기능 - 키가 없어도 줄을 보인다.
 * 단추에 shortcutTarget을 달면 여기서 뺀다.
 */
export const NO_BUTTON: ReadonlySet<ShortcutId> = new Set<ShortcutId>([
  'undo',
  'checklist',
  'scopePrev',
  'scopeNext',
  'recurring',
  'forwarding',
  'newCourse',
  'toggleTheme',
]);

const sameBinding = (a: Binding, b: Binding) => a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.key === b.key;

function ShortcutRow({
  entry,
  conflicted,
  focused,
  focusToken,
  onChange,
  onClear,
}: {
  entry: BindingEntry;
  conflicted: boolean;
  /** 방금 정한 줄 - 보이게 옮기고 잠깐 짚는다 */
  focused: boolean;
  focusToken: unknown;
  onChange: () => void;
  onClear: () => void;
}) {
  const { id, action, binding } = entry;
  const label = shortcutLabel(id);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rowRef.current;
    if (!focused || !el) return;
    // 검색으로 간 카드처럼 잠깐 짚는다(features/search/focus의 .search-focus)
    el.scrollIntoView?.({ block: 'center' });
    el.classList.add('search-focus');
    const t = window.setTimeout(() => el.classList.remove('search-focus'), 2600);
    return () => window.clearTimeout(t);
  }, [focused, focusToken]);
  // 아직 V5로 옮기지 않은 기능(옛 키를 가져온 것) - 흐리게. 창 안 탭은 있는 창만 목록에 있다
  const ready = isCustomShortcutId(id) ? !!customShortcutOf(id) : isExtraShortcutId(id) || canRun(id);
  const isDefault = !!action && !!binding.key && sameBinding(action.def, binding);

  return (
    <div
      ref={rowRef}
      data-shortcut-row={id}
      data-conflict={conflicted || undefined}
      data-shortcut-row-focus={focused || undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border p-2.5 ${conflicted ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}
    >
      <span
        className={`text-sm font-bold min-w-0 flex-1 ${ready ? 'text-slate-700' : 'text-slate-400'}`}
        title={ready ? undefined : '아직 V5로 옮기지 않은 기능입니다. 키는 남겨 둡니다.'}
      >
        {label}
        {conflicted && <span className="ml-1.5 text-xs text-red-600">⚠ 같은 키를 쓰는 것이 있습니다</span>}
      </span>
      <kbd
        data-shortcut-key
        className={`min-w-16 px-2 py-1 text-center bg-white border rounded-lg text-sm font-mono font-bold text-slate-800 shrink-0 ${conflicted ? 'border-red-300' : 'border-slate-200'}`}
      >
        {binding.key ? formatAnyBinding(id, binding) : '없음'}
      </kbd>
      {isDefault && (
        <span data-shortcut-default className="text-2xs font-bold text-slate-400 shrink-0">
          기본
        </span>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-shortcut-change={id}
          onClick={onChange}
          title={binding.key ? '고르기를 건너뛰고 이 단축키에 줄 키만 다시 누릅니다' : '누를 단추가 없는 기능이라 여기서 키를 정합니다'}
          className={`${SMALL_BTN} bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary`}
        >
          {binding.key ? '키 바꾸기' : '키 정하기'}
        </button>
        {binding.key && (
          <button
            type="button"
            data-shortcut-clear={id}
            onClick={onClear}
            title="이 단축키를 없앱니다 (기능은 단추·메뉴로 그대로 씁니다)"
            className={`${SMALL_BTN} bg-white border-slate-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50`}
          >
            해제
          </button>
        )}
      </div>
    </div>
  );
}

export default function ShortcutsTab({
  focusId,
  focusToken,
  onStartRecord,
  onChangeKey,
}: {
  focusId?: AnyShortcutId;
  /** 연 params - 같은 줄을 다시 짚을 때 */
  focusToken?: unknown;
  /** 눌러서 고르기(단축키 설정)를 시작한다 - 환경설정 창은 닫는다 */
  onStartRecord: () => void;
  /** 그 줄의 키만 다시 받는다 */
  onChangeKey: (id: AnyShortcutId) => void;
}) {
  const overrides = useShortcutOverrides((s) => s.overrides);
  const extra = useExtraBindings();
  const bindings = useMemo(() => resolveBindings(overrides), [overrides]);
  const conflicted = useMemo(() => new Set<AnyShortcutId>(findConflicts(bindings, extra).flat()), [bindings, extra]);

  // 키가 걸린 것만(+ 누를 단추가 없는 기능), 기능 묶음 차례(단축키 목록) 다음 창 안 탭(탭 목록 차례) · 환경설정 값(이름 차례)
  const groups = useMemo(() => {
    const out = new Map<string, BindingEntry[]>();
    for (const a of SHORTCUT_ACTIONS) if (!out.has(a.group)) out.set(a.group, []);
    out.set(TAB_GROUP, []);
    out.set(CUSTOM_GROUP, []);
    out.set(PRESS_GROUP, []);
    const tabOrder = new Map(TAB_SHORTCUTS.map((t, i) => [t.id, i]));
    for (const e of allBindings(bindings, extra)) {
      if (!e.binding.key && !(e.action && NO_BUTTON.has(e.action.id))) continue;
      out.get(e.action ? e.action.group : isPressShortcutId(e.id) ? PRESS_GROUP : isCustomShortcutId(e.id) ? CUSTOM_GROUP : TAB_GROUP)!.push(e);
    }
    out.get(TAB_GROUP)!.sort((a, b) => (tabOrder.get(a.id as never) ?? 0) - (tabOrder.get(b.id as never) ?? 0));
    for (const g of [CUSTOM_GROUP, PRESS_GROUP]) out.get(g)!.sort((a, b) => shortcutLabel(a.id).localeCompare(shortcutLabel(b.id), 'ko'));
    return [...out.entries()].filter(([, list]) => list.length > 0);
  }, [bindings, extra]);

  /** 바꾸기 전 값으로 (안내의 되돌리기) */
  const undoTo = (before: { overrides: ShortcutOverrides; tabs: TabBindings; custom: CustomBindings }) => ({
    label: '되돌리기',
    run: () => {
      setShortcutOverrides(before.overrides);
      setTabShortcuts(before.tabs);
      setCustomShortcuts(before.custom);
    },
  });

  const clear = (id: AnyShortcutId) => {
    const before = useShortcutOverrides.getState();
    const was = formatAnyBinding(id, bindingOf(id, bindings, extra));
    const next = assignBinding(bindings, id, NONE, extra);
    setShortcutOverrides(overridesFromBindings(next.bindings));
    setExtraShortcuts(next.extra);
    showToast(`⌨️ '${shortcutLabel(id)}' 단축키(${was})를 해제했습니다`, 5000, 'info', undoTo(before));
  };

  const reset = () => {
    if (!window.confirm('단축키를 처음 값으로 되돌릴까요?\n바꾼 키는 기본 키로 돌아가고, 내가 만든 단축키(창 안 탭·환경설정 값·단추)는 모두 빠집니다.')) return;
    const before = useShortcutOverrides.getState();
    setShortcutOverrides({});
    setTabShortcuts({});
    setCustomShortcuts({});
    showToast('⌨️ 단축키를 기본값으로 되돌렸습니다', 5000, 'info', undoTo(before));
  };

  // 눌러서 정하기는 키보드가 있는 PC만 (휴대폰 단축키는 따로 저장된다 - 단추를 숨긴다)
  const [pc] = useState(() => detectDeviceKind() === 'pc');

  return (
    <div>
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
          {pc && (
            <button
              type="button"
              data-shortcut-record-start
              onClick={onStartRecord}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              ⌨️ 단축키 설정
            </button>
          )}
          <button
            type="button"
            data-shortcut-reset
            onClick={reset}
            className="ml-auto px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            기본값으로
          </button>
        </div>
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
          {pc ? (
            <>
              단축키를 더하려면 <strong className="text-slate-800">⌨️ 단축키 설정</strong>을 누른 뒤, 키로 쓰고 싶은 메뉴·단추를 평소처럼{' '}
              <strong className="text-slate-800">직접 눌러</strong> 찾아가 <strong className="text-slate-800">완료</strong> → 키를 누릅니다(마지막에 누른 것이 고른 것).
            </>
          ) : (
            <>단축키를 더하는 것은 PC에서 합니다(⌨️ 단축키 설정 - 단추를 눌러 고른다). 휴대폰 키는 PC와 따로 저장됩니다.</>
          )}
          <br />
          아래에는 <strong className="text-slate-800">키가 걸린 것만</strong> 보입니다(누를 단추가 없는 되돌리기·이전 화면 같은 기능은 키가 없어도 보여 <strong className="text-slate-800">키 정하기</strong>로 정합니다).
          누르는 즉시 저장되고, 해제한 기능은 단추·메뉴로 그대로 씁니다.
        </div>
      </div>

      <div data-shortcut-list>
        {/* 누를 단추가 없는 기능은 늘 있어 목록이 비지 않는다 */}
        {groups.map(([groupName, entries]) => (
          <div key={groupName} data-shortcut-group={groupName} className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-2">{GROUP_TITLE[groupName] ?? groupName}</h3>
            <div className="space-y-2">
              {entries.map((e) => (
                <ShortcutRow
                  key={e.id}
                  entry={e}
                  conflicted={conflicted.has(e.id)}
                  focused={focusId === e.id}
                  focusToken={focusToken}
                  onChange={() => onChangeKey(e.id)}
                  onClear={() => clear(e.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 바꾸지 않는 것들. 목록에서 빠지면 "없는 기능"으로 보이므로 까닭과 함께 보여 준다 */}
      <div className="px-5 py-4">
        <h3 className="text-sm font-black text-slate-800 mb-0.5">고정 단축키</h3>
        <p className="text-xs text-slate-400 mb-2">아래는 바꿀 수 없습니다.</p>
        <div className="space-y-2">
          {FIXED_SHORTCUTS.map((fixed) => (
            <div key={fixed.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-500 min-w-0">{fixed.label}</span>
                <kbd className="px-2 py-1 shrink-0 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-500">{fixed.keys}</kbd>
              </div>
              <p className="text-xs text-slate-400 mt-1">{fixed.why}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

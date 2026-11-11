// 껍데기의 키 처리 한 곳 (V4 Layout handleKeyDown·runShortcut).
//   ESC    : 오른쪽 줄 전체(창·쓰는 칸)를 닫는다 - 저장 안 한 글이 있으면 먼저 묻는다. 보이는 탭 하나만은 단축키 closePanel(Alt+W).
//   Ctrl+S : 브라우저 '다른 이름으로 저장'을 막는다. 저장은 커서가 든 칸·창이 받는다(ui/useSaveKey).
//   그 밖  : 환경설정에서 바꿀 수 있는 단축키(domain/shortcuts). 키 조합은 거기서, 하는 일은 여기서(runShortcut).
//            창을 여는 단축키는 창 목록의 같은 id 창을 연다 - 창을 등록하면 단축키도 저절로 선다.
// 글을 칠 때(입력칸·글 칸)는 Ctrl·Alt 없는 단축키를 듣지 않는다(글자가 먹히지 않으면 곤란하다).
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  allBindings,
  formatActionBinding,
  formatBinding,
  isCustomShortcutId,
  isModifierOnly,
  isTabShortcutId,
  matchesEvent,
  resolveBindings,
  SHORTCUT_ACTIONS,
  splitExtraBindings,
  type AnyShortcutId,
  type CustomBindings,
  type ExtraBindings,
  type ShortcutId,
  type ShortcutOverrides,
  type TabBindings,
} from '../domain/shortcuts';
import { runCustomShortcut } from './customShortcuts';
import type { PressTargets } from '../domain/pressTarget';
import { isSaveKey } from '../ui/useSaveKey';
import { showToast } from './toast';
import { goToday, setScope, setToggle, stepDate, stepScope, useNav } from './nav';
import { toggleThemeMode } from './theme';
import { toggleHeaderFold } from './headerFold';
import { stepFontSizeByKey } from './fontSize';
import { activeOf, useSidePopups } from '../ui/sideColumn';
import { popOutWindow } from './popout';
import { closeAllWindows, closeShownWindow, closeWindow, getWindowDef, openWindow, useWindows } from './windows';
import { runTabShortcut, tabTargetOf } from './tabShortcuts';

interface ShortcutKeys {
  overrides: ShortcutOverrides;
  tabs: TabBindings;
  custom: CustomBindings;
  /** 단추 대신 누르기(P28-3)의 그 단추 - id 'press.…' → 자리·찾기·이름. 키는 custom에. 해제해도 여기는 남는다(되돌리기) - 서버에는 키 있는 것만(app/prefs) */
  press: PressTargets;
}

/**
 * 기본값에서 바꾼 단축키만 (V4 shortcutOverrides) + 창 안 탭 키(tabs - P18-2, 키를 준 탭만) + 내가 만든 것(custom - P28, 환경설정 값·단추).
 * 이 기기 사본 - 계정(기기 종류마다)과는 app/prefs.ts가 맞춘다
 */
export const useShortcutOverrides = create<ShortcutKeys>()(
  persist(() => ({ overrides: {} as ShortcutOverrides, tabs: {} as TabBindings, custom: {} as CustomBindings, press: {} as PressTargets }), { name: 'sp5-shortcuts' }),
);

export function setShortcutOverrides(overrides: ShortcutOverrides) {
  useShortcutOverrides.setState({ overrides });
}

export function setTabShortcuts(tabs: TabBindings) {
  useShortcutOverrides.setState({ tabs });
}

export function setCustomShortcuts(custom: CustomBindings) {
  useShortcutOverrides.setState({ custom });
}

/** 단추 적은 것을 더한다 (고른 단추를 저장할 때·서버 값 - 있던 것은 남긴다: 해제한 것의 되돌리기) */
export function addPressTargets(press: PressTargets) {
  useShortcutOverrides.setState((s) => ({ press: { ...s.press, ...press } }));
}

/** 창 안 탭 + 내가 만든 것 한 목록 (domain/shortcuts allBindings·assignBinding이 받는 것) */
export const extraBindingsOf = (s: Pick<ShortcutKeys, 'tabs' | 'custom'>): ExtraBindings => ({ ...s.tabs, ...s.custom });

/** 한 목록을 칸 둘에 나눠 넣는다 (assignBinding이 돌려준 것) */
export function setExtraShortcuts(extra: ExtraBindings) {
  const { tabs, custom } = splitExtraBindings(extra);
  useShortcutOverrides.setState({ tabs, custom });
}

/** 화면에서 - 창 안 탭 + 내가 만든 것 (바뀔 때만 새 객체) */
export function useExtraBindings(): ExtraBindings {
  const tabs = useShortcutOverrides((s) => s.tabs);
  const custom = useShortcutOverrides((s) => s.custom);
  return useMemo(() => extraBindingsOf({ tabs, custom }), [tabs, custom]);
}

/** 창이 아닌 단축키가 하는 일. 없는 기능(아직 옮기지 않은 것)은 false - 브라우저 기본 동작을 막지 않는다. */
const ACTIONS: Partial<Record<ShortcutId, () => void>> = {
  scopeDay: () => setScope('day'),
  scopeWeek: () => setScope('week'),
  scopeMonth: () => setScope('month'),
  scopeYear: () => setScope('year'),
  scopeBoard: () => setScope('board'),
  scopeMemo: () => setScope('memo'),
  scopeClass: () => setScope('class'),
  scopePrev: () => stepScope(-1),
  scopeNext: () => stepScope(1),
  datePrev: () => stepDate(-1),
  dateNext: () => stepDate(1),
  dateToday: goToday,
  toggleWeekend: () => setToggle('showWeekend', !useNav.getState().showWeekend),
  toggleEvents: () => setToggle('showEvents', !useNav.getState().showEvents),
  toggleClass: () => setToggle('showClass', !useNav.getState().showClass),
  // 쓰는 칸의 체크리스트 - 커서가 든 쓰는 칸이 받는다 (P3-2)
  checklist: () => window.dispatchEvent(new Event('sp5-checklist')),
  // 이 화면 인쇄 - 화면마다 인쇄 모양은 P6-3. 그 전에는 브라우저 인쇄
  print: () => window.print(),
  // 어둡게 ↔ 밝게 (V4 ROADMAP 17)
  toggleTheme: toggleThemeMode,
  // 머리줄 접기 ↔ 펴기 (메모 요청 #142 - 손잡이 ▲▼와 같다)
  toggleHeader: toggleHeaderFold,
  // 지금 화면 글자 크기 5%씩 (메모 요청 #145 - 환경설정 보기 탭 − / 초기화 / +와 같다, 누를 때마다 쌓인다)
  fontSmaller: () => stepFontSizeByKey(-1),
  fontLarger: () => stepFontSizeByKey(1),
  fontReset: () => stepFontSizeByKey(0),
  // 보고 있는 칸 하나만 닫기 (10-26 - ESC는 모두)
  closePanel: () => {
    closeShownWindow();
  },
  // 휴지통 열기 / 닫기 - 열려 있으면 닫는다 (사용자 요청 #125)
  trash: () => {
    const open = useWindows.getState().windows.find((w) => w.id === 'trash');
    if (open) closeWindow(open.key);
    else openWindow('trash');
  },
  // 오른쪽 칸에서 보이는 탭 하나를 새 창으로 빼기 (#125 - 칸 머리 ↗와 같다). 창이 그린 칸일 때만
  popOut: () => {
    const side = useSidePopups.getState();
    const id = activeOf(side);
    const key = id === null ? undefined : side.owners[id];
    if (key !== undefined) void popOutWindow(key);
    else showToast('새 창으로 옮길 칸이 오른쪽에 없습니다.');
  },
};

/** 이 단축키(·메뉴 항목)가 지금 할 일이 있나 - 아직 옮기지 않은 기능은 false */
export function canRun(id: ShortcutId): boolean {
  return !!ACTIONS[id] || !!getWindowDef(id);
}

/** 단추·메뉴에서 누른 것. 아직 옮기지 않은 기능이면 안내한다(단축키는 조용히 브라우저에 맡긴다). */
export function runFromButton(id: ShortcutId) {
  if (!runShortcut(id)) showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
}

const escapeActions = new Set<() => void>();

/** ESC에 함께 할 일 (여러 개 고르기 끝내기 등). 떼는 함수를 돌려준다 */
export function addEscapeAction(run: () => void): () => void {
  escapeActions.add(run);
  return () => {
    escapeActions.delete(run);
  };
}

/** 화면·기능이 더하는 단축키 동작 (예: P3-1 되돌리기, P4-2 클립보드). 되돌리는 함수를 돌려준다. */
export function setShortcutAction(id: ShortcutId, run: () => void): () => void {
  ACTIONS[id] = run;
  return () => {
    if (ACTIONS[id] === run) delete ACTIONS[id];
  };
}

/** 단축키(또는 ⋮ 메뉴·화면 단추)가 하는 일. 한 일이 있으면 true. */
export function runShortcut(id: ShortcutId): boolean {
  const action = ACTIONS[id];
  if (action) {
    action();
    return true;
  }
  if (getWindowDef(id)) {
    openWindow(id);
    return true;
  }
  return false;
}

/** 글을 치는 자리인가 (입력칸·글 칸·고르기·글 편집 영역) */
function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  if (t instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(t.type);
  return t.isContentEditable;
}

/** only = 이 단축키만 듣는다 (새 창으로 옮긴 창 - app/PopoutShell: 화면이 없어 화면·날짜 단축키는 할 일이 없다) */
export function handleAppKeyDown(e: KeyboardEvent, only?: ReadonlySet<ShortcutId>) {
  if (isSaveKey(e)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    // 고르던 것을 먼저 푼다(여러 개 고르기 - 오른쪽 칸도 함께 닫힌다, 라벨로 보기 칩과 같다)
    for (const fn of [...escapeActions]) fn();
    closeAllWindows();
    return;
  }
  if (isModifierOnly(e) || e.isComposing) return;
  const typing = isTypingTarget(e.target);
  const state = useShortcutOverrides.getState();
  // 창 안 탭(P18-2)·내가 만든 것(P28)은 새 창으로 옮긴 창에서는 듣지 않는다 - 그 창에는 다른 창·화면이 없다
  for (const { id, action, binding } of allBindings(resolveBindings(state.overrides), only ? {} : extraBindingsOf(state))) {
    if (only && !only.has(id as ShortcutId)) continue;
    if (!matchesEvent(binding, e, action)) continue;
    // 입력칸에 글자를 쓰는 중이면 수식키 없는 단축키는 무시한다. 되돌리기는 글 칸에서는 글 되돌리기가 먼저.
    if (typing && ((!binding.ctrl && !binding.alt) || id === 'undo')) continue;
    // 이 판이 모르는 내가 만든 것(나중 판이 더한 것)은 건너뛴다 - 키를 막지 않는다
    if (isCustomShortcutId(id)) {
      if (!runCustomShortcut(id)) continue;
      e.preventDefault();
      return;
    }
    if (isTabShortcutId(id) ? runTabShortcut(id) : runShortcut(id)) e.preventDefault();
    return;
  }
}

export function useAppKeys() {
  useEffect(() => {
    window.addEventListener('keydown', handleAppKeyDown);
    return () => window.removeEventListener('keydown', handleAppKeyDown);
  }, []);
}

/**
 * 툴팁 글. 단축키가 정해져 있을 때만 뒤에 붙인다 (지금 설정값에서 - 글로 적어 두면 바꿨을 때 거짓말이 된다, V4).
 * 키를 정하지 않은 기능은 글만.
 */
export function useShortcutTitle(): (text: string, id: ShortcutId) => string {
  const overrides = useShortcutOverrides((s) => s.overrides);
  const bindings = resolveBindings(overrides);
  return (text, id) => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === id)!;
    return bindings[id].key ? `${text} (단축키: ${formatActionBinding(action, bindings[id])})` : text;
  };
}

/**
 * 창 안 탭 단추에 펼칠 것 (P18-2): 단축키 설정이 고르는 표시(data-shortcut-target) + 키가 있으면 툴팁.
 * 고를 수 없는 탭은 빈 것. 같은 일을 하는 단축키가 있는 탭(백업 '보내기' 등)은 그 단축키(app/tabShortcuts ALIAS).
 */
export function useTabTarget(): (window: string, tab: string) => { 'data-shortcut-target'?: AnyShortcutId; title?: string } {
  const { overrides, tabs } = useShortcutOverrides();
  const bindings = resolveBindings(overrides);
  return (window, tab) => {
    const id = tabTargetOf(window, tab);
    if (!id) return {};
    const key = isTabShortcutId(id) ? tabs[id] : bindings[id];
    if (!key?.key) return { 'data-shortcut-target': id };
    const action = isTabShortcutId(id) ? undefined : SHORTCUT_ACTIONS.find((a) => a.id === id);
    return { 'data-shortcut-target': id, title: `단축키: ${action ? formatActionBinding(action, key) : formatBinding(key)}` };
  };
}

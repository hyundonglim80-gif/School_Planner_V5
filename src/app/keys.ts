// 껍데기의 키 처리 한 곳 (V4 Layout handleKeyDown·runShortcut).
//   ESC    : 오른쪽 줄 전체(창·쓰는 칸)를 닫는다 - 저장 안 한 글이 있으면 먼저 묻는다.
//   Ctrl+S : 브라우저 '다른 이름으로 저장'을 막는다. 저장은 커서가 든 칸·창이 받는다(ui/useSaveKey).
//   그 밖  : 환경설정에서 바꿀 수 있는 단축키(domain/shortcuts). 키 조합은 거기서, 하는 일은 여기서(runShortcut).
//            창을 여는 단축키는 창 목록의 같은 id 창을 연다 - 창을 등록하면 단축키도 저절로 선다.
// 글을 칠 때(입력칸·글 칸)는 Ctrl·Alt 없는 단축키를 듣지 않는다(글자가 먹히지 않으면 곤란하다).
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  formatActionBinding,
  isModifierOnly,
  matchesEvent,
  resolveBindings,
  SHORTCUT_ACTIONS,
  type ShortcutId,
  type ShortcutOverrides,
} from '../domain/shortcuts';
import { isSaveKey } from '../ui/useSaveKey';
import { showToast } from './toast';
import { goToday, setScope, setToggle, stepDate, stepScope, useNav } from './nav';
import { toggleThemeMode } from './theme';
import { closeAllWindows, getWindowDef, openWindow } from './windows';

/** 기본값에서 바꾼 단축키만 (V4 shortcutOverrides). 이 기기 사본 - 계정(기기 종류마다)과는 app/prefs.ts가 맞춘다 */
export const useShortcutOverrides = create<{ overrides: ShortcutOverrides }>()(
  persist(() => ({ overrides: {} as ShortcutOverrides }), { name: 'sp5-shortcuts' }),
);

export function setShortcutOverrides(overrides: ShortcutOverrides) {
  useShortcutOverrides.setState({ overrides });
}

/** 창이 아닌 단축키가 하는 일. 없는 기능(아직 옮기지 않은 것)은 false - 브라우저 기본 동작을 막지 않는다. */
const ACTIONS: Partial<Record<ShortcutId, () => void>> = {
  scopeDay: () => setScope('day'),
  scopeWeek: () => setScope('week'),
  scopeMonth: () => setScope('month'),
  scopeYear: () => setScope('year'),
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
};

/** 이 단축키(·메뉴 항목)가 지금 할 일이 있나 - 아직 옮기지 않은 기능은 false */
export function canRun(id: ShortcutId): boolean {
  return !!ACTIONS[id] || !!getWindowDef(id);
}

/** 단추·메뉴에서 누른 것. 아직 옮기지 않은 기능이면 안내한다(단축키는 조용히 브라우저에 맡긴다). */
export function runFromButton(id: ShortcutId) {
  if (!runShortcut(id)) showToast('🚧 아직 V5로 옮기지 않은 기능입니다.');
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

export function handleAppKeyDown(e: KeyboardEvent) {
  if (isSaveKey(e)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    closeAllWindows();
    return;
  }
  if (isModifierOnly(e) || e.isComposing) return;
  const typing = isTypingTarget(e.target);
  const bindings = resolveBindings(useShortcutOverrides.getState().overrides);
  for (const action of SHORTCUT_ACTIONS) {
    const binding = bindings[action.id];
    if (!matchesEvent(binding, e, action)) continue;
    // 입력칸에 글자를 쓰는 중이면 수식키 없는 단축키는 무시한다. 되돌리기는 글 칸에서는 글 되돌리기가 먼저.
    if (typing && ((!binding.ctrl && !binding.alt) || action.id === 'undo')) continue;
    if (runShortcut(action.id)) e.preventDefault();
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

// 단축키 설정 - 메뉴·단추를 눌러 고르기 (P18-1, 사용자 요청 11-02 - PLAN 5장 'P18').
//   고르기(pick): 평소처럼 누르며 메뉴를 찾아 들어간다(누른 것은 그대로 동작한다). 누른 단추에 `data-shortcut-target`(ui/shortcutTarget)이
//                 있으면 그 기능을 '고른 것'으로 - 마지막에 누른 것이 이긴다. 단추 자리가 아니라 기능(단축키 id)을 기억한다.
//   키(key)     : 띠의 '완료'를 누르면 키를 받는다. 받는 동안 누른 키는 앱 단축키·글 칸으로 가지 않는다(window capture에서 먼저 받아 멈춘다).
//   ESC         : 어느 때나 기록 취소(오른쪽 칸 닫기는 하지 않는다).
// 띠(화면)는 app/ShortcutRecordBar - 여기 손잡이를 고르는 동안에만 단다.
import { create } from 'zustand';
import {
  assignBinding,
  bindingFromEvent,
  formatActionBinding,
  isModifierOnly,
  isShortcutId,
  labelOf,
  overridesFromBindings,
  recordKeyIssue,
  resolveBindings,
  SHORTCUT_ACTIONS,
  type Binding,
  type ShortcutId,
} from '../domain/shortcuts';
import { setShortcutOverrides, useShortcutOverrides } from './keys';
import { showErrorToast, showToast } from './toast';
import { openWindow } from './windows';

export type RecordStage = 'off' | 'pick' | 'key';

interface RecordState {
  stage: RecordStage;
  /** 고른 기능 */
  picked: ShortcutId | null;
  /** 방금 누른 것이 단축키로 만들 수 없는 단추였나 (앞에 고른 것은 그대로) */
  miss: boolean;
  /** 키 단계에서 누른 조합 (아직 누르지 않았으면 null, 키가 빈 조합 = 지우기) */
  binding: Binding | null;
}

const OFF: RecordState = { stage: 'off', picked: null, miss: false, binding: null };

export const useShortcutRecord = create<RecordState>(() => OFF);

export function startShortcutRecord() {
  useShortcutRecord.setState({ ...OFF, stage: 'pick' });
}

export function cancelShortcutRecord() {
  useShortcutRecord.setState(OFF);
}

/** 완료 - 고른 것이 있으면 키를 받는다 */
export function finishPick() {
  if (!useShortcutRecord.getState().picked) return;
  // 누른 단추에 초점이 남으면 Space·Enter가 그 단추를 누른다 - 키 칸만 받게 비운다
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  useShortcutRecord.setState({ stage: 'key', binding: null, miss: false });
}

/** 다시 고르기 (고른 것은 남긴다 - 다른 것을 누르면 바뀐다) */
export function repick() {
  useShortcutRecord.setState({ stage: 'pick', binding: null, miss: false });
}

/** 누르면 버튼처럼 동작하는 것 - 고를 수 없는 것을 눌렀다고 알릴 자리 */
const PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], input, select, label, summary';

/** document capture - 누른 단추가 무엇인지 본다. 누르기는 막지 않는다(메뉴를 찾아 들어가야 한다). */
export function onRecordClick(e: MouseEvent) {
  if (useShortcutRecord.getState().stage !== 'pick') return;
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t.closest('[data-shortcut-record]')) return;
  const id = t.closest<HTMLElement>('[data-shortcut-target]')?.dataset.shortcutTarget;
  if (id && isShortcutId(id)) useShortcutRecord.setState({ picked: id, miss: false });
  else if (t.closest(PRESSABLE)) useShortcutRecord.setState({ miss: true });
}

/** window capture - 앱 단축키(app/keys)·창의 ESC보다 먼저 받는다 */
export function onRecordKey(e: KeyboardEvent) {
  const { stage } = useShortcutRecord.getState();
  if (stage === 'off') return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    cancelShortcutRecord();
    return;
  }
  // 고르는 동안 다른 키는 평소대로(단축키로 메뉴를 열어도 된다)
  if (stage !== 'key' || e.key === 'Tab') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (isModifierOnly(e) || e.isComposing) return;
  if (e.key === 'Backspace' || e.key === 'Delete') {
    useShortcutRecord.setState({ binding: { ctrl: false, alt: false, shift: false, key: '' } });
    return;
  }
  useShortcutRecord.setState({ binding: bindingFromEvent(e) });
}

/** 받은 키를 그 기능에 저장한다(겹친 기능에서는 뺀다). 끝나면 환경설정 단축키 탭에서 그 줄을 짚는다. */
export function saveRecordedKey(): boolean {
  const { picked, binding } = useShortcutRecord.getState();
  if (!picked || !binding) return false;
  const issue = recordKeyIssue(binding);
  if (issue) {
    showErrorToast(issue);
    return false;
  }
  const now = resolveBindings(useShortcutOverrides.getState().overrides);
  const { bindings, cleared } = assignBinding(now, picked, binding);
  setShortcutOverrides(overridesFromBindings(bindings));
  const action = SHORTCUT_ACTIONS.find((a) => a.id === picked)!;
  const away = cleared.length > 0 ? ` · ${cleared.map((id) => `'${labelOf(id)}'`).join(', ')}에서는 뺐습니다` : '';
  showToast(binding.key ? `⌨️ '${action.label}' = ${formatActionBinding(action, binding)}${away}` : `⌨️ '${action.label}' 단축키를 지웠습니다`, 4000);
  cancelShortcutRecord();
  openWindow('settings', { tab: 'shortcuts', focus: picked });
  return true;
}

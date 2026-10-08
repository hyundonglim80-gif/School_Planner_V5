// 환경설정 '단축키' 탭 (V4 components/ShortcutModal.tsx를 탭으로). 조합을 직접 정한다.
//
// 다른 탭과 달리 '저장'을 눌러야 바뀐다 - 키를 하나씩 바꾸는 동안 두 기능이 같은 키를 잠깐 쓰게 되는데, 그때마다 바로 바뀌면
// 엉뚱한 기능이 돈다. '저장'은 겹치는 키가 있으면 막는다. 저장해도 창은 닫히지 않는다. 탭을 바꿔도 고치던 것은 남고,
// ESC로 모두 닫을 때는 먼저 묻는다(창 목록의 저장 안 한 글 묻기).
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { canRun, setShortcutOverrides, useShortcutOverrides } from '../../app/keys';
import { registerUnsavedCheck } from '../../app/windows';
import {
  bindingFromEvent,
  findConflicts,
  FIXED_SHORTCUTS,
  isModifierOnly,
  labelOf,
  overridesFromBindings,
  resolveBindings,
  SHORTCUT_ACTIONS,
  type Binding,
  type ShortcutId,
} from '../../domain/shortcuts';

/** 입력칸에 보여줄 글자. 화살표처럼 이름이 긴 키는 기호로 */
const KEY_DISPLAY: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
};

type Bindings = Record<ShortcutId, Binding>;
const keyOf = (b: Bindings) => JSON.stringify(SHORTCUT_ACTIONS.map((a) => b[a.id]));

function ModifierBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
      <input
        type="checkbox"
        data-shortcut-mod={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-slate-300 accent-primary cursor-pointer"
      />
      <span className={`text-xs font-bold ${checked ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
    </label>
  );
}

function ShortcutRow({
  id,
  label,
  binding,
  conflicted,
  onChange,
}: {
  id: ShortcutId;
  label: string;
  binding: Binding;
  conflicted: boolean;
  onChange: (b: Binding) => void;
}) {
  // 칸을 누르고 키를 누르면 그 키가 들어간다. 화살표·Space처럼 글자가 없는 키도 있어 글자 대신 눌린 키를 잡는다.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') return; // 다음 칸으로 넘어가기는 막지 않는다
    if (e.key === 'Escape') return; // ESC는 지금처럼 창을 닫는다
    e.preventDefault();
    // ⚠️ 여기서 멈추지 않으면 화면 전체 단축키(app/keys)까지 올라간다 - 휴지통에 준 Alt+T를 다른 칸에 넣으려는 순간 휴지통이 열렸다(V4)
    e.stopPropagation();
    const native = e.nativeEvent;
    if (isModifierOnly(native)) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange({ ...binding, key: '' });
      return;
    }
    // 누른 대로 수식키까지 같이 채운다. 체크로 따로 손봐도 된다.
    onChange(bindingFromEvent(native));
  };
  // 아직 V5로 옮기지 않은 기능도 키는 정해 둘 수 있다(옮기면 그 키로 선다) - 흐리게
  const ready = canRun(id);

  return (
    <div
      data-shortcut-row={id}
      data-conflict={conflicted || undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border p-2.5 ${
        conflicted ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'
      }`}
    >
      <span
        className={`text-sm font-bold min-w-0 flex-1 ${ready ? 'text-slate-700' : 'text-slate-400'}`}
        title={ready ? undefined : '아직 V5로 옮기지 않은 기능입니다. 키는 미리 정해 둘 수 있습니다.'}
      >
        {label}
      </span>
      <div className="flex items-center gap-2.5 shrink-0">
        <ModifierBox label="Ctrl" checked={binding.ctrl} onChange={(v) => onChange({ ...binding, ctrl: v })} />
        <ModifierBox label="Alt" checked={binding.alt} onChange={(v) => onChange({ ...binding, alt: v })} />
        <ModifierBox label="Shift" checked={binding.shift} onChange={(v) => onChange({ ...binding, shift: v })} />
      </div>
      <input
        type="text"
        readOnly
        data-shortcut-key
        value={KEY_DISPLAY[binding.key] || binding.key}
        onKeyDown={handleKeyDown}
        placeholder="없음"
        aria-label={`${label} 키`}
        title="이 칸을 누른 뒤 원하는 키를 누르세요. 비우려면 Backspace (비우면 그 기능은 단축키 없이 씁니다)."
        className={`w-20 shrink-0 px-2 py-1.5 text-center bg-white border rounded-lg text-sm font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
          conflicted ? 'border-red-300' : 'border-slate-200'
        }`}
      />
    </div>
  );
}

/** 창 아랫단에 놓을 것과 Ctrl+S가 부를 저장을 창(SettingsWindow)에 알린다 */
export interface ShortcutsTabHandle {
  save: () => void;
  reset: () => void;
}

export default function ShortcutsTab({
  ref,
  onStatus,
}: {
  ref: Ref<ShortcutsTabHandle>;
  onStatus: (s: { dirty: boolean; conflict: string | null; saved: boolean }) => void;
}) {
  const stored = useShortcutOverrides((s) => s.overrides);
  const [draft, setDraft] = useState<Bindings>(() => resolveBindings(stored));
  const [saved, setSaved] = useState(false);
  // 마지막으로 맞춘 저장값. 고치지 않은 채로 다른 기기에서 바뀌면 따라간다(고치던 중이면 그대로 둔다).
  const base = useRef(resolveBindings(stored));
  useEffect(() => {
    const next = resolveBindings(stored);
    // 앞 저장값을 붙잡아 둔다 - setDraft의 함수는 나중에 돌아 그때는 base가 이미 새 값이다
    const prev = keyOf(base.current);
    setDraft((d) => (keyOf(d) === prev ? next : d));
    base.current = next;
  }, [stored]);

  const conflicts = useMemo(() => findConflicts(draft), [draft]);
  const conflicted = useMemo(() => new Set(conflicts.flat()), [conflicts]);
  const dirty = keyOf(draft) !== keyOf(resolveBindings(stored));
  const conflict = conflicts.length > 0 ? `${labelOf(conflicts[0][0])} / ${labelOf(conflicts[0][1])}` : null;

  useEffect(() => onStatus({ dirty, conflict, saved }), [dirty, conflict, saved, onStatus]);

  // ESC로 모두 닫기 전에 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => dirty;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  useImperativeHandle(ref, () => ({
    save: () => {
      // 키가 비어 있는 것은 '쓰지 않음'이다. 막지 않는다.
      if (conflict) return showErrorToast(`같은 조합을 두 기능이 쓰고 있습니다: ${conflict}`);
      setShortcutOverrides(overridesFromBindings(draft));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    reset: () => {
      setDraft(resolveBindings());
      showToast("기본값으로 되돌렸습니다. '저장'을 눌러야 적용됩니다.");
    },
  }));

  const groups = useMemo(() => {
    const out: Record<string, typeof SHORTCUT_ACTIONS> = {};
    for (const action of SHORTCUT_ACTIONS) (out[action.group] ||= []).push(action);
    return Object.entries(out);
  }, []);

  return (
    <div>
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
          키 칸을 누른 뒤 <strong className="text-slate-800">원하는 키를 그대로 누르면</strong> 들어갑니다. 글자·숫자·기호는 물론 화살표나 Space도
          됩니다. Ctrl / Alt / Shift는 체크로 켜고 끕니다.
          <br />
          켜고 끄는 기능(주말·일정·수업)에 화살표를 쓰면 <strong className="text-slate-800">↑와 ↓가 같이</strong> 동작합니다.
          <br />
          '메뉴 열기'는 기본값이 <strong className="text-slate-800">없음</strong>입니다. 자주 쓰는 것만 골라 정해 두세요. 비워 두면 그 기능은
          메뉴에서만 씁니다. 바꾼 키는 PC와 휴대폰을 따로 계정에 저장합니다.
        </div>
      </div>

      {groups.map(([groupName, actions]) => (
        <div key={groupName} className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-800 mb-2">{groupName}</h3>
          <div className="space-y-2">
            {actions.map((action) => (
              <ShortcutRow
                key={action.id}
                id={action.id}
                label={action.label}
                binding={draft[action.id]}
                conflicted={conflicted.has(action.id)}
                onChange={(b) => setDraft((prev) => ({ ...prev, [action.id]: b }))}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 바꾸지 않는 것들. 목록에서 빠지면 "없는 기능"으로 보이므로 까닭과 함께 보여 준다 */}
      <div className="px-5 py-4">
        <h3 className="text-sm font-black text-slate-800 mb-0.5">고정 단축키</h3>
        <p className="text-xs text-slate-400 mb-2">아래는 바꿀 수 없습니다.</p>
        <div className="space-y-2">
          {FIXED_SHORTCUTS.map((fixed) => (
            <div key={fixed.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-500 min-w-0">{fixed.label}</span>
                <kbd className="px-2 py-1 shrink-0 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-500">
                  {fixed.keys}
                </kbd>
              </div>
              <p className="text-xs text-slate-400 mt-1">{fixed.why}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

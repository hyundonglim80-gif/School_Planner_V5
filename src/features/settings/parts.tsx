// 환경설정 창의 작은 부품 (V4 SettingsModal의 Section·ToggleRow·고르기 단추).
import type { CSSProperties, ReactNode } from 'react';
import { useOptionTarget } from '../../app/optionShortcuts';
import { glyphText } from '../../ui/glyphText';
import { PICK_ON } from '../../ui/buttons';

/**
 * 그 값이 어디에 남나 (P44-3 - 칸마다 '이 기기에만 남습니다'·'계정에 저장해 PC와 휴대폰이 같습니다'를 글로 되풀이하던 것을 같은 모양 표시 하나로).
 * device = 이 기기에만(localStorage) · all = 계정에 하나(PC·휴대폰 같게) · split = 계정에, PC끼리·휴대폰끼리 따로(app/prefs DevicePrefs)
 */
export type Saved = 'device' | 'all' | 'split';

const SAVED: Record<Saved, { text: string; title: string }> = {
  device: { text: '이 기기만', title: '이 기기에만 남습니다 - 다른 기기에서는 따로 고릅니다' },
  all: { text: '모든 기기', title: '계정에 저장해 PC와 휴대폰이 같습니다' },
  split: { text: 'PC·휴대폰 따로', title: '계정에 저장하고 PC와 휴대폰은 따로 기억합니다(휴대폰에서 바꾼 것이 PC까지 따라가지 않습니다)' },
};

export function SavedBadge({ saved }: { saved: Saved }) {
  const { text, title } = SAVED[saved];
  return (
    <span data-settings-saved={saved} title={title} className="shrink-0 px-1.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-2xs font-bold text-slate-500">
      {text}
    </span>
  );
}

export function Section({ title, desc, children, id, saved }: { title: string; desc?: ReactNode; children: ReactNode; id?: string; saved?: Saved }) {
  return (
    <div data-settings-section={id} className="px-5 py-4 border-b border-slate-100 last:border-b-0">
      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-slate-800">
        <span>{glyphText(title)}</span>
        {saved && <SavedBadge saved={saved} />}
      </h3>
      {desc && <p className="text-xs text-slate-500 mt-0.5 mb-2 leading-relaxed">{desc}</p>}
      <div className={desc ? '' : 'mt-2'}>{children}</div>
    </div>
  );
}

/** 한 줄짜리 켜기/끄기. option = 환경설정 값 단축키 이름(app/optionShortcuts - 단축키 설정이 이 줄을 고른다, 키가 있으면 툴팁) */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  id,
  option,
  saved,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  option?: string;
  /** 칸 안에서 줄마다 남는 곳이 다를 때만 (보기 쉽게) - 칸이 하나면 Section saved */
  saved?: Saved;
}) {
  const target = useOptionTarget();
  return (
    <label {...(option ? target(option) : {})} className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-700">
          {label}
          {saved && <SavedBadge saved={saved} />}
        </span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
      <input
        type="checkbox"
        data-settings-toggle={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 shrink-0 rounded text-primary focus:ring-primary border-slate-300 accent-primary cursor-pointer"
      />
    </label>
  );
}

/** 여럿 가운데 하나 고르기 (누르는 즉시). option = 환경설정 값 단축키 이름(값마다 단축키 설정이 고른다 - app/optionShortcuts) */
interface ChoicesProps<T extends string | number> {
  options: ReadonlyArray<{ value: T; label: string; style?: CSSProperties }>;
  value: T;
  onChange: (v: T) => void;
  /** 점검용 data-choice="<name>:<값>" */
  name: string;
  option?: string;
}

export function Choices<T extends string | number>({ options, value, onChange, name, option }: ChoicesProps<T>) {
  const target = useOptionTarget();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          {...(option ? target(option, opt.value) : {})}
          data-choice={`${name}:${opt.value}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={opt.style}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
            value === opt.value
              ? PICK_ON
              : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** 이름 + 여럿 가운데 하나 - 한 구역에 고르기가 여럿일 때(P59 화면 배치). 좁으면 고르기가 이름 아래로 */
export function ChoiceRow<T extends string | number>({ label, hint, saved, ...choices }: { label: string; hint?: string; saved?: Saved } & ChoicesProps<T>) {
  return (
    <div data-settings-row={choices.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-700">
          {label}
          {saved && <SavedBadge saved={saved} />}
        </span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
      <Choices {...choices} />
    </div>
  );
}

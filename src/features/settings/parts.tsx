// 환경설정 창의 작은 부품 (V4 SettingsModal의 Section·ToggleRow·고르기 단추).
import type { CSSProperties, ReactNode } from 'react';

export function Section({ title, desc, children, id }: { title: string; desc?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div data-settings-section={id} className="px-5 py-4 border-b border-slate-100 last:border-b-0">
      <h3 className="text-sm font-black text-slate-800">{title}</h3>
      {desc && <p className="text-xs text-slate-400 mt-0.5 mb-2 leading-relaxed">{desc}</p>}
      <div className={desc ? '' : 'mt-2'}>{children}</div>
    </div>
  );
}

/** 한 줄짜리 켜기/끄기 */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400 mt-0.5">{hint}</span>}
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

/** 여럿 가운데 하나 고르기 (누르는 즉시) */
export function Choices<T extends string | number>({
  options,
  value,
  onChange,
  name,
}: {
  options: ReadonlyArray<{ value: T; label: string; style?: CSSProperties }>;
  value: T;
  onChange: (v: T) => void;
  /** 점검용 data-choice="<name>:<값>" */
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          data-choice={`${name}:${opt.value}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={opt.style}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
            value === opt.value
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

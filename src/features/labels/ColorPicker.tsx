// 라벨 색 고르기 (V4 LabelModal ColorPickerDropdown). 색 단추(▼)를 누르면 색 목록이 펼쳐진다.
// 라벨 목록은 세로로 스크롤되는 상자 안에 있어 absolute로 두면 잘린다 - body로 빼내(portal) 화면 기준(fixed)으로 띄운다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LABEL_COLORS, labelColor, PICKER_COLORS } from '../../domain/labels';

/** 색 9개 + 여백. 아래로 펼 자리가 있는지 볼 때만 쓴다 */
const PANEL_HEIGHT = 300;

export default function ColorPicker({ color, onChange, name }: { color: string; onChange: (color: string) => void; name?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const active = labelColor(color);

  const place = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const up = rect.bottom + PANEL_HEIGHT > window.innerHeight && rect.top > PANEL_HEIGHT;
    setPos({
      top: up ? Math.max(8, rect.top - PANEL_HEIGHT - 6) : rect.bottom + 6,
      left: Math.min(rect.left, Math.max(8, window.innerWidth - 140)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    // 스크롤하면 단추가 움직여 붙어 있던 자리가 어긋난다 - 그냥 닫는다
    const close = () => setOpen(false);
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, place]);

  return (
    <div className="relative inline-block shrink-0" ref={wrapRef}>
      <button
        type="button"
        data-label-color={name}
        data-color={color}
        onClick={() => setOpen(!open)}
        title={`색 바꾸기 (지금 ${active.label})`}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
      >
        <span className="w-5 h-5 rounded-full border shadow-2xs shrink-0" style={{ backgroundColor: active.bg, borderColor: active.border }} />
        <span className="text-2xs text-slate-400 font-black leading-none select-none">▼</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            data-color-list
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100000 }}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 min-w-[130px] flex flex-col gap-0.5"
          >
            {PICKER_COLORS.map((key) => {
              const val = LABEL_COLORS[key];
              const selected = key === color;
              return (
                <button
                  key={key}
                  type="button"
                  data-color-option={key}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                    selected ? 'bg-slate-100 text-slate-900 font-black' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border shadow-2xs shrink-0" style={{ backgroundColor: val.bg, borderColor: val.border }} />
                  <span>{val.label}</span>
                  {selected && <span className="ml-auto text-blue-600 text-xs font-bold">✓</span>}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

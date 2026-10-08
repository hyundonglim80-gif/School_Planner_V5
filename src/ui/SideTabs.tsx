// 오른쪽 줄 위의 탭 (V4 PopupFrame.SideTabs). 칸이 둘 이상일 때만 - 껍데기가 한 번 그린다.
// 탭 이름은 칸의 이름표·제목과 쓰던 글 첫 줄에서 읽는다(칸이 이름을 따로 넘기지 않아도 되게).
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { activateSideSlot, activeOf, getSideColumn, useSidePopups } from './sideColumn';

/** 칸의 탭 이름: 칸 이름(aria-label·제목) + 쓰던 글 첫 줄 */
function slotTitle(el: Element | null): string {
  if (!el) return '…';
  const head = el.querySelector('h1, h2, h3');
  let label = (el.getAttribute('aria-label') || head?.textContent || '창').trim().replace(/\s+/g, ' ');
  label = label.replace(/ 쓰기$/, '');
  const ta = el.querySelector('textarea');
  const first = (ta?.value || '').split('\n').find((l) => l.trim())?.trim() || '';
  const text = first ? `${label} · ${first}` : label;
  return text.length > 22 ? text.slice(0, 21) + '…' : text;
}

/** 칸 안의 닫기 단추를 누른다 (칸마다 닫는 일 - 저장 안 한 글 묻기 등 - 을 그대로 따른다). 단추는 [data-close]. */
function closeSlot(id: string) {
  const el = getSideColumn().querySelector(`[data-side-slot="${CSS.escape(id)}"]`);
  el?.querySelector<HTMLButtonElement>('[data-close]')?.click();
}

export default function SideTabs() {
  const order = useSidePopups((s) => s.order);
  const shownId = useSidePopups(activeOf);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  // 글을 칠 때 탭 이름도 따라가게 (가볍게 - 1초에 한 번)
  useEffect(() => {
    if (order.length < 2) return;
    const col = getSideColumn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const on = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setTick((t) => t + 1);
      }, 1000);
    };
    col.addEventListener('input', on);
    return () => {
      col.removeEventListener('input', on);
      if (timer) clearTimeout(timer);
    };
  }, [order.length]);
  useLayoutEffect(() => {
    const col = getSideColumn();
    const next: Record<string, string> = {};
    for (const id of order) next[id] = slotTitle(col.querySelector(`[data-side-slot="${CSS.escape(id)}"]`));
    // 칸이 그려진 뒤에야 이름을 읽을 수 있다(DOM에서 읽는다)
    // oxlint-disable-next-line react/set-state-in-effect
    setTitles((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [order, shownId, tick]);
  if (order.length < 2) return null;
  return createPortal(
    <div
      role="tablist"
      aria-label="오른쪽 칸"
      data-side-tabs
      className="sticky top-0 z-20 flex items-end gap-1 overflow-x-auto bg-slate-100 border-b border-slate-200 px-1.5 pt-1.5 shrink-0"
      style={{ order: -1 }}
    >
      {order.map((id) => {
        const on = id === shownId;
        return (
          <div
            key={id}
            role="tab"
            aria-selected={on}
            data-side-tab={id}
            className={`group flex items-center max-w-[11rem] shrink-0 rounded-t-lg border border-b-0 text-xs font-bold ${
              on ? 'bg-white text-slate-800 border-slate-200' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-white/70'
            }`}
          >
            <button type="button" onClick={() => activateSideSlot(id)} title={titles[id]} className="pl-2.5 pr-1 py-1.5 truncate">
              {titles[id] || '…'}
            </button>
            <button
              type="button"
              aria-label="탭 닫기"
              title="이 칸 닫기"
              data-side-tab-close
              onClick={() => closeSlot(id)}
              className="px-1.5 py-1 text-slate-400 hover:text-rose-600"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>,
    getSideColumn(),
  );
}

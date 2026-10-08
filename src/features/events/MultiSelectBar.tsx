// 여러 개 고르기 - 화면 아래 동작 줄 (V4 components/MultiEventActionBar.tsx). 껍데기(Shell)에 하나, 고르는 동안만 보인다.
//
// N 선택됨 · ☑ 완료 · 🏷️ 라벨 · 📅 옮기기 · 🗑️ 삭제 · ✕ - 동작을 하거나 ✕·ESC를 누르면 여러 개 고르기가 끝난다(V4 그대로).
// 모두 한 묶음으로 적고 안내의 되돌리기 하나로 모두 되돌린다. 지우기는 묻지 않는다(V5 - 지운 표시 + 되돌리기, V4는 확인 창).
// 옮기기는 처음에 내일(V4 - '오늘 못 한 것 내일로'가 가장 흔하다), ◀ ▶로 하루씩.
import { useEffect, useMemo, useRef, useState } from 'react';
import { addEscapeAction, setShortcutAction } from '../../app/keys';
import { addDays, shortDateLabel } from '../../domain/dateUtils';
import { labelColor } from '../../domain/labels';
import { isPeriod } from '../../domain/period';
import { itemsOn, useDocs, useLabelTree } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { completePicked, deletePicked, movePicked, relabelPicked } from './actions';
import { orderAfter } from './eventOps';
import { effectiveAttrs, formOf } from './eventForm';
import { useCarried } from './forward';
import { endMulti, toggleMulti, useMulti } from './multi';
import { pickedCount, resolvePicks } from './multiOps';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 - 고른 것은 그대로 둔다 */
};

/** 바깥을 누르면 닫히는 작은 판 */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);
  return ref;
}

export default function MultiSelectBar() {
  const sid = useCurrentSpaceId();
  const { on, picks } = useMulti();
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const carried = useCarried(sid);
  const today = carried.today;
  const list = useMemo(() => resolvePicks(picks, items), [picks, items]);
  const count = pickedCount(list);
  const [panel, setPanel] = useState<'label' | 'move' | null>(null);
  const [moveDate, setMoveDate] = useState(() => addDays(today, 1));
  const [busy, setBusy] = useState(false);
  const closePanel = useMemo(() => () => setPanel(null), []);
  const labelRef = useOutside(panel === 'label', closePanel);
  const moveRef = useOutside(panel === 'move', closePanel);

  // ⋮ '여러 개 고르기' · ESC로 끝내기
  useEffect(() => {
    const offs = [setShortcutAction('multiSelect', toggleMulti), addEscapeAction(endMulti)];
    return () => offs.forEach((off) => off());
  }, []);
  // 켤 때마다 옮길 날은 내일, 판은 닫고
  const [wasOn, setWasOn] = useState(on);
  if (on !== wasOn) {
    setWasOn(on);
    if (on) {
      setMoveDate(addDays(today, 1));
      setPanel(null);
    }
  }

  if (!on || !sid) return null;

  const run = async (job: () => Promise<unknown>) => {
    if (busy || list.length === 0) return;
    setBusy(true);
    try {
      await job();
      endMulti();
    } catch {
      quiet();
    } finally {
      setBusy(false);
    }
  };

  const complete = () =>
    run(() =>
      completePicked(sid, list, {
        today,
        carriedIds: carried.ids,
        orderToday: () => orderAfter(itemsOn(items, today, 'event')),
      }),
    );
  const relabel = (id: string | null, name: string) => run(() => relabelPicked(sid, list, id, name));
  const move = () => {
    const last = itemsOn(items, moveDate, 'event').reduce<string | null>((m, d) => (d.order && (m === null || d.order > m) ? d.order : m), null);
    // 끝내지 않은 이월 일정을 지난 날로 옮기면 오늘 칸에 따라온다 (V4 movesForwardIntoPast)
    const bounce = moveDate < today && list.some(({ item }) => !item.done && !isPeriod(item) && effectiveAttrs(formOf(item), tree).forward);
    return run(() => movePicked(sid, list, moveDate, last, bounce));
  };
  const remove = () => run(() => deletePicked(sid, list));

  const btn = 'flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const none = count === 0 || busy;

  // 휴대폰은 아래 탭바 위로 올린다 (V4 bottom-20)
  return (
    <div data-multi-bar={count} className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50">
      {panel === 'label' && (
        <div ref={labelRef} data-multi-label-panel className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white text-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-200/90 w-64">
          <div className="text-xs font-bold text-slate-500 mb-2 px-1">라벨 한꺼번에 바꾸기</div>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            <button
              type="button"
              data-multi-label=""
              onClick={() => void relabel(null, '')}
              className="w-full text-left px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
            >
              라벨 떼기 (없음)
            </button>
            {tree.list.map((l) => {
              const c = labelColor(l.color);
              return (
                <button
                  key={l.id}
                  type="button"
                  data-multi-label={l.id}
                  onClick={() => void relabel(l.id, l.name)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border hover:opacity-85 shadow-2xs cursor-pointer"
                  style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {panel === 'move' && (
        <div ref={moveRef} data-multi-move-panel className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white text-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-200/90 w-72">
          <div className="text-xs font-bold text-slate-500 mb-2 px-1">고른 일정을 이 날짜로 모두 옮기기</div>
          <div className="flex items-center gap-1.5">
            <button type="button" data-multi-move-prev onClick={() => setMoveDate((d) => addDays(d, -1))} title="전날로" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-black cursor-pointer">
              ◀
            </button>
            <input
              type="date"
              data-multi-move-date
              value={moveDate}
              onChange={(e) => e.target.value && setMoveDate(e.target.value)}
              aria-label="옮길 날짜"
              className="flex-1 min-w-0 px-2 py-1 text-sm border border-slate-200 rounded-lg font-bold"
            />
            <button type="button" data-multi-move-next onClick={() => setMoveDate((d) => addDays(d, 1))} title="다음 날로" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-black cursor-pointer">
              ▶
            </button>
          </div>
          <p className="mt-2 text-2xs text-slate-400 leading-snug">기간·반복 묶음이어도 고른 것만 옮깁니다. 묶음째 옮기려면 일정을 눌러 칸의 날짜를 고치세요.</p>
          <button
            type="button"
            data-multi-move-go
            onClick={() => void move()}
            disabled={none}
            className="mt-2 w-full py-1.5 text-xs font-bold text-white bg-primary hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer"
          >
            {shortDateLabel(moveDate)}로 {count}건 옮기기
          </button>
        </div>
      )}

      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[340px] justify-between border border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div data-multi-count={count} className="bg-primary text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-xs">
            {count}
          </div>
          <span className="text-sm font-semibold tracking-tight">{count ? '선택됨' : '일정을 눌러 고르세요'}</span>
          {busy && <span className="text-xs text-primary animate-pulse">…</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" data-multi-complete onClick={() => void complete()} disabled={none} title="고른 일정 모두 완료" className={`${btn} text-slate-200 hover:text-emerald-400 hover:bg-slate-800`}>
            ☑<span className="hidden sm:inline">완료</span>
          </button>
          <button
            type="button"
            data-multi-label-open
            onClick={() => setPanel(panel === 'label' ? null : 'label')}
            disabled={none}
            title="고른 일정의 라벨 바꾸기"
            className={`${btn} ${panel === 'label' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-200 hover:text-amber-300 hover:bg-slate-800'}`}
          >
            🏷️<span className="hidden sm:inline">라벨</span>
          </button>
          <button
            type="button"
            data-multi-move-open
            onClick={() => setPanel(panel === 'move' ? null : 'move')}
            disabled={none}
            title="고른 일정을 다른 날짜로 옮기기"
            className={`${btn} ${panel === 'move' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-200 hover:text-sky-300 hover:bg-slate-800'}`}
          >
            📅<span className="hidden sm:inline">옮기기</span>
          </button>
          <button type="button" data-multi-delete onClick={() => void remove()} disabled={none} title="고른 일정 삭제" className={`${btn} text-slate-200 hover:text-rose-400 hover:bg-slate-800`}>
            🗑️<span className="hidden sm:inline">삭제</span>
          </button>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button type="button" data-multi-end onClick={endMulti} disabled={busy} title="여러 개 고르기 끝내기" className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer disabled:opacity-40">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

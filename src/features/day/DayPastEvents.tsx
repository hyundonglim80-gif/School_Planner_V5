// 하루 화면(오늘) 일정 칸 아래 '📥 지난 일정 N개 ▸' (V4 components/ForwardingModal.tsx '지난 일정 오늘로 가져오기' 창을 줄로 - MENU 2-1).
//
// - 이월 기간 안의 지난 날에 끝내지 않은 일정 가운데 **오늘로 따라오지 않는 것**(이월 일정은 이미 오늘 칸에 따라온다 - domain/forward staleOf).
// - 있을 때만 보이고 처음에는 접혀 있다. 펴서 골라 '오늘로 가져오기' = 고른 것의 date만 오늘로(한 묶음), 안내의 되돌리기·Ctrl+Z.
//   처음에는 아무것도 고르지 않는다 - 끝내지 않은 지난 일정에는 달력에만 적어 둔 일(행사·연수)도 많다.
// - 줄마다: 날짜 · 라벨(누르면 완료 - 라벨이 없으면 '완료') · 글(누르면 오른쪽 일정 칸) · 🗑️ (V4 그대로).
import { useState } from 'react';
import { shortDateLabel } from '../../domain/dateUtils';
import { labelColor } from '../../domain/labels';
import { itemLabels, useLabelTree } from '../../data/select';
import { bringEventsToToday, deleteEvent, setEventDone } from '../events/actions';
import type { ItemDoc } from '../events/eventOps';
import { setPastRowOpen, usePastRow } from '../events/forward';
import { openEventPanel } from '../events/open';

const quiet = () => {
  /* 실패 안내는 저장 도우미가 이미 했다 */
};

interface Props {
  sid: string;
  today: string;
  stale: readonly ItemDoc[];
  forwardDays: number;
  /** 오늘 목록의 맨 뒤 차례 (가져온 것은 그 뒤에) */
  lastOrder: string | null;
}

export default function DayPastEvents({ sid, today, stale, forwardDays, lastOrder }: Props) {
  const open = usePastRow((s) => s.open);
  const tree = useLabelTree('event', sid);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  if (stale.length === 0) return null;

  // 다른 기기에서 끝냈거나 옮긴 것은 고른 것에서 저절로 빠진다
  const chosen = stale.filter((d) => picked.has(d.id));
  const allPicked = chosen.length === stale.length;
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bring = async () => {
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    try {
      await bringEventsToToday(sid, chosen, today, lastOrder);
      setPicked(new Set());
    } catch {
      // 안내는 저장 도우미가 했다 - 고른 것은 그대로 둔다
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-past-events={stale.length} className="mt-3 border-t border-slate-100 pt-2">
      <button
        type="button"
        data-past-toggle
        aria-expanded={open}
        onClick={() => setPastRowOpen(!open)}
        title="끝내지 않은 지난 일정 (이월 일정은 위에 따라옵니다)"
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <span aria-hidden>📥</span>
        <span>지난 일정 {stale.length}개</span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div data-past-list className="mt-1 space-y-1.5">
          <p className="px-2 text-2xs text-slate-400 leading-relaxed">
            지난 {forwardDays}일 동안 끝내지 않은 일정입니다(이월 일정은 위에 따라옵니다). 골라서 오늘로 가져옵니다. 라벨을 누르면 완료, 🗑️는 휴지통으로.
          </p>
          {stale.map((ev) => {
            const labels = itemLabels(tree, ev.labelIds);
            return (
              <div
                key={ev.id}
                data-past-item={ev.id}
                className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${
                  picked.has(ev.id) ? 'bg-primary/5 border-primary/40' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  data-past-pick={ev.id}
                  checked={picked.has(ev.id)}
                  onChange={() => toggle(ev.id)}
                  aria-label="오늘로 가져올 일정 고르기"
                  className="w-4 h-4 shrink-0 rounded accent-primary cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    data-past-open={ev.id}
                    onClick={() => openEventPanel({ sid, date: ev.date ?? today, id: ev.id })}
                    title="오른쪽 칸에서 보기·고치기"
                    className="block w-full text-left text-sm font-bold text-slate-800 truncate cursor-pointer hover:text-primary"
                  >
                    {ev.text}
                  </button>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{shortDateLabel(ev.date ?? today)}</span>
                    {(labels.length > 0 ? labels : [null]).map((l) => {
                      const c = l ? labelColor(l.color) : null;
                      return (
                        <button
                          key={l?.id ?? 'done'}
                          type="button"
                          data-past-complete={ev.id}
                          title="누르면 완료"
                          onClick={() => void setEventDone(sid, ev, true).catch(quiet)}
                          className="text-xs px-1.5 py-0.5 rounded-md font-bold border cursor-pointer hover:opacity-80"
                          style={c ? { backgroundColor: c.bg, color: c.text, borderColor: c.border } : undefined}
                        >
                          {l ? l.name : '완료'}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  data-past-delete={ev.id}
                  onClick={() => void deleteEvent(sid, ev).catch(quiet)}
                  title="삭제 (휴지통으로)"
                  aria-label="삭제"
                  className="text-slate-300 hover:text-red-500 text-xs font-bold p-1 shrink-0 cursor-pointer"
                >
                  🗑️
                </button>
              </div>
            );
          })}
          <div className="flex items-center gap-2 px-1 pt-1">
            <button
              type="button"
              data-past-all
              onClick={() => setPicked(allPicked ? new Set() : new Set(stale.map((d) => d.id)))}
              className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {allPicked ? '모두 풀기' : '모두 고르기'}
            </button>
            <button
              type="button"
              data-past-bring
              onClick={() => void bring()}
              disabled={chosen.length === 0 || busy}
              className="ml-auto px-3.5 py-1.5 text-xs font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              오늘로 가져오기 ({chosen.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// '📅 구글 캘린더로 보내기' 창 (V4 CalendarSyncModal, P8-1 ■2). 단축키 '구글 캘린더로 보내기'(id calendar) - P8-3에서 '백업 · 가져오기 · 보내기' 창의 '보내기' 탭으로.
// 기간(처음 = 지금 화면 기간) · 보낼 대상(일정·수업·기록) · 방식(병합/교체). 보내기는 창 밖에서 돈다(manual.ts) - 닫아도 끝까지, 다시 열면 어디까지 왔나.
import { useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { useNav } from '../../app/nav';
import { showErrorToast, showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import type { ManualDay, SyncKind, SyncMode } from '../../domain/gcal';
import { todayStr } from '../../domain/dateUtils';
import { carriedOf } from '../../domain/forward';
import { lessonsOn } from '../../domain/lessons';
import { periodDoneOn, periodPosition } from '../../domain/period';
import { getValidGoogleToken } from '../../data/google/token';
import { isHoliday } from '../../data/holidays';
import { itemLabels, itemsOfKind, itemsOn, labelTreeOf, useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { labelForwardOf } from '../events/forward';
import { useLessonSource } from '../lessons/useLessons';
import { KIND_NAME, rangeForScope, startCalendarSync, useCalendarSync } from './manual';

const KIND_DESC: Record<SyncKind, string> = { event: 'SP(work) 캘린더', class: 'SP(class) 캘린더', journal: 'SP(commentary) 캘린더' };
const KINDS: SyncKind[] = ['event', 'class', 'journal'];

export default function CalendarSyncWindow({ close, raise }: WindowProps) {
  const sid = useCurrentSpaceId();
  const scope = useNav((s) => s.scope);
  const date = useNav((s) => s.date);
  const items = useDocs('items', sid);
  const labels = useDocs('labels', sid);
  const lessonSrc = useLessonSource(sid);
  const periods = useCommonSettings((s) => s.periods);
  const forwardDays = useCommonSettings((s) => s.forwardDays);
  const progress = useCalendarSync();
  const [range, setRange] = useState(() => rangeForScope(scope, date));
  const [include, setInclude] = useState<Record<SyncKind, boolean>>({ event: true, class: true, journal: false });
  const [mode, setMode] = useState<SyncMode>('merge');

  /** 그날 보낼 것 (누른 때의 화면 store로) */
  const dayOf = (d: string): ManualDay => {
    const evTree = labelTreeOf(labels, 'event');
    const noteTree = labelTreeOf(labels, 'note');
    // 오늘 칸에는 이월 중인 일정도 (V4는 오늘로 옮겨 썼다 - '교체'가 자동으로 보낸 이월 일정을 지우지 않게)
    const today = todayStr();
    const dayEvents = itemsOn(items, d, 'event');
    const carried = d === today ? carriedOf(itemsOfKind(items, 'event'), labelForwardOf(evTree), today, forwardDays).filter((c) => !dayEvents.includes(c)) : [];
    return {
      date: d,
      events: [...dayEvents, ...carried].map((it) => ({
        item: it,
        position: periodPosition(it as Parameters<typeof periodPosition>[0], d, isHoliday),
        done: periodDoneOn(it as Parameters<typeof periodDoneOn>[0], d),
        labelNames: itemLabels(evTree, it.labelIds).map((l) => l.name),
      })),
      lessons: lessonsOn(d, lessonSrc)
        .cells.filter((c) => c.subject)
        .map((c) => ({ n: c.n, subject: c.subject, periodName: periods.find((p) => p.n === c.n)?.name ?? '' })),
      journals: itemsOn(items, d, 'note').map((it) => ({ item: it, done: !!it.done, labelNames: itemLabels(noteTree, it.labelIds).map((l) => l.name) })),
    };
  };

  const send = async () => {
    if (!range.start || !range.end) return showToast('기간을 정해 주세요.');
    if (range.start > range.end) return showToast('시작일이 종료일보다 늦습니다.');
    if (!KINDS.some((k) => include[k])) return showToast('보낼 대상을 하나 이상 골라 주세요.');
    let token: string;
    try {
      token = await getValidGoogleToken('구글 캘린더로 보내려면 구글 로그인이 필요합니다.');
    } catch (e) {
      return showErrorToast(e instanceof Error ? e.message : '구글 로그인을 하지 않아 보내지 못했습니다.', e);
    }
    // 창을 닫아도 끝까지 돈다 - 기다리지 않는다
    showToast('구글 캘린더로 보내는 중입니다. 창을 닫아도 계속되며, 끝나면 알려드립니다.');
    void startCalendarSync({ token, start: range.start, end: range.end, mode, include, dayOf });
  };

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="lg"
      title="📅 구글 캘린더로 보내기"
      footer={
        <>
          <ModalCloseButton onClose={close} />
          <button
            type="button"
            data-cal-send
            onClick={() => void send()}
            disabled={progress.running}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            {progress.running ? '보내는 중...' : '구글 캘린더로 보내기'}
          </button>
        </>
      }
    >
      <div data-calendar-sync-window className="space-y-4 text-xs">
        {/* 저절로 보내기가 있다는 것을 여기서 알린다 (V4 UX-AUDIT C6) */}
        <p data-gcal-auto-hint className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 leading-relaxed">
          💡 자주 보내는 일정은 ⋮ → 라벨 관리 → 일정 라벨에서 <b>구글 캘린더</b>를 켜 두면 저장·완료·지우기 때 <b>저절로</b> 보냅니다(일정 칸에서 하나씩 켜도 됩니다). 여기서는 기간을
          한꺼번에 맞춥니다.
        </p>
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-slate-600 leading-relaxed">
          고른 기간의 내용을 구글 캘린더로 보냅니다. 종류마다 전용 캘린더(SP(work) / SP(class) / SP(commentary))가 따로 만들어집니다.
          <br />
          <strong className="text-slate-800">보내기만 합니다.</strong> 구글에서 고친 내용은 이곳으로 돌아오지 않습니다.
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-800 mb-2">기간</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="시작일"
              data-cal-start
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-primary"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              aria-label="종료일"
              data-cal-end
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              data-cal-scope-range
              onClick={() => setRange(rangeForScope(scope, date))}
              className="px-3 py-2 bg-white border border-slate-200 hover:border-primary hover:text-primary text-slate-600 rounded-lg font-bold transition-colors"
            >
              지금 화면 기간으로
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-800 mb-2">보낼 대상</h3>
          <div className="space-y-1.5">
            {KINDS.map((k) => (
              <label key={k} className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  data-cal-include={k}
                  checked={include[k]}
                  onChange={(e) => setInclude((prev) => ({ ...prev, [k]: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 accent-primary cursor-pointer"
                />
                <span className="font-bold text-slate-700">{KIND_NAME[k]}</span>
                <span className="text-slate-400 ml-auto">{KIND_DESC[k]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-800 mb-2">방식</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                ['merge', '병합', '없는 것은 넣고 달라진 것은 고칩니다. 구글에만 있는 것은 그대로 둡니다.'],
                ['overwrite', '교체', '이곳과 똑같이 맞춥니다. 이 앱이 올렸던 것 중 지금 없는 것은 구글에서도 지웁니다. (구글에서 직접 만든 일정은 지우지 않습니다.)'],
              ] as const
            ).map(([m, name, desc]) => (
              <button
                key={m}
                type="button"
                data-cal-mode={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`text-left p-3 rounded-xl border transition-all ${mode === m ? 'bg-primary/5 border-primary' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                <div className={`font-bold ${mode === m ? 'text-primary' : 'text-slate-700'}`}>{name}</div>
                <p className="text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {progress.running && (
          <div data-cal-progress={progress.percent} className="space-y-1">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="text-slate-500">{progress.message}</p>
          </div>
        )}
        {!progress.running && progress.lastResult && (
          <p data-cal-result className="text-emerald-700 font-bold">
            ✅ 지난번 보내기: {progress.lastResult}
          </p>
        )}
      </div>
    </ModalShell>
  );
}

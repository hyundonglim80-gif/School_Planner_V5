// 일정 칸의 '🔁 반복' 줄 (V4 components/RecurringModal.tsx를 칸 안으로 - MENU 2-1 '반복은 일정의 성질'). 새 일정에서만 정한다.
// 안 함 · 매일 · 매주 · 격주 · 매월 n째 주 · 매월 n일 + 끝나는 날. 만들어질 날 수와 첫·끝 날을 곧바로 보인다(V4 '미리보기').
import { DAY_NAMES, shortDateLabel } from '../../domain/dateUtils';
import { MAX_SERIES_ITEMS, recurFormDates, type RecurForm, type RecurKind } from '../../domain/recur';

const KINDS: ReadonlyArray<{ kind: RecurKind; label: string }> = [
  { kind: 'none', label: '안 함' },
  { kind: 'daily', label: '매일' },
  { kind: 'weekly', label: '매주' },
  { kind: 'biweekly', label: '격주' },
  { kind: 'monthWeek', label: '매월 n째 주' },
  { kind: 'monthDay', label: '매월 n일' },
];
const WEEKS = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

const chip = (on: boolean) =>
  `px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
    on ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'
  }`;

export default function RecurRow({ start, recur, onChange }: { start: string; recur: RecurForm; onChange: (next: RecurForm) => void }) {
  const set = (patch: Partial<RecurForm>) => onChange({ ...recur, ...patch });
  const toggle = <K extends 'weekdays' | 'monthDays'>(key: K, v: number) =>
    set({ [key]: recur[key].includes(v) ? recur[key].filter((x) => x !== v) : [...recur[key], v] } as Partial<RecurForm>);
  const dates = recurFormDates(start, recur);
  const on = recur.kind !== 'none';
  const tooMany = dates.length > MAX_SERIES_ITEMS;

  return (
    <div data-event-recur-row className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-bold text-slate-600 mr-1">🔁 반복</span>
        {KINDS.map((k) => (
          <button key={k.kind} type="button" data-recur-kind={k.kind} aria-pressed={recur.kind === k.kind} onClick={() => set({ kind: k.kind })} className={chip(recur.kind === k.kind)}>
            {k.label}
          </button>
        ))}
      </div>

      {(recur.kind === 'weekly' || recur.kind === 'biweekly' || recur.kind === 'monthWeek') && (
        <div className="flex items-center gap-1 flex-wrap">
          {recur.kind === 'monthWeek' && (
            <select
              data-recur-week
              value={recur.monthWeek}
              onChange={(e) => set({ monthWeek: Number(e.target.value) })}
              aria-label="몇째 주"
              className="mr-1 px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white"
            >
              {WEEKS.map((w, i) => (
                <option key={w} value={i + 1}>
                  {w} 주
                </option>
              ))}
            </select>
          )}
          {DAY_NAMES.map((name, w) => (
            <button key={name} type="button" data-recur-day={w} aria-pressed={recur.weekdays.includes(w)} onClick={() => toggle('weekdays', w)} className={chip(recur.weekdays.includes(w))}>
              {name}
            </button>
          ))}
        </div>
      )}

      {recur.kind === 'monthDay' && (
        <div className="grid grid-cols-7 gap-1 max-w-[280px]">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" data-recur-mday={d} aria-pressed={recur.monthDays.includes(d)} onClick={() => toggle('monthDays', d)} className={chip(recur.monthDays.includes(d))}>
              {d}
            </button>
          ))}
        </div>
      )}

      {on && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1">끝나는 날</span>
          <input
            type="date"
            data-recur-until
            value={recur.until}
            min={start}
            onChange={(e) => set({ until: e.target.value })}
            aria-label="반복 끝나는 날"
            className="px-2 py-1 text-sm border border-slate-200 rounded-lg font-bold text-slate-700 bg-white"
          />
        </div>
      )}

      {on && (
        <p data-recur-count={dates.length} className={`text-2xs ${tooMany ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
          {!recur.until
            ? '끝나는 날을 고르면 만들어질 날짜를 셉니다.'
            : tooMany
              ? `한 번에 ${MAX_SERIES_ITEMS}개까지 만들 수 있습니다. 끝나는 날을 앞당겨 주세요.`
              : dates.length === 0
                ? '반복 조건에 맞는 날이 없습니다.'
                : `${dates.length}개 · ${shortDateLabel(dates[0])} ~ ${shortDateLabel(dates[dates.length - 1])} (저장하면 날마다 하나씩 - 묶여 있어 지울 때 '이 날부터'를 고를 수 있습니다)`}
        </p>
      )}
    </div>
  );
}

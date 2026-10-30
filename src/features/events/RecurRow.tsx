// 일정 칸 '📆 끝 날' 줄 안의 반복 고르기 (P10-1 사용자 의견 6b - V4 components/RecurringModal.tsx를 끝 날 줄 안으로). 새 일정에서만 정한다.
// 요일을 안 고르면 끝 날까지 기간 일정 하나, 고르면 시작 날 ~ 끝 날 사이 그 요일만 반복(날마다 항목 - series).
// 격주 · 매월 n째 주 · 매월 n일 · 매일은 '더 보기'에 접어 둔다(따로 체크할 필요가 없게). 끝나는 날 = 끝 날 칸 하나.
// 만들어질 날 수와 첫·끝 날을 곧바로 보인다(V4 '미리보기').
import { useState } from 'react';
import { DAY_NAMES, shortDateLabel } from '../../domain/dateUtils';
import { BY_WEEKDAY, MAX_SERIES_ITEMS, recurFormDates, toggleKind, toggleWeekday, type RecurForm, type RecurKind } from '../../domain/recur';

/** 월 ~ 일 (학교 달력처럼 월요일부터) */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MORE: ReadonlyArray<{ kind: RecurKind; label: string }> = [
  { kind: 'biweekly', label: '격주' },
  { kind: 'monthWeek', label: '매월 n째 주' },
  { kind: 'monthDay', label: '매월 n일' },
  { kind: 'daily', label: '매일' },
];
const WEEKS = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

const chip = (on: boolean) =>
  `px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
    on ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'
  }`;

export default function RecurRow({ start, end, recur, onChange }: { start: string; end: string; recur: RecurForm; onChange: (next: RecurForm) => void }) {
  const set = (patch: Partial<RecurForm>) => onChange({ ...recur, ...patch });
  const on = recur.kind !== 'none';
  const [moreOpen, setMoreOpen] = useState(false);
  const more = moreOpen || (on && recur.kind !== 'weekly');
  const dates = on ? recurFormDates(start, { ...recur, until: end }) : [];
  const tooMany = dates.length > MAX_SERIES_ITEMS;
  const toggleMonthDay = (d: number) => set({ monthDays: recur.monthDays.includes(d) ? recur.monthDays.filter((x) => x !== d) : [...recur.monthDays, d] });
  // 없는 달은 말없이 건너뛴다(V4 그대로) - 29~31일·다섯째 주는 미리 알린다 (P14-7)
  const lateDays = recur.kind === 'monthDay' ? [...recur.monthDays].filter((d) => d >= 29).sort((a, b) => a - b) : [];
  const skipNote = lateDays.length ? `${lateDays.join('·')}일이 없는 달은 건너뜁니다.` : recur.kind === 'monthWeek' && recur.monthWeek === 5 ? '다섯째 주가 없는 달은 건너뜁니다.' : '';

  return (
    <div data-event-recur-row={recur.kind} className="bg-purple-50/50 border border-purple-100 p-2.5 rounded-xl space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs font-bold text-slate-600 mr-1" title="고르면 시작 날부터 끝 날까지 그 요일에만 일정을 만듭니다">
          🔁 요일만
        </span>
        {BY_WEEKDAY.has(recur.kind) &&
          WEEK_ORDER.map((w) => {
            const picked = on && recur.weekdays.includes(w);
            return (
              <button key={w} type="button" data-recur-day={w} aria-pressed={picked} onClick={() => onChange(toggleWeekday(recur, w))} className={chip(picked)}>
                {DAY_NAMES[w]}
              </button>
            );
          })}
        {recur.kind === 'daily' && <span className="text-xs font-bold text-purple-700">매일</span>}
        {recur.kind === 'monthDay' && <span className="text-xs font-bold text-purple-700">매월 {[...recur.monthDays].sort((a, b) => a - b).join('·') || '?'}일</span>}
        <button
          type="button"
          data-recur-more
          aria-expanded={more}
          onClick={() => setMoreOpen((v) => !v)}
          disabled={on && recur.kind !== 'weekly'}
          title="격주 · 매월 · 매일"
          className="ml-1 px-1.5 py-1 text-2xs font-bold text-purple-600 hover:text-purple-800 disabled:text-purple-300 cursor-pointer disabled:cursor-default"
        >
          {more ? '▾' : '▸'} 더 보기
        </button>
      </div>

      {more && (
        <div className="flex items-center gap-1 flex-wrap">
          {MORE.map((k) => (
            <button key={k.kind} type="button" data-recur-kind={k.kind} aria-pressed={recur.kind === k.kind} onClick={() => onChange(toggleKind(recur, k.kind, start))} className={chip(recur.kind === k.kind)}>
              {k.label}
            </button>
          ))}
          {recur.kind === 'monthWeek' && (
            <select
              data-recur-week
              value={recur.monthWeek}
              onChange={(e) => set({ monthWeek: Number(e.target.value) })}
              aria-label="몇째 주"
              className="ml-1 px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white"
            >
              {WEEKS.map((w, i) => (
                <option key={w} value={i + 1}>
                  {w} 주
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {recur.kind === 'monthDay' && (
        <div className="grid grid-cols-7 gap-1 max-w-[280px]">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" data-recur-mday={d} aria-pressed={recur.monthDays.includes(d)} onClick={() => toggleMonthDay(d)} className={chip(recur.monthDays.includes(d))}>
              {d}
            </button>
          ))}
        </div>
      )}

      {on && (
        <p data-recur-count={dates.length} className={`text-2xs ${tooMany ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
          {!end
            ? '끝 날을 고르면 만들어질 날짜를 셉니다.'
            : tooMany
              ? `한 번에 ${MAX_SERIES_ITEMS}개까지 만들 수 있습니다. 끝 날을 앞당겨 주세요.`
              : dates.length === 0
                ? '반복 조건에 맞는 날이 없습니다.'
                : `🔁 ${dates.length}개 · ${shortDateLabel(dates[0])} ~ ${shortDateLabel(dates[dates.length - 1])} (저장하면 날마다 하나씩 - 묶여 있어 지울 때 '이 날부터'를 고를 수 있습니다)`}
          {skipNote && (
            <span data-recur-skip-note className="block text-amber-700 font-semibold">
              {skipNote}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

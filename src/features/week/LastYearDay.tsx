// 작년 이맘때 (V4 features/week/LastYearDay.tsx) - 주간 요일 카드 아래에 작년 같은 요일의 일정·기록을 흐리게.
// 항목을 누르면 고르고(체크), 주간 화면 위 '📥 올해로 가져오기'가 올해 이 요일로 복사한다. 이 칸을 눌러도 하루 화면으로 가지 않는다.
// 자료는 기기 사본에서 - 작년 것도 사본에 있다(V4는 켤 때 서버에서 읽었다).
import { labelColor } from '../../domain/labels';
import type { LabelDoc } from '../../data/select';
import type { ItemDoc } from '../events/eventOps';
import { isImportableNote, pickKeyOf, type LastYearPick } from './lastYear';

interface Props {
  /** 작년 같은 요일 */
  lastDate: string;
  /** 올해 이 요일 (가져갈 날) */
  toDate: string;
  events: readonly ItemDoc[];
  notes: readonly ItemDoc[];
  /** 올해 그날 이미 있는가 (같은 글) - '올해 있음'으로 두고 고르지 않는다 */
  existsThisYear: (item: ItemDoc) => boolean;
  eventLabels: (item: ItemDoc) => LabelDoc[];
  noteLabels: (item: ItemDoc) => LabelDoc[];
  picked: ReadonlySet<string>;
  onTogglePick: (pick: LastYearPick) => void;
}

/** 항목 한 줄의 모양. 고른 것은 진하게, 나머지는 흐리게(마우스를 올리면 진하게) */
const rowClass = (picked: boolean, tone: 'event' | 'note') =>
  `flex items-start gap-1.5 px-1.5 py-1 rounded-md border text-xs leading-snug text-slate-600 break-words transition-opacity ${
    picked
      ? 'opacity-100 border-amber-300 bg-amber-50 ring-1 ring-amber-200'
      : `opacity-60 hover:opacity-100 border-dashed ${tone === 'event' ? 'border-slate-200 bg-white/60' : 'border-emerald-200 bg-emerald-50/40'}`
  }`;

export default function LastYearDay({ lastDate, toDate, events, notes, existsThisYear, eventLabels, noteLabels, picked, onTogglePick }: Props) {
  const [y, m, d] = lastDate.split('-').map(Number);
  const empty = events.length === 0 && notes.length === 0;
  return (
    <div data-last-year={lastDate} onClick={(e) => e.stopPropagation()} className="mt-3 pt-2 border-t-2 border-dashed border-slate-200 cursor-default">
      <div className="text-2xs font-extrabold text-slate-400 mb-1.5" title={`${y}년 ${m}월 ${d}일 (작년 같은 주 같은 요일)`}>
        🕰️ 작년 {m}.{d}
      </div>
      {empty ? (
        <div className="text-2xs text-slate-300 pl-1">없음</div>
      ) : (
        <div className="space-y-1">
          {events.map((ev) => {
            const label = eventLabels(ev)[0];
            const c = label ? labelColor(label.color) : null;
            const key = pickKeyOf({ item: ev, toDate });
            const body = (
              <span className="min-w-0">
                {label && c && (
                  <span
                    className="inline-block align-middle mr-1 text-2xs font-bold px-1 py-px rounded whitespace-nowrap"
                    style={{ backgroundColor: c.bg, color: c.text, border: '1px solid ' + c.border }}
                  >
                    {label.name}
                  </span>
                )}
                <span className={`align-middle ${ev.done ? 'line-through text-slate-400' : ''}`}>{ev.text}</span>
              </span>
            );
            if (existsThisYear(ev)) {
              return (
                <div key={key} data-last-year-item="event" data-already title={`${ev.text} - 올해 이 날에 같은 일정이 있습니다`} className={rowClass(false, 'event')}>
                  {body}
                  <span className="ml-auto shrink-0 text-2xs font-bold text-slate-400 whitespace-nowrap">올해 있음</span>
                </div>
              );
            }
            return (
              <label key={key} data-last-year-item="event" data-last-year-id={ev.id} title={`${ev.text} - 골라서 올해로 가져오기`} className={`${rowClass(picked.has(key), 'event')} cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={picked.has(key)}
                  onChange={() => onTogglePick({ item: ev, toDate })}
                  aria-label={`작년 일정 고르기: ${ev.text}`}
                  className="mt-0.5 shrink-0 accent-amber-500"
                />
                {body}
              </label>
            );
          })}
          {notes.map((n) => {
            const label = noteLabels(n)[0];
            const text = (n.text ?? '').trim();
            const shown = text || ((n.tables?.length ?? 0) > 0 ? '(표)' : '(첨부)');
            const key = pickKeyOf({ item: n, toDate });
            const importable = isImportableNote(n);
            const already = importable && existsThisYear(n);
            const body = (
              <span className="min-w-0 whitespace-pre-line line-clamp-3">
                <span className="mr-1">📝</span>
                {label && <span className="mr-1 text-2xs font-bold text-emerald-700">[{label.name}]</span>}
                <span>{shown}</span>
              </span>
            );
            if (!importable || already) {
              return (
                <div
                  key={key}
                  data-last-year-item="note"
                  data-already={already || undefined}
                  title={already ? `${shown} - 올해 이 날에 같은 기록이 있습니다` : `${shown} - 첨부만 있는 기록은 가져오지 않습니다`}
                  className={rowClass(false, 'note')}
                >
                  {body}
                  {already && <span className="ml-auto shrink-0 text-2xs font-bold text-slate-400 whitespace-nowrap">올해 있음</span>}
                </div>
              );
            }
            return (
              <label key={key} data-last-year-item="note" data-last-year-id={n.id} title={`${shown} - 골라서 올해로 가져오기`} className={`${rowClass(picked.has(key), 'note')} cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={picked.has(key)}
                  onChange={() => onTogglePick({ item: n, toDate })}
                  aria-label={`작년 기록 고르기: ${shown.split('\n')[0]}`}
                  className="mt-0.5 shrink-0 accent-amber-500"
                />
                {body}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

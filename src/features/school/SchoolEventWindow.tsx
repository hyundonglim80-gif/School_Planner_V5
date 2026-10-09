// 📚 그날 학사일정 (V4 components/SchoolEventModal.tsx). 창 'schoolEvent' = { date, items } - 날짜 칸의 학사일정 이름·하루 '📚 학사' 줄에서.
// 학사일정은 표시만 하므로(일정 문서에 쓰지 않는다) 필요한 것만 하나씩 담는다.
// - 'D-Day로': D-Day 목록에 곧바로 더한다. 이미 같은 이름·날짜가 있으면 'D-Day에 있음'.
// - '일정으로 담기': 새 일정 칸을 이름을 적어 둔 채 연다 - 라벨·알림을 골라 저장한다.
import { useCommonSettings } from '../../app/prefs';
import type { WindowProps } from '../../app/windows';
import { shortDateLabel, todayStr } from '../../domain/dateUtils';
import { ddayText, liveDDays } from '../../domain/dday';
import { useCurrentSpaceId } from '../../data/session';
import type { NeisScheduleItem } from '../../data/neis';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { addDDayItem } from '../dday/actions';
import { openEventPanel } from '../events/open';
import type { SchoolEventParams } from './open';

export default function SchoolEventWindow({ params, close, raise }: WindowProps<SchoolEventParams>) {
  const { date, items } = params;
  const sid = useCurrentSpaceId();
  const ddays = useCommonSettings((s) => s.ddays);
  const dday = ddayText(date, todayStr());

  const inDDay = (it: NeisScheduleItem) => liveDDays(ddays).some((d) => d.date === it.date && d.title.trim() === it.name);

  const toEvent = (it: NeisScheduleItem) => {
    // 쓰는 칸이 오른쪽 줄에 서므로 이 창은 닫는다 (같은 날을 다시 누르면 또 열린다)
    close();
    if (sid) openEventPanel({ sid, date: it.date, draftText: it.name });
  };

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="sm"
      title={
        <span>
          📚 학사일정 <span className="text-sm font-bold text-slate-500">· {shortDateLabel(date)}</span>
        </span>
      }
      footer={<ModalCloseButton onClose={close} />}
    >
      <div className="space-y-2.5" data-school-event-window={date}>
        {items.map((it) => {
          const has = inDDay(it);
          return (
            <div key={`${it.date}|${it.name}`} data-school-event-item={it.name} className="p-3 rounded-xl border border-teal-100 bg-teal-50/50 space-y-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-teal-800 break-words">{it.name}</div>
                {(it.grades.length > 0 || it.content) && (
                  <div className="mt-0.5 text-xs text-slate-500 break-words">
                    {it.grades.length > 0 && <span>{it.grades.join('·')}학년</span>}
                    {it.grades.length > 0 && it.content && <span> · </span>}
                    {it.content}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  data-school-event-dday
                  onClick={() => addDDayItem(it.name, it.date)}
                  disabled={has}
                  title={has ? '이미 D-Day 목록에 있습니다' : `D-Day 목록에 더합니다 (${dday.text})`}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors bg-white border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-default disabled:hover:bg-white cursor-pointer"
                >
                  {has ? '✓ D-Day에 있음' : `⏳ D-Day로 (${dday.text})`}
                </button>
                <button
                  type="button"
                  data-school-event-to-event
                  onClick={() => toEvent(it)}
                  title="이 날짜의 새 일정 칸을 이름을 적어 둔 채 엽니다 - 라벨을 골라 저장하세요"
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  📅 일정으로 담기
                </button>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-400 leading-relaxed">
          학사일정은 나이스에서 받아 보여 주기만 합니다. 담은 D-Day·일정은 내 것이라 학교가 학사일정을 바꿔도 따라 바뀌지 않습니다.
        </p>
      </div>
    </ModalShell>
  );
}

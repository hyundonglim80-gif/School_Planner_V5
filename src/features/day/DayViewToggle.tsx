// 하루 수업·일정 칸 머리의 카드/목록 단추 (11-25 메모 요청 #204) - 메모 화면 머리줄 단추와 같은 꼴: 지금이 카드면 ☰(목록으로), 목록이면 ▦(카드로).
// data-* 이름은 칸마다 따로(data-event-view-toggle · data-lessons-view-toggle) - 단추 대신 누르기 단축키가 이름만으로 찾는다(값은 지금 보기라 바뀐다).
import { toggleDayView, useDayView, type DayViewPane } from './dayView';

const ATTR: Record<DayViewPane, string> = { events: 'data-event-view-toggle', lessons: 'data-lessons-view-toggle' };
const WHAT: Record<DayViewPane, string> = { events: '일정', lessons: '교시' };

export default function DayViewToggle({ pane }: { pane: DayViewPane }) {
  const view = useDayView((s) => s[pane]);
  const label = view === 'card' ? `목록으로 보기 (한 줄에 ${WHAT[pane]} 하나)` : '카드로 보기';
  return (
    <button
      type="button"
      {...{ [ATTR[pane]]: view }}
      // 종이에는 없다 (인쇄 - index.css [data-print-paper]의 [data-print-hide])
      data-print-hide
      onClick={(e) => {
        e.stopPropagation();
        toggleDayView(pane);
      }}
      title={label}
      aria-label={label}
      className="tap-area w-7 h-7 flex items-center justify-center rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
    >
      <span aria-hidden>{view === 'card' ? '☰' : '▦'}</span>
    </button>
  );
}

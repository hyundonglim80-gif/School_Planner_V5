// 묶인 일정 지우기 - 어디까지 (V4 GroupDeleteModal). 하루 카드의 🗑️·일정 칸의 '삭제'가 묶인 일정이면 이것을 띄운다.
//   기간 일정(한 문서): 이 날만 = 그날 빼기 · 이 날부터 = 끝 날 당기기 · 전부 = 지운 표시 (DESIGN 5-3)
//   반복 일정(문서 여럿): 이 날만 = 그 항목 · 이 날부터 = 그날부터의 항목(반복 끝나는 날도 당긴다) · 전부 = 항목 모두와 반복 문서 (DESIGN 4-4)
import { shortDateLabel } from '../../domain/dateUtils';
import { isPeriod, periodDays } from '../../domain/period';
import { ruleLabel } from '../../domain/recur';
import { deleteEvent, deletePeriodPart, deleteSeriesEvents } from './actions';
import type { ItemDoc } from './eventOps';
import EventScopeWindow from './EventScopeWindow';
import { useSeriesOf } from './series';

const FOOT = '지운 것은 안내의 되돌리기(또는 되돌리기 단축키)로 되살립니다.';

export default function EventDeleteChooser({ sid, item, day, onClose }: { sid: string; item: ItemDoc; day: string; onClose: () => void }) {
  const info = useSeriesOf(sid, item);
  if (info && !isPeriod(item)) {
    const after = info.list.filter((d) => (d.date ?? '') >= (item.date ?? '')).length;
    return (
      <EventScopeWindow
        title="🗑️ 연결된 일정 삭제"
        intro={`'${item.text}'은(는) 반복(${ruleLabel(info.series?.rule)})으로 ${info.list.length}개가 연결되어 있습니다. 어디까지 지울까요?`}
        choices={[
          { key: 'only', title: '이 날짜의 일정만 삭제', desc: `${shortDateLabel(item.date ?? day)}의 1개. 나머지는 그대로 둡니다.` },
          { key: 'after', title: `이 날짜와 이후 일정 모두 삭제 (${after}개)`, desc: `${shortDateLabel(item.date ?? day)}부터 뒤쪽을 지웁니다. 지난 것은 그대로 둡니다.` },
          { key: 'all', title: `연결된 일정 전체 삭제 (${info.list.length}개)`, desc: '지난 것까지 모두 지웁니다.' },
        ]}
        footnote={`${FOOT} 휴지통에서도 되살릴 수 있습니다.`}
        onPick={(scope) => deleteSeriesEvents(sid, item, scope, info.list, info.series)}
        onClose={onClose}
      />
    );
  }
  const days = periodDays(item);
  // 그날 보이지 않는 기간(주말 등에서 연 칸)이면 첫날로
  const d = days.includes(day) ? day : (days[0] ?? day);
  const after = days.filter((x) => x >= d).length;
  return (
    <EventScopeWindow
      title="🗑️ 연결된 일정 삭제"
      intro={`'${item.text}'은(는) 기간으로 여러 날에 걸쳐 있습니다 (${days.length}일). 어디까지 지울까요?`}
      choices={[
        { key: 'only', title: '이 날짜의 일정만 삭제', desc: `${shortDateLabel(d)} 하루. 나머지 날은 그대로 둡니다.` },
        { key: 'after', title: `이 날짜와 이후 일정 모두 삭제 (${after}일)`, desc: `${shortDateLabel(d)}부터 뒤쪽을 지웁니다. 지난 날짜는 그대로 둡니다.` },
        { key: 'all', title: `연결된 일정 전체 삭제 (${days.length}일)`, desc: '지난 날짜까지 모두 지웁니다.' },
      ]}
      footnote={`${FOOT} 전체 삭제는 휴지통에서도 되살릴 수 있습니다.`}
      onPick={(scope) => (scope === 'all' ? deleteEvent(sid, item) : deletePeriodPart(sid, item, d, scope))}
      onClose={onClose}
    />
  );
}

// 묶인 일정을 끌어 옮길 때 어디까지 (V4 components/GroupMoveModal.tsx). drag.ts의 pending을 화면이 그린다.
//   기간(한 문서): 이 날만 = 그날을 빼고 그 날에 하루 일정 · 기간 통째로 = 같은 날 수만큼(옮긴 뒤 날 수·쉬는 날에 놓이는 날을 미리)
//   반복(문서 여럿): 이 날만 · 이 날부터 · 전부 = 같은 날 수만큼(옮겨 갈 범위·주말에 놓이는 수를 미리)
import { daysBetween, shortDateLabel, todayStr } from '../../domain/dateUtils';
import { isPeriod, periodDays } from '../../domain/period';
import { ruleLabel } from '../../domain/recur';
import { itemsOn, useDocs, useLabelTree } from '../../data/select';
import { moveEventTo, type MoveContext } from './actions';
import { orderAfter, type ItemDoc } from './eventOps';
import EventScopeWindow from './EventScopeWindow';
import { movesForwardIntoPast, periodMovePreview, seriesMovePreview, shiftLabel, type MovePreview } from './moveOps';
import { scopeItems } from './seriesOps';
import { useSeriesOf } from './series';

const FOOT = '옮긴 것은 안내의 되돌리기(또는 되돌리기 단축키)로 원래 날짜에 돌아옵니다.';
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
const range = (p: MovePreview) => (p.from[0] === p.from[1] ? `${md(p.from[0])} → ${md(p.to[0])}` : `${md(p.from[0])}~${md(p.from[1])} → ${md(p.to[0])}~${md(p.to[1])}`);
const offWarn = (p: MovePreview) => (p.offDays > 0 ? `주말에 놓이는 날 ${p.offDays}건` : undefined);

export default function EventMoveChooser({ sid, item, day, to, onClose }: { sid: string; item: ItemDoc; day: string; to: string; onClose: () => void }) {
  const items = useDocs('items', sid);
  const tree = useLabelTree('event', sid);
  const info = useSeriesOf(sid, item);
  const ctx: MoveContext = {
    order: orderAfter(itemsOn(items, to, 'event')),
    bounce: movesForwardIntoPast(item, day, to, todayStr(), tree),
    series: info ? { list: info.list, series: info.series } : undefined,
  };
  const when = shiftLabel(day, to);
  const n = daysBetween(day, to);
  const run = (scope: 'only' | 'after' | 'all') => moveEventTo(sid, item, day, to, scope, ctx).then(() => undefined);

  if (info && !isPeriod(item)) {
    const after = seriesMovePreview(scopeItems(info.list, item, 'after'), n);
    const all = seriesMovePreview(info.list, n);
    return (
      <EventScopeWindow
        title="📅 연결된 일정 옮기기"
        mood="change"
        intro={`'${item.text}'은(는) 반복(${ruleLabel(info.series?.rule)})으로 ${info.list.length}개가 연결되어 있습니다. 어디까지 옮길까요? 고른 일정은 모두 ${when} 옮깁니다.`}
        choices={[
          { key: 'only', title: '이 날짜의 일정만 옮기기', desc: `${shortDateLabel(day)} → ${shortDateLabel(to)} 1건. 나머지는 그대로 둡니다(묶음에는 남습니다).` },
          { key: 'after', title: `이 날짜와 이후 일정 모두 옮기기 (${after.count}건)`, desc: range(after), warn: offWarn(after) },
          { key: 'all', title: `연결된 일정 전체 옮기기 (${all.count}건)`, desc: range(all), warn: offWarn(all) },
        ]}
        footnote={FOOT}
        onPick={run}
        onClose={onClose}
      />
    );
  }
  const days = periodDays(item);
  const all = periodMovePreview(item, n);
  return (
    <EventScopeWindow
      title="📅 기간 일정 옮기기"
      mood="change"
      intro={`'${item.text}'은(는) 기간으로 여러 날에 걸쳐 있습니다 (${days.length}일). 어디까지 옮길까요?`}
      choices={[
        { key: 'only', title: '이 날짜의 일정만 옮기기', desc: `${shortDateLabel(day)} → ${shortDateLabel(to)} 하루. 기간에서 그 날을 빼고 하루 일정으로 둡니다.` },
        {
          key: 'all',
          title: `기간 통째로 ${when} 옮기기 (${all.count}일)`,
          desc: range(all) + (all.daysAfter !== undefined && all.daysAfter !== all.count ? ` · 옮긴 뒤 ${all.daysAfter}일 (주말 빼기)` : ''),
          warn: offWarn(all),
        },
      ]}
      footnote={FOOT}
      onPick={run}
      onClose={onClose}
    />
  );
}

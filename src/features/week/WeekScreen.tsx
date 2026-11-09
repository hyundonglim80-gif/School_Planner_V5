// 주간 화면 (V4 features/week/WeekScreen.tsx·WeekGrid.tsx). 한 주를 요일 카드로 - 날짜·◀▶는 둘째 줄(SecondRow).
//   - 본문 폭이 1200px 이상이면 요일이 한 줄로 서고 아래에 다음 주도 한 줄. 읽는 범위는 늘 두 주 - 기기 사본에서 고르므로 폭이 바뀌어도 다시 읽지 않는다.
//   - 🕰️ 작년 이맘때: 이번 주 줄의 카드 아래에 작년 학년도 같은 주 같은 요일(domain/lastYearWeek), 골라서 📥 올해로 가져오기.
//   - 겹쳐 보기(P17-2): 요일 카드마다 주 공간 것(이월 포함) 뒤에 겹친 공간 그날 일정(그 공간 라벨 트리·색 점) - 누르면 그 공간 칸, 칩 = 그 공간에 완료. 끌기·✕·고르기는 주 공간 것만.
//   - 📰 주간학습안내(담임 - features/weeklyGuide)는 P6-3. 인쇄(⋮·Ctrl+P)는 인쇄 창(features/print)이 printAt으로 그 주만 그린다(단추 줄·다음 주·작년 없이). 수업 줄은 P6-1(features/lessons/WeekLessonRows - 요일끼리 교시 줄 수가 같다), 끌어 옮기기·공휴일은 P5-3.
//   - 요일 카드 줄(셈·고르기·끌기·지우기)은 useWeekCards(P24-2 - 한눈에 화면과 함께 쓴다). 여기에는 주간만의 것 - 다음 주 줄·작년 이맘때·주간학습안내.
//   - 토·일은 수업 줄 없이 한 칸에 위(토)·아래(일)로(11-09 사용자 요청 '한눈에처럼' - stackWeekend). 인쇄도 같다(여섯 열).
import { useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { openWindow } from '../../app/windows';
import { addDays, weekDates } from '../../domain/dateUtils';
import { lastYearWeekOf } from '../../domain/lastYearWeek';
import { itemLabels, itemsOn, useDocs, useLabelTree } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { useMainWidth } from '../../ui/useMainWidth';
import { useTeaching } from '../lessons/teaching';
import { importLastYear } from './actions';
import { existsThisYear, isImportableNote, pickKeyOf, type LastYearPick } from './lastYear';
import LastYearDay from './LastYearDay';
import { toggleLastYear, useShowLastYear } from './prefs';
import { useWeekCards } from './useWeekCards';
import { shortcutTarget } from '../../ui/shortcutTarget';

export default function WeekScreen({ printAt }: { printAt?: string }) {
  const sid = useCurrentSpaceId();
  const navDate = useNav((s) => s.date);
  const date = printAt ?? navDate;
  const showWeekend = useNav((s) => s.showWeekend);
  const showEvents = useNav((s) => s.showEvents);
  const showLastYear = useShowLastYear((s) => s.on) && !printAt;
  const items = useDocs('items', sid);
  const eventTree = useLabelTree('event', sid);
  const noteTree = useLabelTree('note', sid);
  const showNextWeek = useMainWidth() >= 1200 && !printAt;
  const { showHomeroomTools } = useTeaching();

  const thisWeek = useMemo(() => weekDates(date), [date]);
  const nextWeek = useMemo(() => weekDates(addDays(thisWeek[0], 7)), [thisWeek]);
  const visible = (days: string[]) => (showWeekend ? days : days.filter((d) => ![0, 6].includes(new Date(`${d}T00:00:00`).getDay())));
  const shownThis = visible(thisWeek);
  const shownNext = visible(nextWeek);
  // 요일 카드 줄 - 두 주를 함께 셈한다 (수업 줄·겹친 공간 - 폭이 바뀌어 다음 주 줄이 생겨도 다시 셈하지 않는다)
  const allDays = useMemo(() => [...thisWeek, ...nextWeek], [thisWeek, nextWeek]);
  const cards = useWeekCards(sid, date, allDays);

  // 작년 이맘때 (이번 주 줄에만)
  const lastYear = useMemo(() => lastYearWeekOf(thisWeek), [thisWeek]);
  // 고른 작년 항목 - 주·공간이 바뀌거나 끄면 풀린다
  const pickScope = `${lastYear?.label}|${sid}|${showLastYear}`;
  const [pickState, setPickState] = useState<{ scope: string; picks: Record<string, LastYearPick> }>({ scope: '', picks: {} });
  const picks = pickState.scope === pickScope ? pickState.picks : {};
  const pickedKeys = new Set(Object.keys(picks));
  const setPicks = (next: Record<string, LastYearPick>) => setPickState({ scope: pickScope, picks: next });
  const [importing, setImporting] = useState(false);

  const lastYearOf = (day: string) => {
    const from = lastYear?.dateMap[day];
    if (!from) return null;
    return { from, events: showEvents ? itemsOn(items, from, 'event') : [], notes: itemsOn(items, from, 'note') };
  };

  const togglePickItem = (p: LastYearPick) => {
    const key = pickKeyOf(p);
    const next = { ...picks };
    if (next[key]) delete next[key];
    else next[key] = p;
    setPicks(next);
  };
  /** 보이는 요일의 작년 항목 중 고를 수 있는 것 모두 (올해 있는 것은 빼고) */
  const pickAll = () => {
    const next: Record<string, LastYearPick> = {};
    for (const day of shownThis) {
      const ly = lastYearOf(day);
      if (!ly) continue;
      for (const it of [...ly.events, ...ly.notes.filter(isImportableNote)]) {
        if (existsThisYear(items, it, day)) continue;
        const p = { item: it, toDate: day };
        next[pickKeyOf(p)] = p;
      }
    }
    setPicks(next);
  };
  const runImport = async () => {
    const list = Object.values(picks);
    if (!sid || list.length === 0 || importing) return;
    setImporting(true);
    try {
      await importLastYear(sid, items, list);
      setPicks({});
    } catch {
      // 안내는 저장 도우미가 했다 - 고른 것은 그대로 (다시 누를 수 있게, 같은 글은 건너뛴다)
    } finally {
      setImporting(false);
    }
  };

  /** 카드 아래 작년 이맘때 칸 (이번 주 줄에만, 켰을 때) */
  const lastYearCell = (day: string) => {
    const ly = showLastYear ? lastYearOf(day) : null;
    return (
      ly && (
        <LastYearDay
          lastDate={ly.from}
          toDate={day}
          events={ly.events}
          notes={ly.notes}
          existsThisYear={(it) => existsThisYear(items, it, day)}
          eventLabels={(it) => itemLabels(eventTree, it.labelIds)}
          noteLabels={(it) => itemLabels(noteTree, it.labelIds)}
          picked={pickedKeys}
          onTogglePick={togglePickItem}
        />
      )
    );
  };

  const pickedCount = pickedKeys.size;
  const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

  if (printAt) return <div data-screen="week">{cards.grid(shownThis, { stackWeekend: true })}</div>;

  return (
    <div data-screen="week" className="animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 mb-2 px-1" data-print-hide>
        {showLastYear && lastYear && (
          <span data-last-year-label className="text-xs text-slate-500 min-w-0">
            작년 같은 주 · <strong className="font-bold text-slate-700">{lastYear.label}</strong>
          </span>
        )}
        {showLastYear &&
          (pickedCount > 0 ? (
            <span data-last-year-picks={pickedCount} className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-700">{pickedCount}개 고름</span>
              <button
                type="button"
                data-last-year-import
                disabled={importing}
                onClick={() => void runImport()}
                title="고른 작년 일정·메모를 올해 같은 요일에 복사합니다 (작년 것은 그대로)"
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 shadow-xs whitespace-nowrap cursor-pointer"
              >
                {importing ? '가져오는 중…' : '📥 올해로 가져오기'}
              </button>
              <button type="button" data-last-year-unpick onClick={() => setPicks({})} className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 whitespace-nowrap cursor-pointer">
                풀기
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-last-year-pick-all
              onClick={pickAll}
              title="보이는 요일의 작년 일정·메모를 모두 고릅니다 (올해 이미 있는 것은 빼고)"
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
            >
              모두 고르기
            </button>
          ))}
        {showHomeroomTools && (
          <button
            type="button"
            data-week-guide
            {...shortcutTarget('weeklyGuide')}
            onClick={() => openWindow('weeklyGuide', { date: shownThis[0] ?? thisWeek[0] })}
            title="보고 있는 주의 주간학습안내(요일 × 교시 + 준비물)를 만듭니다"
            className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 whitespace-nowrap cursor-pointer"
          >
            📰 주간학습안내
          </button>
        )}
        <button
          type="button"
          data-last-year-toggle
          {...shortcutTarget('lastYear')}
          aria-pressed={showLastYear}
          onClick={toggleLastYear}
          title={showLastYear ? '작년 이맘때 숨기기' : '작년 학년도 같은 주의 일정·메모를 요일 카드 아래에 흐리게 보기'}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
            showLastYear ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          🕰️ 작년 이맘때
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* 날짜(둘째 줄)를 누르면 오늘로 - 오늘 카드가 없으면(주말을 감춘 토·일) 이번 주 (app/todayScroll) */}
        <div data-today-area={thisWeek.includes(cards.today) ? 'true' : undefined} data-week-this>
          {cards.grid(shownThis, { extra: lastYearCell, stackWeekend: true })}
        </div>
        {showNextWeek && (
          <section aria-label="다음 주" data-week-next>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs font-extrabold text-slate-500">다음 주</span>
              <span className="text-xs text-slate-400">
                {md(nextWeek[0])} ~ {md(nextWeek[6])}
              </span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>
            {cards.grid(shownNext, { stackWeekend: true })}
          </section>
        )}
      </div>
      {cards.dialogs}
    </div>
  );
}

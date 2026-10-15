// 하루 화면의 메모 칸 (V4 features/day/DayJournal.tsx '기록' 칸 - P10-3부터 '메모' 하나, 그 날짜 링크가 있는 메모).
//
// - 머리줄 `▼ 📝 메모 N [+ 추가] 📊 🏷️ ……… ⚙️` (일정 칸과 같은 배치 - V4 사용자 결정). ⚙️ = 메모 라벨 관리.
//   + 추가 = 그 날짜 링크 하나로 새 메모(P10-3 2g). 옛 '+ 메모'(날짜 없는 메모 - V4 UX-AUDIT C2)는 뺐다(사용자 의견 2i).
// - 카드: 메모 화면과 같은 카드(features/notes/EntryCard). 휴대폰 2열, 본문 폭에 따라 3·4열(가로 우선으로 나눠 담는다).
//   즐겨찾기한 메모는 그날 칸의 맨 위. 긴 메모는 접힌 채 시작(누른 것만 기억한다 - 메모가 새로 오거나 길어져도 낡지 않게).
// - 쓰기마다 문서 하나. 완료·즐겨찾기·순서·체크 줄은 안내 없이 Ctrl+Z 더미에, 지우기는 안내 + 되돌리기.
// - 라벨로 보기(V4 journal-view): '전체 · 라벨 칩'(메모 화면과 같은 LabelFilterChips - 여러 개·탐색기식·상위 → 하위·'기타'), 고른 것은 이 기기에 기억, ESC = 모두 떼기.
//   칩 줄은 **접힌 채** 시작하고 머리줄 🏷️로 편다(사용자 의견 2h - 편 상태도 이 기기에 기억). 접혀 있어도 고른 라벨은 그대로 걸러 🏷️에 그 수를 보인다.
import { useEffect, useState } from 'react';
import { addEscapeAction } from '../../app/keys';
import { openWindow } from '../../app/windows';
import { isLongEntry } from '../../domain/entryCollapse';
import { EMPTY_FILTER, isEmptyFilter, isOtherKey, labelPath, matchLabels, otherParentOf, pruneFilter } from '../../domain/labelTree';
import { itemLabels, useLabelTree, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import type { YMD } from '../../data/types';
import { useMainWidth } from '../../ui/useMainWidth';
import type { ItemDoc } from '../events/eventOps';
import { deleteNote, moveNoteInList, setNoteDone, setNoteFavorite, toggleNoteCheckLine } from '../notes/actions';
import EntryCard from '../notes/EntryCard';
import { openLinkViewer } from '../links/open';
import LabelFilterChips, { FILTER_HELP, FilterChip } from '../notes/LabelFilterChips';
import { setJournalFilter, setJournalFilterOpen, useLabelFilters } from '../notes/labelFilter';
import { canMoveNote, favoriteFirst, timeLabel } from '../notes/noteOps';
import { openNotePanel, useEditingNoteIds } from '../notes/open';
import { useFocusReveal } from '../search/focus';
import DayCardView from './DayCards';
import { useDayCardsOn } from './useDayCards';
import { useDayNotes } from './useDayNotes';
import { noteFromLabel } from '../notes/dayNotes';
import { useEvalsOn } from '../evaluations/evalData';
import { openEvaluation } from '../evaluations/open';

const quiet = () => {
  /* 실패 안내는 저장 도우미가 이미 했다 */
};

export default function DayJournal({ date }: { date: YMD }) {
  const sid = useCurrentSpaceId();
  const journalEvals = useEvalsOn(date, sid).filter((e) => e.period === null).length;
  // 그 날짜 링크 메모 + 그날 일정·수업에 이은 메모 (P10-4 - 겹치지 않게, 계산)
  const rows = useDayNotes(date, sid);
  const notes = rows.map((r) => r.item);
  const tree = useLabelTree('note');
  const status = useMirrorStatus('items');
  const editing = useEditingNoteIds(sid);
  const [collapsed, setCollapsed] = useState(false);
  // 검색 결과로 이 날 메모를 짚으러 오면 접힌 칸을 편다 (라벨로 보기는 검색 창이 옮기기 전에 푼다)
  useFocusReveal((t) => t.kind === 'note' && t.date === date, () => setCollapsed(false));
  // 카드 접기: 사용자가 누른 것만 담는다. 손대지 않은 카드는 길이를 보고 정한다
  const [cardCollapsed, setCardCollapsed] = useState<Record<string, boolean>>({});
  // 라벨로 보기 (지운 라벨은 빼고 - 라벨을 받기 전에는 그대로)
  const labelStatus = useMirrorStatus('labels');
  const remembered = useLabelFilters((s) => s.journal);
  const filterOpen = useLabelFilters((s) => s.journalOpen);
  const filter = labelStatus === 'idle' || labelStatus === 'loading' ? remembered : pruneFilter(remembered, tree.list.map((l) => l.id));
  useEffect(() => addEscapeAction(() => setJournalFilter(EMPTY_FILTER)), []);
  const countOf = (key: string) =>
    notes.filter((n) => matchLabels(n.labelIds, isOtherKey(key) ? { labels: [], others: [otherParentOf(key)] } : { labels: [key], others: [] }, tree.parents)).length;
  // 날짜 링크 메모(즐겨찾기 먼저 - ▲▼는 이것들끼리) → 이은 것으로만 오는 메모
  const pass = (n: ItemDoc) => matchLabels(n.labelIds, filter, tree.parents);
  const dated = favoriteFirst(rows.filter((r) => r.dated && pass(r.item)).map((r) => r.item));
  const shown = [...dated, ...rows.filter((r) => !r.dated && pass(r.item)).map((r) => r.item)];
  const fromOf = new Map(rows.map((r) => [r.item.id, r.from.map(noteFromLabel)]));
  // 그날 알림장·출결 (계산한 카드 - 라벨이 없어 라벨로 보기를 하면 숨긴다)
  const allCards = useDayCardsOn(date, sid);
  const cards = isEmptyFilter(filter) ? allCards : [];
  const waiting = notes.length === 0 && (status === 'idle' || status === 'loading');
  const picked = filter.labels.length + filter.others.length;

  // 칸 수는 창 폭이 아니라 본문 폭으로 - 오른쪽 칸이 열려 본문이 좁아지면 줄인다. 휴대폰도 2열(일정 칸과 같게)
  const mainWidth = useMainWidth();
  const columnsCount = mainWidth >= 980 ? 4 : mainWidth >= 720 ? 3 : 2;
  const columns = Array.from({ length: columnsCount }, () => [] as { item: ItemDoc; index: number }[]);
  shown.forEach((item, index) => columns[index % columnsCount].push({ item, index }));

  const pathOf = (id: string) => labelPath(id, tree.parents, (x) => tree.byId.get(x)?.name);
  const openCreate = () => sid && openNotePanel({ sid, date });
  const openEdit = (item: ItemDoc) => sid && openNotePanel({ sid, date, id: item.id });

  return (
    <section data-day-journal={date} className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        {/* 머리줄: ▼ 📝 메모 N [+ 추가] 📊 🏷️ ……… ⚙️ */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-journal-collapse
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-slate-700 text-xs px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
              title={collapsed ? '펼치기' : '접기'}
            >
              {collapsed ? '▶' : '▼'}
            </button>
            <span className="text-xl" aria-hidden>
              📝
            </span>
            <h3 className="text-base font-extrabold text-slate-800">메모</h3>
            <span data-journal-count={notes.length} className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {notes.length}
            </span>
            {!collapsed && (
              <button
                type="button"
                data-journal-add
                onClick={openCreate}
                aria-label="메모 추가"
                title="이 날의 메모 추가 (오른쪽 칸) - 쓰는 칸의 📅 날짜로 다른 날도 이을 수 있습니다"
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                + 추가
              </button>
            )}
            {/* 메모 칸에 붙은 조사표 (P7-4 - V4 그대로 제목 옆, 있으면 수) */}
            {!collapsed && sid && (
              <button
                type="button"
                data-journal-evals={journalEvals}
                onClick={() => openEvaluation({ sid, date, place: 'journal' })}
                title={journalEvals ? `메모 칸 조사표 ${journalEvals}건` : '메모 칸에 조사표 만들기'}
                aria-label={journalEvals ? `메모 칸 조사표 ${journalEvals}건` : '메모 칸에 조사표 만들기'}
                className={`px-2 py-1 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer ${
                  journalEvals ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-emerald-700 hover:bg-slate-100'
                }`}
              >
                📊{journalEvals || ''}
              </button>
            )}
            {/* 🏷️ 라벨로 보기 칩 줄 펴기·접기 (기본 접힘 - 고른 라벨이 있으면 그 수) */}
            {!collapsed && tree.list.length > 0 && (
              <button
                type="button"
                data-journal-filter-toggle={picked}
                aria-expanded={filterOpen}
                onClick={() => setJournalFilterOpen(!filterOpen)}
                title={filterOpen ? '라벨로 보기 접기' : picked ? `라벨로 보기 - ${picked}개 고름 (펴기)` : '라벨로 보기 펴기'}
                aria-label={filterOpen ? '라벨로 보기 접기' : '라벨로 보기 펴기'}
                className={`px-2 py-1 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer ${
                  picked ? 'bg-sky-50 hover:bg-sky-100 text-sky-700' : filterOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                🏷️{picked ? ` ${picked}` : ''} {filterOpen ? '▴' : '▾'}
              </button>
            )}
          </div>
          {!collapsed && filterOpen && tree.list.length > 0 && (
            <div data-journal-filter className="flex items-center gap-1 flex-wrap order-last w-full">
              <FilterChip
                chipKey="all"
                text="전체"
                title="이 날의 메모 모두 보기"
                count={notes.length}
                selected={isEmptyFilter(filter)}
                selectedClass="bg-slate-800 text-white border-slate-800"
                row
                onClick={() => setJournalFilter(EMPTY_FILTER)}
              />
              <LabelFilterChips tree={tree} filter={filter} onChange={setJournalFilter} countOf={countOf} row />
              <span data-filter-help title={FILTER_HELP} className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-2xs cursor-help">
                ?
              </span>
            </div>
          )}
          <button
            type="button"
            data-journal-labels-settings
            onClick={() => openWindow('labels', { tab: 'note' })}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="메모 라벨 설정"
            aria-label="메모 라벨 설정"
          >
            ⚙️
          </button>
        </div>
      </div>

      {!collapsed && cards.length > 0 && (
        <div className="grid gap-4 items-start" data-day-cards={cards.length} style={{ gridTemplateColumns: `repeat(${Math.min(columnsCount, Math.max(cards.length, 2))}, minmax(0, 1fr))` }}>
          {cards.map((c) => (
            <DayCardView key={c.key} card={c} sid={sid} />
          ))}
        </div>
      )}
      {!collapsed &&
        (shown.length > 0 ? (
          <div className="grid gap-4 items-start" style={{ gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` }}>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-4">
                {col.map(({ item, index }) => {
                  const isCollapsed = cardCollapsed[item.id] ?? isLongEntry(item.text);
                  return (
                    <EntryCard
                      key={item.id}
                      item={item}
                      labels={itemLabels(tree, item.labelIds)}
                      pathOf={pathOf}
                      dateText={timeLabel(item.createdAt)}
                      editing={editing.has(item.id)}
                      collapsed={isCollapsed}
                      onToggleCollapse={() => setCardCollapsed((prev) => ({ ...prev, [item.id]: !isCollapsed }))}
                      from={fromOf.get(item.id)}
                      onMoveUp={sid && canMoveNote(dated, index, -1) ? () => void moveNoteInList(sid, dated, index, -1).catch(quiet) : undefined}
                      onMoveDown={sid && canMoveNote(dated, index, 1) ? () => void moveNoteInList(sid, dated, index, 1).catch(quiet) : undefined}
                      onOpen={() => openEdit(item)}
                      onOpenLinks={() => sid && openLinkViewer({ sid, id: item.id })}
                      onToggleDone={() => sid && void setNoteDone(sid, item, !item.done).catch(quiet)}
                      onToggleFavorite={() => sid && void setNoteFavorite(sid, item, !item.favorite).catch(quiet)}
                      onDelete={() => sid && void deleteNote(sid, item).catch(quiet)}
                      onToggleCheckLine={(idx, line) => (sid ? toggleNoteCheckLine(sid, item, idx, line) : Promise.resolve(false))}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ) : notes.length > 0 ? (
          <div data-journal-filtered-empty className="w-full text-center py-8 bg-white/60 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            고른 라벨의 메모가 없습니다.
          </div>
        ) : waiting ? (
          <p data-journal-waiting className="py-10 text-center text-xs text-slate-400">
            메모를 받는 중…
          </p>
        ) : cards.length > 0 ? null : (
          <div data-journal-empty className="w-full text-center py-10 bg-white/60 rounded-2xl border border-dashed border-slate-300 p-6 shadow-xs">
            <p className="text-slate-500 font-bold text-sm">이 날의 메모가 없습니다.</p>
          </div>
        ))}
    </section>
  );
}

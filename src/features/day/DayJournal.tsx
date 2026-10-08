// 하루 화면의 기록 칸 (V4 features/day/DayJournal.tsx).
//
// - 머리줄 `▼ 📔 기록 N [+ 추가] [+ 메모] ……… ⚙️` (일정 칸과 같은 배치 - V4 사용자 결정). ⚙️ = 메모·기록 라벨 관리(한 목록).
//   '+ 메모'는 날짜 없는 메모를 하루 화면에서 바로(V4 UX-AUDIT C2) - 칸의 📅 날짜를 넣으면 그날 기록이 된다.
// - 카드: 메모와 같은 카드(features/notes/EntryCard). 휴대폰 2열, 본문 폭에 따라 3·4열(가로 우선으로 나눠 담는다).
//   즐겨찾기한 기록은 그날 기록의 맨 위. 긴 기록은 접힌 채 시작(누른 것만 기억한다 - 기록이 새로 오거나 길어져도 낡지 않게).
// - 쓰기마다 문서 하나. 완료·즐겨찾기·순서·체크 줄은 안내 없이 Ctrl+Z 더미에, 지우기는 안내 + 되돌리기.
// - 라벨로 보기(V4 journal-view): 머리줄 아래 '전체 · 라벨 칩'(메모 화면과 같은 LabelFilterChips - 여러 개·탐색기식·상위 → 하위·'기타'), 고른 것은 이 기기에 기억, ESC = 모두 떼기.
import { useEffect, useState } from 'react';
import { addEscapeAction } from '../../app/keys';
import { openWindow } from '../../app/windows';
import { isLongEntry } from '../../domain/entryCollapse';
import { EMPTY_FILTER, isEmptyFilter, isOtherKey, labelPath, matchLabels, otherParentOf, pruneFilter } from '../../domain/labelTree';
import { itemLabels, useItemsOn, useLabelTree, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import type { YMD } from '../../data/types';
import { useMainWidth } from '../../ui/useMainWidth';
import type { ItemDoc } from '../events/eventOps';
import { deleteNote, moveNoteInList, setNoteDone, setNoteFavorite, toggleNoteCheckLine } from '../notes/actions';
import EntryCard from '../notes/EntryCard';
import LabelFilterChips, { FILTER_HELP, FilterChip } from '../notes/LabelFilterChips';
import { setJournalFilter, useLabelFilters } from '../notes/labelFilter';
import { canMoveNote, favoriteFirst, timeLabel } from '../notes/noteOps';
import { openNotePanel, useEditingNoteIds } from '../notes/open';

const quiet = () => {
  /* 실패 안내는 저장 도우미가 이미 했다 */
};

export default function DayJournal({ date }: { date: YMD }) {
  const sid = useCurrentSpaceId();
  const notes = useItemsOn(date, 'note');
  const tree = useLabelTree('note');
  const status = useMirrorStatus('items');
  const editing = useEditingNoteIds(sid);
  const [collapsed, setCollapsed] = useState(false);
  // 카드 접기: 사용자가 누른 것만 담는다. 손대지 않은 카드는 길이를 보고 정한다
  const [cardCollapsed, setCardCollapsed] = useState<Record<string, boolean>>({});
  // 라벨로 보기 (지운 라벨은 빼고 - 라벨을 받기 전에는 그대로)
  const labelStatus = useMirrorStatus('labels');
  const remembered = useLabelFilters((s) => s.journal);
  const filter = labelStatus === 'idle' || labelStatus === 'loading' ? remembered : pruneFilter(remembered, tree.list.map((l) => l.id));
  useEffect(() => addEscapeAction(() => setJournalFilter(EMPTY_FILTER)), []);
  const countOf = (key: string) =>
    notes.filter((n) => matchLabels(n.labelIds, isOtherKey(key) ? { labels: [], others: [otherParentOf(key)] } : { labels: [key], others: [] }, tree.parents)).length;
  const shown = favoriteFirst(notes.filter((n) => matchLabels(n.labelIds, filter, tree.parents)));
  const waiting = notes.length === 0 && (status === 'idle' || status === 'loading');

  // 칸 수는 창 폭이 아니라 본문 폭으로 - 오른쪽 칸이 열려 본문이 좁아지면 줄인다. 휴대폰도 2열(일정 칸과 같게)
  const mainWidth = useMainWidth();
  const columnsCount = mainWidth >= 980 ? 4 : mainWidth >= 720 ? 3 : 2;
  const columns = Array.from({ length: columnsCount }, () => [] as { item: ItemDoc; index: number }[]);
  shown.forEach((item, index) => columns[index % columnsCount].push({ item, index }));

  const pathOf = (id: string) => labelPath(id, tree.parents, (x) => tree.byId.get(x)?.name);
  const openCreate = () => sid && openNotePanel({ sid, date });
  const openMemo = () => sid && openNotePanel({ sid, date: null });
  const openEdit = (item: ItemDoc) => sid && openNotePanel({ sid, date, id: item.id });

  return (
    <section data-day-journal={date} className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        {/* 머리줄: ▼ 📔 기록 N [+ 추가] [+ 메모] ……… ⚙️ */}
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
              📔
            </span>
            <h3 className="text-base font-extrabold text-slate-800">기록</h3>
            <span data-journal-count={notes.length} className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {notes.length}
            </span>
            {!collapsed && (
              <button
                type="button"
                data-journal-add
                onClick={openCreate}
                aria-label="기록 추가"
                title="기록 추가 (오른쪽 칸)"
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                + 추가
              </button>
            )}
            {/* 날짜 없는 메모를 하루 화면에서 바로 (V4 UX-AUDIT C2) - 메모 화면으로 가지 않고 */}
            {!collapsed && (
              <button
                type="button"
                data-journal-add-memo
                onClick={openMemo}
                aria-label="메모 추가"
                title="날짜 없는 메모 쓰기 (오른쪽 칸) - 메모 화면에 모입니다. 칸의 📅 날짜를 넣으면 그날 기록이 됩니다"
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                + 메모
              </button>
            )}
          </div>
          {!collapsed && tree.list.length > 0 && (
            <div data-journal-filter className="flex items-center gap-1 flex-wrap order-last w-full">
              <FilterChip
                chipKey="all"
                text="전체"
                title="모든 기록 보기"
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
            title="메모·기록 라벨 설정"
            aria-label="메모·기록 라벨 설정"
          >
            ⚙️
          </button>
        </div>
      </div>

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
                      onMoveUp={sid && canMoveNote(shown, index, -1) ? () => void moveNoteInList(sid, shown, index, -1).catch(quiet) : undefined}
                      onMoveDown={sid && canMoveNote(shown, index, 1) ? () => void moveNoteInList(sid, shown, index, 1).catch(quiet) : undefined}
                      onOpen={() => openEdit(item)}
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
            고른 라벨의 기록이 없습니다.
          </div>
        ) : waiting ? (
          <p data-journal-waiting className="py-10 text-center text-xs text-slate-400">
            기록을 받는 중…
          </p>
        ) : (
          <div data-journal-empty className="w-full text-center py-10 bg-white/60 rounded-2xl border border-dashed border-slate-300 p-6 shadow-xs">
            <p className="text-slate-500 font-bold text-sm">등록된 기록이 없습니다.</p>
          </div>
        ))}
    </section>
  );
}

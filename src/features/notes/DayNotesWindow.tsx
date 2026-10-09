// 그날 기록 보기 (V4 components/JournalPeekModal.tsx) - 주간·월간·년간 날짜 옆 📝 n을 누르면. 창 'dayNotes' = { sid, date }.
// 하루 화면으로 가지 않고 그날 기록만 펼쳐 본다. 카드는 하루 기록 칸과 같다(완료·즐겨찾기·체크·지우기),
// 고치기·'+ 추가'는 하루 화면과 같은 기록 칸(오른쪽 쓰는 칸)을 연다.
import { useState } from 'react';
import type { WindowProps } from '../../app/windows';
import { shortDateLabel } from '../../domain/dateUtils';
import { isLongEntry } from '../../domain/entryCollapse';
import { labelPath } from '../../domain/labelTree';
import { itemLabels, useItemsOn, useLabelTree } from '../../data/select';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { openLinkViewer } from '../links/open';
import { deleteNote, moveNoteInList, setNoteDone, setNoteFavorite, toggleNoteCheckLine } from './actions';
import EntryCard from './EntryCard';
import DayCardView from '../day/DayCards';
import { useDayCardsOn } from '../day/useDayCards';
import { canMoveNote, favoriteFirst, timeLabel } from './noteOps';
import { openNotePanel, useEditingNoteIds, type DayNotesParams } from './open';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};

export default function DayNotesWindow({ params, close, raise }: WindowProps<DayNotesParams>) {
  const { sid, date } = params;
  const notes = favoriteFirst(useItemsOn(date, 'note', sid));
  const tree = useLabelTree('note', sid);
  const editing = useEditingNoteIds(sid);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const pathOf = (id: string) => labelPath(id, tree.parents, (x) => tree.byId.get(x)?.name);
  // 그날 알림장·출결 (계산한 카드 - 누르면 원본 칸)
  const cards = useDayCardsOn(date, sid);

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="lg"
      title={`📝 ${shortDateLabel(date)} 기록 (${notes.length})`}
      headerExtra={
        <button
          type="button"
          data-day-notes-add
          onClick={() => openNotePanel({ sid, date })}
          title="이 날 기록 추가 (하루 화면과 같은 기록 칸)"
          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          + 추가
        </button>
      }
      footer={<ModalCloseButton onClose={close} />}
    >
      <div data-day-notes={date} className="space-y-3">
        {cards.map((c) => (
          <DayCardView key={c.key} card={c} sid={sid} />
        ))}
        {notes.length === 0 ? (
          cards.length > 0 ? null : (
          <p className="py-10 text-center text-xs text-slate-400" data-day-notes-empty>
            이 날 기록이 없습니다.
          </p>
          )
        ) : (
          notes.map((item, index) => {
            const isCollapsed = collapsed[item.id] ?? isLongEntry(item.text);
            return (
              <EntryCard
                key={item.id}
                item={item}
                labels={itemLabels(tree, item.labelIds)}
                pathOf={pathOf}
                dateText={timeLabel(item.createdAt)}
                editing={editing.has(item.id)}
                collapsed={isCollapsed}
                onToggleCollapse={() => setCollapsed((p) => ({ ...p, [item.id]: !isCollapsed }))}
                onMoveUp={canMoveNote(notes, index, -1) ? () => void moveNoteInList(sid, notes, index, -1).catch(quiet) : undefined}
                onMoveDown={canMoveNote(notes, index, 1) ? () => void moveNoteInList(sid, notes, index, 1).catch(quiet) : undefined}
                onOpen={() => openNotePanel({ sid, date, id: item.id })}
                onOpenLinks={() => openLinkViewer({ sid, id: item.id })}
                onToggleDone={() => void setNoteDone(sid, item, !item.done).catch(quiet)}
                onToggleFavorite={() => void setNoteFavorite(sid, item, !item.favorite).catch(quiet)}
                onDelete={() => void deleteNote(sid, item).catch(quiet)}
                onToggleCheckLine={(idx, line) => toggleNoteCheckLine(sid, item, idx, line)}
              />
            );
          })
        )}
      </div>
    </ModalShell>
  );
}

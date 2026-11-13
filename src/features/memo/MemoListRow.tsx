// 메모 화면 '목록' 보기의 한 줄 (P10-5 사용자 의견 5e) - ▶ 펴기 · ★ · 첫 줄 · ☑ n/m · 라벨 칩 · 📅 날짜(없으면 쓴 날). 누르면 메모 보기 칸(11-09).
// 라벨 칩 = 완료(11-09 사용자 요청 - 카드와 같이 ☐ 체크 칸을 없앴다, EventDoneChip). 휴대폰은 칩 줄이 좁아 첫 칩(완료)만.
// ▶를 누르면 그 줄 아래에 카드와 같은 본문(EntryBody - 글·체크 줄·그림·첨부·표), ▼로 다시 한 줄(P11-1 사용자 의견 - 처음은 접힌 채).
// 차례 바꾸기는 카드와 같다 - ▲▼ 단추와 끌어 놓기(날짜 없는 메모끼리, 직접 정렬일 때).
import { shortDateLabel } from '../../domain/dateUtils';
import { checkCount } from '../../domain/checkLines';
import { previewLine } from '../../domain/entryCollapse';
import { noteHeading } from '../../domain/noteTitle';
import type { ItemDoc } from '../events/eventOps';
import ClaudeRequestBadge from '../notes/ClaudeRequestBadge';
import ClaudeRequestNote from '../notes/ClaudeRequestNote';
import EntryBody from '../notes/EntryBody';
import { pressKeys } from '../../ui/pressKeys';
import EventDoneChip from '../events/EventDoneChip';

interface Props {
  item: ItemDoc;
  labels: ReadonlyArray<{ id: string; name: string; color: string }>;
  pathOf?: (id: string) => string;
  dates: readonly string[];
  /** 날짜 링크가 없을 때 보일 쓴 날 */
  dateText: string;
  editing?: boolean;
  /** 본문을 펼쳤나 (P11-1) */
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleCheckLine: (lineIndex: number, line: string) => Promise<unknown>;
  onOpen: () => void;
  onOpenDate: (date: string) => void;
  onToggleDone: () => void;
  onToggleFavorite: () => void;
  /** 끌어 놓아 순서 바꾸기 속성 (ui/reorderDrag - 마우스 화면에서만 온다) */
  dragProps?: object;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function MemoListRow(props: Props) {
  const { item, labels, pathOf, dates, dateText, editing, expanded, onToggleExpand, onOpen, onOpenDate, onToggleDone, onToggleFavorite } = props;
  const done = !!item.done;
  const checks = checkCount(item.text ?? '');
  const heading = noteHeading(item);
  const files = (item.attachments?.length ?? 0) + (item.tables?.length ?? 0);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  /** 라벨 칩 = 완료 (✓는 첫 칩에, 어느 칩을 눌러도). 라벨이 없으면 회색 ○ 칩 */
  const chip = (l: Props['labels'][number] | null, i: number) => (
    <EventDoneChip
      key={l?.id ?? 'none'}
      kind="note"
      label={l}
      done={done}
      mark={i === 0}
      onToggle={onToggleDone}
      hint={l ? (pathOf?.(l.id) ?? l.name) : undefined}
      truncate
      className="px-1.5 py-0.5 rounded-md text-2xs min-w-0 max-w-[7rem] shrink-0"
      data={{ 'data-memo-row-chip': l?.id ?? '' }}
    />
  );
  return (
    <li
      data-memo-row={item.id}
      role="button"
      tabIndex={0}
      onKeyDown={pressKeys}
      data-entry-done={done ? '1' : '0'}
      data-memo-row-expanded={expanded ? '1' : '0'}
      onClick={onOpen}
      {...props.dragProps}
      className={`group px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
        editing ? 'border-primary ring-1 ring-primary bg-primary/5' : done ? 'bg-slate-50 border-slate-200 opacity-70 hover:border-slate-300' : 'bg-white border-slate-200/80 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-memo-row-expand
          aria-expanded={expanded}
          onClick={(e) => {
            stop(e);
            onToggleExpand();
          }}
          title={expanded ? '접기' : '펼치기'}
          aria-label={expanded ? '접기' : '펼치기'}
          className="text-slate-400 hover:text-slate-700 text-xs w-5 h-5 -ml-1 flex items-center justify-center rounded hover:bg-slate-100 shrink-0 cursor-pointer"
        >
          {expanded ? '▼' : '▶'}
        </button>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            data-entry-up
            onClick={(e) => {
              stop(e);
              props.onMoveUp?.();
            }}
            disabled={!props.onMoveUp}
            title="앞으로"
            aria-label="앞으로"
            className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs cursor-pointer"
          >
            ▲
          </button>
          <button
            type="button"
            data-entry-down
            onClick={(e) => {
              stop(e);
              props.onMoveDown?.();
            }}
            disabled={!props.onMoveDown}
            title="뒤로"
            aria-label="뒤로"
            className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs cursor-pointer"
          >
            ▼
          </button>
        </div>
        <button
          type="button"
          data-memo-row-favorite
          aria-pressed={!!item.favorite}
          onClick={(e) => {
            stop(e);
            onToggleFavorite();
          }}
          title={item.favorite ? '즐겨찾기 풀기' : '즐겨찾기'}
          className={`text-sm leading-none shrink-0 cursor-pointer ${item.favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
        >
          {item.favorite ? '★' : '☆'}
        </button>
        <span data-memo-row-text className={`flex-1 min-w-0 ${expanded ? 'break-words' : 'truncate'} text-sm ${done ? 'line-through text-slate-500' : 'text-slate-800'}`}>
          {/* 제목 = 첫 줄 굵게 (P35 - 첫 줄이 체크 줄이면 보통 글씨로 그 줄). ▶로 펴면 자르지 않는다 - 본문은 그 아래 줄부터라 긴 첫 줄이 숨지 않게 */}
          {heading.title ? (
            <strong data-memo-row-title className="font-extrabold">
              {heading.title}
            </strong>
          ) : (
            previewLine(item.text) || (files > 0 ? '(첨부)' : '(빈 메모)')
          )}
        </span>
        {checks.total > 0 && (
          <span className="text-2xs font-bold text-slate-500 shrink-0" title={`체크 목록 ${checks.total}개 가운데 ${checks.done}개 체크`}>
            ☑ {checks.done}/{checks.total}
          </span>
        )}
        <span className="flex items-center gap-1 shrink-0 max-w-[40%] min-w-0 overflow-hidden">
          {chip(labels[0] ?? null, 0)}
          {labels.length > 1 && <span className="hidden sm:flex items-center gap-1 min-w-0 overflow-hidden">{labels.slice(1).map((l, i) => chip(l, i + 1))}</span>}
        </span>
        <ClaudeRequestBadge itemId={item.id} />
        {dates.length > 0 ? (
          <button
            type="button"
            data-entry-date-chip={dates.at(-1)}
            onClick={(e) => {
              stop(e);
              onOpenDate(dates.at(-1)!);
            }}
            title={dates.length > 1 ? `${dates.map(shortDateLabel).join(', ')} - 누르면 가장 늦은 날 하루 화면` : `${shortDateLabel(dates[0])} 하루 화면으로`}
            className="px-1.5 py-0.5 rounded-md text-2xs font-bold bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            📅 {shortDateLabel(dates.at(-1)!)}
            {dates.length > 1 ? ` 외 ${dates.length - 1}` : ''}
          </button>
        ) : (
          <span className="text-2xs text-slate-400 whitespace-nowrap shrink-0">{dateText}</span>
        )}
      </div>
      {expanded && (
        <div data-memo-row-body className="mt-2 pl-6 flex flex-col gap-2 min-w-0">
          <EntryBody item={item} onToggleCheckLine={props.onToggleCheckLine} skipLine={heading.line} />
          <ClaudeRequestNote itemId={item.id} />
        </div>
      )}
    </li>
  );
}

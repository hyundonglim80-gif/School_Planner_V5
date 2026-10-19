// 메모 화면 '목록' 보기의 한 줄 (P10-5 사용자 의견 5e) - ▶ 펴기 · ☐ 완료 · ★ · 첫 줄 · ☑ n/m · 라벨 칩 · 📅 날짜(없으면 쓴 날). 누르면 쓰는 칸.
// ▶를 누르면 그 줄 아래에 카드와 같은 본문(EntryBody - 글·체크 줄·그림·첨부·표), ▼로 다시 한 줄(P11-1 사용자 의견 - 처음은 접힌 채).
// 카드(EntryCard)의 ▲▼는 목록에 없다 - 차례 바꾸기는 카드 보기에서.
import { shortDateLabel } from '../../domain/dateUtils';
import { checkCount } from '../../domain/checkLines';
import { noteTitle } from '../../domain/noteTitle';
import { labelColor } from '../../domain/labels';
import type { ItemDoc } from '../events/eventOps';
import ClaudeRequestBadge from '../notes/ClaudeRequestBadge';
import EntryBody from '../notes/EntryBody';

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
}

export default function MemoListRow(props: Props) {
  const { item, labels, pathOf, dates, dateText, editing, expanded, onToggleExpand, onOpen, onOpenDate, onToggleDone, onToggleFavorite } = props;
  const done = !!item.done;
  const checks = checkCount(item.text ?? '');
  const files = (item.attachments?.length ?? 0) + (item.tables?.length ?? 0);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <li
      data-memo-row={item.id}
      data-entry-done={done ? '1' : '0'}
      data-memo-row-expanded={expanded ? '1' : '0'}
      onClick={onOpen}
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
        <input
          type="checkbox"
          checked={done}
          aria-label="메모 완료"
          title={done ? '완료 풀기' : '완료'}
          data-memo-row-complete
          onClick={stop}
          onChange={onToggleDone}
          className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
        />
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
        <span data-memo-row-text className={`flex-1 min-w-0 truncate text-sm ${done ? 'line-through text-slate-500' : 'text-slate-800'}`}>
          {noteTitle(item) || (files > 0 ? '(첨부)' : '(빈 메모)')}
        </span>
        {checks.total > 0 && (
          <span className="text-2xs font-bold text-slate-500 shrink-0" title={`체크 목록 ${checks.total}개 가운데 ${checks.done}개 체크`}>
            ☑ {checks.done}/{checks.total}
          </span>
        )}
        <span className="hidden sm:flex items-center gap-1 shrink-0 max-w-[40%] overflow-hidden">
          {labels.map((l) => {
            const c = labelColor(l.color);
            return (
              <span
                key={l.id}
                data-memo-row-chip={l.id}
                title={pathOf?.(l.id) ?? l.name}
                className="px-1.5 py-0.5 rounded-md text-2xs font-bold border whitespace-nowrap truncate max-w-[7rem]"
                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
              >
                {l.name}
              </span>
            );
          })}
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
          <EntryBody item={item} onToggleCheckLine={props.onToggleCheckLine} />
        </div>
      )}
    </li>
  );
}

// 월간 달력의 기간 일정 막대 (V4 features/month/PeriodBar.tsx). 한 주 줄 안에서 이어지는 날을 한 막대로.
// 막대는 날짜 칸 밖(주 줄의 격자)에 있어 칸 누르기(그날 하루 화면)와 따로 논다. 막대 안은 날마다 한 조각 -
// 누르면 그 일정 칸(그날), 그날 끝냈으면(doneDates) 그 조각만 흐리게.
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { periodIndexLabel, periodRangeLabel, type BarCell, type WeekBar } from '../../domain/periodBars';
import { eventDragProps } from '../events/drag';
import { doneOnDay, type ItemDoc } from '../events/eventOps';

interface Props {
  bar: WeekBar<ItemDoc>;
  labelName: string;
  labelColor: { bg: string; text: string; border: string } | null;
  compact: boolean;
  multiOn: boolean;
  picked: (cell: BarCell) => boolean;
  /** 그 날짜가 이 달인가 (앞뒤 달 날은 칸처럼 흐리게) */
  isCurrentMonth: (date: string) => boolean;
  /** 조각 누르기 (Ctrl·Shift는 여러 개 고르기 - 부르는 쪽이 본다) */
  onOpen: (cell: BarCell, e: ReactMouseEvent) => void;
  onOpenLinks: () => void;
  style?: CSSProperties;
  /** 조각을 끌어 다른 날로 (기간이라 놓으면 어디까지 묻는다) */
  drag?: { enabled: boolean; onEnd: () => void };
}

/** 라벨이 없을 때의 막대 빛깔 (보통 일정 칩보다 한 단계 짙게 - 칸 바탕과 갈리게) */
const DEFAULT_COLOR = { bg: '#dbeafe', text: '#1e3a8a', border: '#bfdbfe' };
const DONE_BG = 'var(--color-slate-100)';

export default function PeriodBar({ bar, labelName, labelColor, compact, multiOn, picked, isCurrentMonth, onOpen, onOpenLinks, style, drag }: Props) {
  const color = labelColor || DEFAULT_COLOR;
  const ev = bar.item;
  const doneAt = (date: string) => doneOnDay(ev, date);
  const allDone = bar.cells.every((c) => doneAt(c.date));
  const indexLabel = periodIndexLabel(bar.cells, bar.total);
  const range = periodRangeLabel(bar.cells);
  const radius = compact ? '3px' : '5px';
  const links = ev.linkIds?.length ?? 0;

  return (
    <div
      data-period-bar={ev.id}
      data-period-bar-done={allDone ? '1' : '0'}
      className={`relative z-10 min-w-0 self-start ${compact ? 'h-[14px]' : ''}`}
      style={{
        ...style,
        // 기간의 첫날·끝날만 둥글고 안으로 들인다. 앞뒤 주(달)로 이어지면 칸 끝까지 닿아 이어 보인다
        marginLeft: bar.startsPeriod ? (compact ? 2 : 4) : 0,
        marginRight: bar.endsPeriod ? (compact ? 2 : 4) : 0,
      }}
      title={`${labelName ? `[${labelName}] ` : ''}${ev.text} (${indexLabel}) · ${range}${bar.startsPeriod ? '' : ' · 앞에서 이어짐'}${bar.endsPeriod ? '' : ' · 뒤로 이어짐'}`}
    >
      <div
        className="absolute inset-0 flex overflow-hidden border"
        style={{
          borderColor: allDone ? 'var(--color-slate-200)' : color.border,
          borderTopLeftRadius: bar.startsPeriod ? radius : 0,
          borderBottomLeftRadius: bar.startsPeriod ? radius : 0,
          borderTopRightRadius: bar.endsPeriod ? radius : 0,
          borderBottomRightRadius: bar.endsPeriod ? radius : 0,
          borderLeftWidth: bar.startsPeriod ? 1 : 0,
          borderRightWidth: bar.endsPeriod ? 1 : 0,
        }}
      >
        {bar.cells.map((cell) => (
          <div
            key={cell.date}
            data-period-cell={cell.date}
            {...eventDragProps(ev, cell.date, !!drag?.enabled, drag?.onEnd)}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(cell, e);
            }}
            className={`relative flex-1 min-w-0 cursor-pointer hover:brightness-95 ${picked(cell) ? 'ring-2 ring-inset ring-primary' : ''} ${isCurrentMonth(cell.date) ? '' : 'opacity-40'}`}
            style={{ backgroundColor: doneAt(cell.date) ? DONE_BG : color.bg }}
            title={`${ev.text} (${cell.index}/${bar.total}) · ${Number(cell.date.slice(5, 7))}.${Number(cell.date.slice(8, 10))}${doneAt(cell.date) ? ' · 완료' : ''} - ${multiOn ? '눌러서 고르기' : '누르면 일정 칸'}`}
          />
        ))}
      </div>
      {/* 글은 막대 전체에 한 줄로 (누르는 것은 아래 조각으로 지나간다) */}
      <div
        className={`relative pointer-events-none flex items-center gap-1 whitespace-nowrap overflow-hidden ${compact ? 'h-full px-1 text-2xs leading-none' : 'px-1.5 py-0.5 text-2xs leading-tight'} font-bold`}
        style={{ color: allDone ? 'var(--color-slate-400)' : color.text }}
      >
        {!bar.startsPeriod && <span className="shrink-0 opacity-60">◂</span>}
        {labelName && !compact && (
          <span className="shrink-0 px-1 rounded bg-white/70 text-2xs font-bold" style={{ color: allDone ? 'var(--color-slate-400)' : color.text }}>
            {labelName}
          </span>
        )}
        <span className={`truncate ${allDone ? 'line-through' : ''}`}>{ev.text}</span>
        {!compact && <span className="shrink-0 text-2xs font-semibold opacity-70">{indexLabel}</span>}
        {links > 0 && !compact && (
          <button
            type="button"
            data-period-bar-links={links}
            onClick={(e) => {
              e.stopPropagation();
              onOpenLinks();
            }}
            className="pointer-events-auto shrink-0 bg-yellow-100 text-yellow-800 text-2xs leading-none px-1 py-0.5 rounded font-bold border border-yellow-300 hover:bg-yellow-200 cursor-pointer"
            title={`링크된 항목 ${links}개`}
          >
            🔗 {links}
          </button>
        )}
        {!bar.endsPeriod && <span className="ml-auto shrink-0 opacity-60">▸</span>}
      </div>
    </div>
  );
}

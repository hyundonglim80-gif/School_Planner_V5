// 카드·목록에 붙는 라벨 칩 (V4 하루·월간·년간 카드의 라벨 칩 - getLabelColor). 색은 라벨 색 표(domain/labels).
// 끝낸 항목은 회색으로 (V4 월간·년간 그대로).
import { labelColor } from '../../domain/labels';

export interface ChipLabel {
  id: string;
  name: string;
  color: string;
}

export default function LabelChip({ label, title, muted = false }: { label: ChipLabel; title?: string; muted?: boolean }) {
  const c = labelColor(label.color);
  return (
    <span
      data-label-chip={label.id}
      title={title ?? label.name}
      className="inline-flex items-center min-w-0 max-w-full px-1.5 py-0.5 rounded-md text-2xs font-bold border leading-tight truncate"
      style={
        muted
          ? { backgroundColor: 'var(--color-slate-100)', color: 'var(--color-slate-400)', borderColor: 'var(--color-slate-200)' }
          : { backgroundColor: c.bg, color: c.text, borderColor: c.border }
      }
    >
      {label.name}
    </span>
  );
}

/** 항목의 라벨 칩들 (붙인 차례대로) */
export function LabelChips({ labels, muted, pathOf }: { labels: readonly ChipLabel[]; muted?: boolean; pathOf?: (id: string) => string }) {
  if (labels.length === 0) return null;
  return (
    <span data-label-chips className="inline-flex flex-wrap items-center gap-1 min-w-0">
      {labels.map((l) => (
        <LabelChip key={l.id} label={l} muted={muted} title={pathOf?.(l.id)} />
      ))}
    </span>
  );
}

// 자리표 창의 ⚙️ 모양 칸 (V4 SeatingModal 'shape') - 이름·줄·열·분단·교탁·🔢 번호 차례로·🗑️ 지우기. 고칠 때마다 곧바로 저장.
import { useState } from 'react';
import { showToast } from '../../app/toast';
import type { Stored } from '../../data/types';
import { GROUP_COL_CHOICES, MAX_COLS, MAX_ROWS, numberOrderSeats, resizeChart, unseatedNums, type SeatStudent, type SeatingChart } from '../../domain/seating';
import { deleteChart, updateChart } from './seatingData';

const GROUP_COL_LABEL: Record<number, string> = { 0: '통로 없음', 1: '한 칸씩', 2: '두 칸 (짝)', 3: '세 칸' };

interface Props {
  sid: string;
  chart: SeatingChart;
  stored: Stored<'seating'>;
  /** 재학생 */
  active: SeatStudent[];
  /** 지운 뒤 (칸을 닫는다) */
  onDeleted: () => void;
}

export default function SeatShapeBox({ sid, chart, stored, active, onDeleted }: Props) {
  const save = (fields: Parameters<typeof updateChart>[2], message?: string) => void updateChart(sid, stored, fields, message).catch(() => {});

  const resize = (rows: number, cols: number) => {
    const next = resizeChart(chart, rows, cols);
    const lost = unseatedNums({ ...chart, ...next }, active).length - unseatedNums(chart, active).length;
    save(next);
    if (lost > 0) showToast(`${lost}명이 자리 없음으로 갔습니다. 아래 '자리 없는 학생'에서 다시 앉힙니다.`);
  };

  // 이름은 칸을 떠날 때(Enter) 저장 - 다른 자리표로 가거나 다른 기기에서 고치면 따라간다
  const [nameDraft, setNameDraft] = useState(chart.name);
  const [seenName, setSeenName] = useState(`${chart.id}|${chart.name}`);
  if (seenName !== `${chart.id}|${chart.name}`) {
    setSeenName(`${chart.id}|${chart.name}`);
    setNameDraft(chart.name);
  }
  const saveName = () => {
    const name = nameDraft.trim();
    if (!name || name === chart.name) return setNameDraft(chart.name);
    save({ name });
  };

  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteChart(sid, chart);
      onDeleted();
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };

  const pick = (on: boolean) => `px-2 py-1 rounded-lg font-bold cursor-pointer ${on ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200'}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex flex-col gap-2 text-xs" data-seating-box="shape">
      <label className="flex items-center gap-2">
        <span className="w-12 font-bold text-slate-500">이름</span>
        <input
          value={nameDraft}
          data-seating-name
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              saveName();
            }
          }}
          aria-label="자리표 이름"
          className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg font-bold"
        />
      </label>
      {(
        [
          ['줄', 'rows', MAX_ROWS],
          ['열', 'cols', MAX_COLS],
        ] as const
      ).map(([label, field, max]) => (
        <div key={field} className="flex items-center gap-2">
          <span className="w-12 font-bold text-slate-500">{label}</span>
          <button
            type="button"
            data-seating-size-down={field}
            aria-label={`${label} 줄이기`}
            title={`${label} 줄이기`}
            disabled={chart[field] <= 1}
            onClick={() => resize(field === 'rows' ? chart.rows - 1 : chart.rows, field === 'cols' ? chart.cols - 1 : chart.cols)}
            className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-black disabled:opacity-40 cursor-pointer"
          >
            −
          </button>
          <span className="w-6 text-center font-black" data-seating-size={field}>
            {chart[field]}
          </span>
          <button
            type="button"
            data-seating-size-up={field}
            aria-label={`${label} 늘리기`}
            title={`${label} 늘리기`}
            disabled={chart[field] >= max}
            onClick={() => resize(field === 'rows' ? chart.rows + 1 : chart.rows, field === 'cols' ? chart.cols + 1 : chart.cols)}
            className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-black disabled:opacity-40 cursor-pointer"
          >
            +
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 font-bold text-slate-500">분단</span>
        {GROUP_COL_CHOICES.map((g) => (
          <button key={g} type="button" data-seating-group-cols={g} aria-pressed={chart.groupCols === g} onClick={() => save({ groupCols: g })} className={pick(chart.groupCols === g)}>
            {GROUP_COL_LABEL[g]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 font-bold text-slate-500">교탁</span>
        {(['top', 'bottom'] as const).map((f) => (
          <button key={f} type="button" data-seating-front={f} aria-pressed={chart.front === f} onClick={() => save({ front: f })} className={pick(chart.front === f)}>
            {f === 'top' ? '위 (학생 쪽에서)' : '아래 (교탁에서)'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200">
        <button
          type="button"
          data-seating-number-order
          onClick={() => save({ seats: numberOrderSeats(chart, active).seats }, '🔢 번호 차례로 앉혔습니다.')}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold cursor-pointer"
        >
          🔢 번호 차례로 앉히기
        </button>
        <button type="button" data-seating-delete onClick={() => void remove()} disabled={busy} className="ml-auto px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-bold cursor-pointer">
          🗑️ 이 자리표 지우기
        </button>
      </div>
    </div>
  );
}

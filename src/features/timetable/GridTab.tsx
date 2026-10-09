// 시간표 창 '🗂️ 시간표' 탭 (V4 TimetableTemplateModal의 표). 기간별로 여러 장 - 1학기·2학기·'10/14부터'.
//   위 칩 = 시간표 고르기 · + 새 시간표(지금 표를 베껴 오늘부터) · 이름·기간 · 🗑️ 지우기.
//   표: 화살표·Enter·Tab으로 칸을 옮기고, 엑셀에서 복사한 표를 Ctrl+V로 한 번에(domain/gridNav). 첫 칸은 교시 이름(교시 탭과 같은 값).
//   교과 모드는 칸마다 학년-반 + 과목 두 칸(▼ 목록), 저장은 '5-2 과학' 한 글자.
// 기간이 겹치면 늦게 시작한 시간표가 이긴다 - '적용' 단추 없이 저장하면 그 기간의 날이 따라간다.
import { useRef } from 'react';
import type React from 'react';
import { showToast } from '../../app/toast';
import { shortDateLabel } from '../../domain/dateUtils';
import { clipboardWrites, isSingleCell, nextCell, parseClipboardGrid, type CellPos } from '../../domain/gridNav';
import { addPeriod, removePeriod, type PeriodDef } from '../../domain/periodTimes';
import { normalizeSlotText } from '../../domain/teachingSlot';
import SlotPairInput from '../lessons/SlotPairInput';
import { WEEKDAYS, type TimetableDraft } from './timetableDraft';

const DAYS = [
  { key: '1', label: '월요일', color: 'text-blue-600' },
  { key: '2', label: '화요일', color: 'text-indigo-600' },
  { key: '3', label: '수요일', color: 'text-emerald-600' },
  { key: '4', label: '목요일', color: 'text-amber-600' },
  { key: '5', label: '금요일', color: 'text-rose-600' },
] as const;

interface Props {
  list: TimetableDraft[];
  current: TimetableDraft;
  /** 오늘 따르는 시간표 id */
  todayId: string | null;
  today: string;
  onPick: (id: string) => void;
  onChange: (next: TimetableDraft) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  periods: PeriodDef[];
  onPeriods: (next: PeriodDef[]) => void;
  /** 빠른 기간: 1학기부터 / 2학기부터 (학년도 끝까지) */
  quick: { sem1: { from: string; to: string }; sem2: { from: string; to: string } };
  isClassUnit: boolean;
  pairOptions: { classes: string[]; subjects: string[] };
}

const md = (d: string) => (d ? shortDateLabel(d) : '?');

export default function GridTab({ list, current, todayId, today, onPick, onChange, onAdd, onRemove, periods, onPeriods, quick, isClassUnit, pairOptions }: Props) {
  const gridRef = useRef<HTMLTableSectionElement>(null);
  const grid = current.grid;

  const setCell = (wd: string, n: number, value: string) => {
    onChange({ ...current, grid: { ...grid, [wd]: { ...(grid[wd] ?? {}), [String(n)]: value } } });
  };

  // ── 표 안에서 엑셀처럼 움직이고 붙여 넣기 (칸 0은 교시 이름, 1부터 요일) ──
  const gridSize = { rows: periods.length, cols: DAYS.length + 1 };

  /** 옮겨 간 칸에 커서를 놓고 글자를 통째로 고른다 (엑셀처럼 덮어쓰기 좋게) */
  const focusCell = (pos: CellPos) => {
    const el = gridRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${pos.row}-${pos.col}"]`);
    if (!el) return;
    el.focus();
    el.select();
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const target = nextCell({ row, col }, gridSize, {
      key: e.key,
      shift: e.shiftKey,
      // 고른 글자가 있으면 커서가 양 끝에 다 닿은 것으로 본다 - 통째로 고른 상태에서 좌우는 옆 칸으로
      atStart: el.selectionStart === 0,
      atEnd: el.selectionEnd === el.value.length,
    });
    if (!target) return; // 표 끝이거나 다루지 않는 키 - 브라우저에 맡긴다
    e.preventDefault();
    focusCell(target);
  };

  /** 한 칸에 한 값씩, 한 번에 모아 쓴다 (앞의 것이 덮이지 않게) */
  const handleCellPaste = (e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || isSingleCell(text)) return; // 칸 하나짜리는 브라우저에 맡긴다
    e.preventDefault();
    const writes = clipboardWrites({ row, col }, gridSize, parseClipboardGrid(text));
    if (writes.length === 0) return;
    const names = periods.map((p) => ({ ...p }));
    const next = { ...grid };
    let namesChanged = false;
    for (const w of writes) {
      if (w.col === 0) {
        names[w.row].name = w.value;
        namesChanged = true;
      } else {
        const wd = WEEKDAYS[w.col - 1];
        next[wd] = { ...(next[wd] ?? {}), [String(w.row + 1)]: isClassUnit ? normalizeSlotText(w.value) : w.value };
      }
    }
    onChange({ ...current, grid: next });
    if (namesChanged) onPeriods(names);
    const last = writes[writes.length - 1];
    // 붙여 넣은 마지막 칸으로 커서를 옮겨 둔다 - 어디까지 들어갔는지 눈으로 보인다
    requestAnimationFrame(() => focusCell({ row: last.row, col: last.col }));
    showToast(`✅ ${writes.length}칸을 붙여 넣었습니다.`);
  };

  const pill = (on: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
      on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-blue-200 hover:bg-blue-50'
    }`;

  const input = 'border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-400';

  return (
    <div className="space-y-4" data-grid-tab>
      {/* 시간표 고르기 */}
      <div className="flex items-center gap-1.5 flex-wrap px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl" data-timetable-list={list.length}>
        {list.map((t) => (
          <button key={t.id} type="button" data-timetable-pick={t.id} aria-pressed={t.id === current.id} onClick={() => onPick(t.id)} className={pill(t.id === current.id)} title={`${t.from} ~ ${t.to}`}>
            📅 {t.name.trim() || '이름 없음'}
            <span className={`ml-1 font-semibold ${t.id === current.id ? 'text-blue-100' : 'text-slate-400'}`}>
              {md(t.from)}~{md(t.to)}
            </span>
            {t.id === todayId && <span className="ml-1">· 오늘</span>}
          </button>
        ))}
        <button type="button" data-timetable-add onClick={onAdd} className="ml-auto px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer" title="지금 표를 베껴 오늘부터 쓰는 새 시간표를 만듭니다">
          + 새 시간표
        </button>
      </div>

      {/* 이름·기간 */}
      <div className="flex items-center gap-2 flex-wrap text-xs" data-timetable-meta={current.id}>
        <input
          type="text"
          value={current.name}
          data-timetable-name
          onChange={(e) => onChange({ ...current, name: e.target.value })}
          placeholder="시간표 이름"
          aria-label="시간표 이름"
          className={`${input} w-36`}
        />
        <input type="date" value={current.from} data-timetable-from onChange={(e) => onChange({ ...current, from: e.target.value })} aria-label="시작 날" className={input} />
        <span>~</span>
        <input type="date" value={current.to} data-timetable-to onChange={(e) => onChange({ ...current, to: e.target.value })} aria-label="끝 날" className={input} />
        <button type="button" data-timetable-quick="sem1" onClick={() => onChange({ ...current, ...quick.sem1 })} className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-600 cursor-pointer" title={`${quick.sem1.from} ~ ${quick.sem1.to}`}>
          1학기부터
        </button>
        <button type="button" data-timetable-quick="sem2" onClick={() => onChange({ ...current, ...quick.sem2 })} className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-600 cursor-pointer" title={`${quick.sem2.from} ~ ${quick.sem2.to}`}>
          2학기부터
        </button>
        <button type="button" data-timetable-delete onClick={() => onRemove(current.id)} className="ml-auto px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-bold cursor-pointer">
          🗑️ 이 시간표 지우기
        </button>
      </div>
      <p className="text-2xs text-slate-400 font-semibold -mt-2">
        기간이 겹치면 늦게 시작한 시간표가 이깁니다. 저장하면 그 기간의 하루·주간 수업 칸이 저절로 바뀝니다(그날 따로 고친 칸은 그대로).
        {todayId === current.id ? ` 오늘(${md(today)})은 이 시간표를 따릅니다.` : ''}
      </p>

      {/* 표 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-2xs text-slate-400 font-semibold">화살표·엔터·탭으로 칸을 옮기고, 엑셀에서 복사한 표를 Ctrl+V로 한 번에 붙여 넣을 수 있습니다.</p>
          <div className="flex items-center gap-1.5">
            <button type="button" data-grid-period-add onClick={() => onPeriods(addPeriod(periods))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold border border-slate-200 cursor-pointer">
              + 교시 추가
            </button>
            <button type="button" data-grid-period-remove onClick={() => onPeriods(removePeriod(periods))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold border border-slate-200 cursor-pointer">
              - 교시 삭제
            </button>
          </div>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className={`w-full text-xs text-center border-collapse ${isClassUnit ? 'min-w-[44rem]' : ''}`}>
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-24">교시</th>
                  {DAYS.map((d) => (
                    <th key={d.key} className={`p-2.5 ${d.color}`}>
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100" ref={gridRef}>
                {periods.map((p, row) => (
                  <tr key={p.n} className="hover:bg-slate-50/50">
                    <td className="p-1.5 bg-slate-50 border-r border-slate-200">
                      <input
                        type="text"
                        value={p.name}
                        data-cell={`${row}-0`}
                        onChange={(e) => onPeriods(periods.map((x, i) => (i === row ? { ...x, name: e.target.value } : x)))}
                        onKeyDown={(e) => handleCellKeyDown(e, row, 0)}
                        onPaste={(e) => handleCellPaste(e, row, 0)}
                        aria-label={`${p.n}교시 이름`}
                        className="w-full text-center bg-transparent font-bold text-slate-700 focus:outline-none focus:bg-white focus:border focus:border-blue-400 rounded px-1 py-0.5"
                      />
                    </td>
                    {DAYS.map((d, i) => {
                      const col = i + 1;
                      const val = grid[d.key]?.[String(p.n)] ?? '';
                      return (
                        <td key={d.key} className="p-1 border-r border-slate-100 last:border-r-0">
                          {isClassUnit ? (
                            // 전담: 한 칸에 학년-반 + 과목 두 칸. 화살표로 칸을 옮겨 다니는 표라 들어갈 때 목록을 열지 않는다 - ▼·Alt+↓·글자 치기로 연다.
                            // 반 칸에서 Tab은 같은 칸의 과목으로, 과목 칸에서 Shift+Tab은 반으로 (브라우저에 맡긴다).
                            <SlotPairInput
                              value={val}
                              onValueChange={(v) => setCell(d.key, p.n, v)}
                              classOptions={pairOptions.classes}
                              subjectOptions={pairOptions.subjects}
                              layout="stack"
                              openOnFocus={false}
                              classProps={{
                                'data-cell': `${row}-${col}`,
                                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                  if (e.key === 'Tab' && !e.shiftKey) return;
                                  handleCellKeyDown(e, row, col);
                                },
                                onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => handleCellPaste(e, row, col),
                              }}
                              subjectProps={{
                                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                  if (e.key === 'Tab' && e.shiftKey) return;
                                  handleCellKeyDown(e, row, col);
                                },
                                onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => handleCellPaste(e, row, col),
                              }}
                              inputClassName="w-full text-center bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 font-bold text-slate-800 focus:outline-none"
                            />
                          ) : (
                            <input
                              type="text"
                              value={val}
                              data-cell={`${row}-${col}`}
                              onChange={(e) => setCell(d.key, p.n, e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, row, col)}
                              onPaste={(e) => handleCellPaste(e, row, col)}
                              placeholder="과목"
                              aria-label={`${d.label} ${p.n}교시`}
                              className="w-full text-center bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded px-1 py-1 font-bold text-slate-800 focus:outline-none"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

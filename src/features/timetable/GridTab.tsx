// 시간표 창 '🗂️ 시간표' 탭 (V4 TimetableTemplateModal의 표).
//   위 칩 = 저장된 시간표 고르기(이름·표만 - P37) · + 새 시간표(지금 표를 베낀다) · 이름 · 🗑️ 지우기(적용한 날은 그대로).
//   표: 화살표·Enter·Tab으로 칸을 옮기고, 엑셀에서 복사한 표를 Ctrl+V로 한 번에(domain/gridNav). 첫 칸은 교시 이름(교시 탭과 같은 값).
//   교과 모드는 칸마다 학년-반 + 과목 두 칸(▼ 목록), 저장은 '5-2 과학' 한 글자.
//   아래 '📅 날짜에 적용' = 시작·끝 날 + ✅ 적용(지금 표를 그 기간에 - 겹친 날만 바뀐다) · 적용된 시간표 줄(📥 불러오기·✕ 빼기).
//   적용 방식(P39 11-16 사용자 요청) = 🖌️ 덮어쓰기(그 기간은 모두 이 표) / 🧩 빈 칸만 채우기(앞 표의 과목은 그대로, 빈 칸과 적용된 표가 없는 날에만).
import { useRef } from 'react';
import type React from 'react';
import { showToast } from '../../app/toast';
import { monthDayLabel, shortDateLabel } from '../../domain/dateUtils';
import { clipboardWrites, isSingleCell, nextCell, parseClipboardGrid, type CellPos } from '../../domain/gridNav';
import { addPeriod, removePeriod, type PeriodDef } from '../../domain/periodTimes';
import { normalizeSlotText } from '../../domain/teachingSlot';
import { FAR_END, type Piece } from '../../domain/timetableApply';
import SlotPairInput from '../lessons/SlotPairInput';
import { WEEKDAYS, type ApplyMode, type TimetableDraft } from './timetableDraft';
import { Glyph } from '../../ui/Icon';
import { glyphText } from '../../ui/glyphText';
import { BTN_DANGER, BTN_SUB, PICK_ON } from '../../ui/buttons';

/** 적용된 시간표 줄 하나 (날마다 실제로 쓰이는 조각) */
export interface AppliedRow extends Piece {
  /** 적용된 문서 id */
  id: string;
  name: string;
  /** 오늘이 든 줄 */
  today: boolean;
}

const DAYS = [
  { key: '1', label: '월요일', color: 'text-cobalt-600' },
  { key: '2', label: '화요일', color: 'text-indigo-600' },
  { key: '3', label: '수요일', color: 'text-emerald-600' },
  { key: '4', label: '목요일', color: 'text-amber-600' },
  { key: '5', label: '금요일', color: 'text-rose-600' },
] as const;

interface Props {
  /** 저장된 시간표 */
  list: TimetableDraft[];
  current: TimetableDraft;
  /** 오늘 수업 칸이 따르는 표가 온 저장된 시간표 id */
  todayId: string | null;
  today: string;
  onPick: (id: string) => void;
  onChange: (next: TimetableDraft) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  periods: PeriodDef[];
  onPeriods: (next: PeriodDef[]) => void;
  /** 적용할 기간 (지금 고른 시간표의) */
  range: Piece;
  onRange: (next: Piece) => void;
  /** 빠른 기간: 1학기부터 / 2학기부터 (학년도 끝까지) */
  quick: { sem1: Piece; sem2: Piece };
  /** 적용 방식 (P39) */
  mode: ApplyMode;
  onMode: (next: ApplyMode) => void;
  onApply: () => void;
  applying: boolean;
  applied: AppliedRow[];
  onUnapply: (row: AppliedRow) => void;
  onLoad: (row: AppliedRow) => void;
  isClassUnit: boolean;
  pairOptions: { classes: string[]; subjects: string[] };
}

const md = (d: string) => (d ? shortDateLabel(d) : '?');
const short = (d: string) => (d ? monthDayLabel(d) : '?');

export default function GridTab(props: Props) {
  const { list, current, todayId, today, onPick, onChange, onAdd, onRemove, periods, onPeriods, isClassUnit, pairOptions } = props;
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
      on ? PICK_ON : 'bg-white text-slate-700 border-blue-200 hover:bg-blue-50'
    }`;

  const input = 'border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-400';

  return (
    <div className="space-y-4" data-grid-tab>
      {/* 시간표 고르기 */}
      <div className="flex items-center gap-1.5 flex-wrap px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl" data-timetable-list={list.length}>
        {list.map((t) => (
          <button key={t.id} type="button" data-timetable-pick={t.id} aria-pressed={t.id === current.id} onClick={() => onPick(t.id)} className={pill(t.id === current.id)}>
            <Glyph e="📅" /> {t.name.trim() || '이름 없음'}
            {t.id === todayId && <span className="ml-1">· 오늘</span>}
          </button>
        ))}
        <button type="button" data-timetable-add onClick={onAdd} className={`ml-auto px-2.5 py-1.5 ${BTN_SUB} rounded-lg text-xs font-bold cursor-pointer`} title="지금 표를 베낀 새 시간표를 만듭니다">
          + 새 시간표
        </button>
      </div>

      {/* 이름 */}
      <div className="flex items-center gap-2 flex-wrap text-xs" data-timetable-meta={current.id}>
        <input
          type="text"
          value={current.name}
          data-timetable-name
          onChange={(e) => onChange({ ...current, name: e.target.value })}
          placeholder="시간표 이름"
          aria-label="시간표 이름"
          className={`${input} w-48`}
        />
        <button type="button" data-timetable-delete onClick={() => onRemove(current.id)} className={`ml-auto px-2.5 py-1 ${BTN_DANGER} rounded-lg font-bold cursor-pointer`}>
          <Glyph e="🗑" /> 이 시간표 지우기
        </button>
      </div>
      <p className="text-2xs text-slate-500 font-semibold -mt-2">
        <Glyph e="💾" /> 저장은 표만 남깁니다 - 수업 칸에는 아래 <b><Glyph e="✅" /> 적용</b>으로 씁니다.
        {todayId === current.id ? ` 오늘(${md(today)})은 이 시간표를 따릅니다.` : ''}
      </p>

      {/* 표 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-2xs text-slate-500 font-semibold">엑셀에서 복사한 표는 Ctrl+V로 한 번에 들어갑니다.</p>
          <div className="flex items-center gap-1.5">
            <button type="button" data-grid-period-add onClick={() => onPeriods(addPeriod(periods))} className={`px-2 py-1 ${BTN_SUB} rounded-lg text-xs font-bold cursor-pointer`}>
              + 교시 추가
            </button>
            <button type="button" data-grid-period-remove onClick={() => onPeriods(removePeriod(periods))} className={`px-2 py-1 ${BTN_SUB} rounded-lg text-xs font-bold cursor-pointer`}>
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

      <ApplyBox {...props} input={input} />
    </div>
  );
}

/** 📅 날짜에 적용 - 기간 + ✅ 적용, 그 아래 적용된 시간표 줄 */
const MODES: Array<{ key: ApplyMode; label: string; title: string }> = [
  { key: 'replace', label: '🖌️ 덮어쓰기', title: '이 기간은 모두 위 표를 따릅니다 (전에 적용한 표는 그 날들에서 지워집니다)' },
  { key: 'fill', label: '🧩 빈 칸만 채우기', title: '전에 적용한 표의 과목은 그대로 두고, 과목이 없는 칸에만 위 표의 과목을 넣습니다' },
];

function ApplyBox({ range, onRange, quick, mode, onMode, onApply, applying, applied, onUnapply, onLoad, input, today }: Props & { input: string }) {
  const quickBtn = `px-2 py-1 rounded-lg ${BTN_SUB} font-bold cursor-pointer`;
  const small = 'px-2 py-0.5 rounded-md border font-bold cursor-pointer';
  return (
    <div className="space-y-2.5 px-3 py-3 bg-emerald-50/60 border border-emerald-200 rounded-xl" data-timetable-apply-box>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-black text-emerald-800"><Glyph e="📅" /> 날짜에 적용</span>
        <input type="date" value={range.from} data-timetable-from onChange={(e) => onRange({ ...range, from: e.target.value })} aria-label="적용 시작 날" className={input} />
        <span>~</span>
        <input type="date" value={range.to} data-timetable-to onChange={(e) => onRange({ ...range, to: e.target.value })} aria-label="적용 끝 날" className={input} />
        <button type="button" data-timetable-quick="sem1" onClick={() => onRange(quick.sem1)} className={quickBtn} title={`${quick.sem1.from} ~ ${quick.sem1.to}`}>
          1학기부터
        </button>
        <button type="button" data-timetable-quick="sem2" onClick={() => onRange(quick.sem2)} className={quickBtn} title={`${quick.sem2.from} ~ ${quick.sem2.to}`}>
          2학기부터
        </button>
        <button
          type="button"
          data-timetable-apply
          onClick={onApply}
          disabled={applying}
          className={`ml-auto px-3 py-1.5 ${BTN_SUB} disabled:opacity-50 rounded-lg text-xs font-bold cursor-pointer`}
          title={mode === 'fill' ? '위 표의 과목을 이 기간의 빈 칸에만 넣습니다' : '위 표를 이 기간의 수업 칸에 씁니다'}
        >
          <Glyph e="✅" /> {applying ? '적용 중...' : `${short(range.from)} ~ ${short(range.to)} 적용`}
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap text-xs" role="radiogroup" aria-label="적용 방식" data-timetable-mode-box={mode}>
        <span className="font-black text-slate-500 mr-0.5">적용 방식</span>
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            data-timetable-mode={m.key}
            onClick={() => onMode(m.key)}
            title={m.title}
            className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
              mode === m.key ? PICK_ON : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {glyphText(m.label)}
          </button>
        ))}
      </div>
      <p className="text-2xs text-slate-500 font-semibold" data-timetable-mode-info>
        {mode === 'fill' ? (
          <>
            위 표의 과목을 이 기간의 <b>빈 칸에만</b> 넣습니다.
          </>
        ) : (
          <>
            이미 적용한 기간과 겹치면 <b>겹친 날만</b> 이 표로 바뀝니다.
          </>
        )}
        {range.from && range.from < today ? ' 지난 날짜도 바뀌어 진도 세기가 달라집니다.' : ''}
      </p>
      <div className="space-y-1" data-timetable-applied-list={applied.length}>
        <p className="text-2xs font-black text-slate-500">적용된 시간표</p>
        {applied.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500" data-timetable-applied-empty>
            아직 적용한 날이 없습니다 - 수업 칸이 비어 있습니다.
          </p>
        ) : (
          applied.map((row) => (
            <div
              key={`${row.id}:${row.from}`}
              data-timetable-applied={row.id}
              data-applied-from={row.from}
              data-applied-to={row.to === FAR_END ? '' : row.to}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${row.today ? 'bg-white border border-emerald-300' : 'bg-white/60 border border-transparent'}`}
            >
              <span className="font-bold text-slate-700 tabular-nums shrink-0">
                {md(row.from)} ~ {row.to === FAR_END ? '끝 없음' : md(row.to)}
              </span>
              <span className="font-semibold text-slate-600 truncate min-w-0">{row.name || '시간표'}</span>
              {row.today && <span className="shrink-0 font-bold text-emerald-700">· 오늘</span>}
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <button type="button" data-timetable-load onClick={() => onLoad(row)} className={`${small} ${BTN_SUB}`} title="이 기간에 적용된 표를 위 표로 불러옵니다">
                  <Glyph e="📥" /> 불러오기
                </button>
                <button type="button" data-timetable-unapply onClick={() => onUnapply(row)} className={`${small} ${BTN_DANGER}`} title="이 기간의 적용을 뺍니다 (그 날들은 시간표 수업이 빕니다)">
                  ✕ 빼기
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

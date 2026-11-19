// 쓰는 칸(NotePanel)에서 고치는 표 (P48-1 - V4 EntryTableView의 고치기 부분을 나눔, 쓰는 칸만 받는다).
//   칸을 눌러 글자를 고치고, 행·열을 더하고 뺀다. 긴 표는 쓰는 칸 전체로 스크롤한다(가로만 표 안에서).
//   Enter = 고치고 아래 칸, Tab / Shift+Tab = 옆 칸(마지막 칸에서 Tab = 새 행 - 워드처럼), Alt+Enter = 칸 안 줄 바꿈, ESC = 고치기 취소.
//   행·열을 늘려도 표 하나 3,000칸까지(붙여넣기와 같은 한도). 고치던 글은 Ctrl+S에도 함께 저장된다(누른 그때 표에 넣는다).
//   단추의 data-table-op 이름은 '단추 대신 누르기' 키가 쓴다 - 바꾸지 않는다.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { showToast } from '../../app/toast';
import { isSaveKey } from '../../ui/useSaveKey';
import { baseCellCss, TABLE_STYLE, tableSize } from '../../domain/tableCss';
import { canGrow, deleteCol, deleteRow, GROW_LIMIT_TEXT, insertCol, insertRow, setCellText } from '../../domain/tableEdit';
import type { EntryTable } from '../../data/types';
import { TableColGroup } from './EntryTableView';

interface Props {
  table: EntryTable;
  onChange: (next: EntryTable) => void;
  onRemove?: () => void;
  /** 제목 줄에 보일 이름 (예: '표 1') */
  title?: string;
  /** 처음 그릴 때 A1을 고치는 상태로 (▦ 표로 막 만든 빈 표) */
  autoEdit?: boolean;
}

export default function TableEditor({ table, onChange, onRemove, title, autoEdit }: Props) {
  const { rows: nRows, cols: nCols } = tableSize(table);
  /** 고른 칸 (줄·열 더하기/빼기의 기준) */
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  /** 글자를 고치는 칸 */
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (r: number, c: number) => {
    setSel({ r, c });
    setEditing({ r, c });
    setDraft(table.rows[r].cells[c].v);
  };

  // ▦ 표로 막 만든 빈 표 = 곧바로 A1에 친다
  const autoEditRef = useRef(autoEdit);
  useEffect(() => {
    if (autoEditRef.current && table.rows[0]?.cells[0] && !table.rows[0].cells[0].x) startEdit(0, 0);
    autoEditRef.current = false;
    // 처음 그릴 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 다음으로 옮길 칸 (가려진 칸은 건너뛴다) */
  const nextCell = (r: number, c: number, dr: number, dc: number) => {
    let nr = r;
    let nc = c;
    for (let i = 0; i < nRows * nCols; i++) {
      nc += dc;
      nr += dr;
      if (nc >= nCols) {
        nc = 0;
        nr++;
      } else if (nc < 0) {
        nc = nCols - 1;
        nr--;
      }
      if (nr < 0 || nr >= nRows) return null;
      if (!table.rows[nr].cells[nc]?.x) return { r: nr, c: nc };
    }
    return null;
  };

  const commit = (move?: { dr: number; dc: number }) => {
    if (!editing) return;
    const { r, c } = editing;
    let next = draft !== table.rows[r].cells[c].v ? setCellText(table, r, c, draft) : table;
    let target = move ? nextCell(r, c, move.dr, move.dc) : null;
    // 마지막 칸에서 Tab = 새 행 (워드처럼)
    if (!target && move?.dr === 0 && move.dc === 1) {
      if (canGrow(next, 1, 0)) {
        next = insertRow(next, next.rows.length);
        const last = next.rows.length - 1;
        const first = next.rows[last].cells.findIndex((x) => !x.x);
        if (first >= 0) target = { r: last, c: first };
      } else showToast(GROW_LIMIT_TEXT);
    }
    if (next !== table) onChange(next);
    if (target) {
      setSel(target);
      setEditing(target);
      setDraft(next.rows[target.r].cells[target.c].v);
    } else {
      setEditing(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSaveKey(e.nativeEvent)) {
      // 고치던 글을 그때 표에 넣는다 - 쓰는 칸의 Ctrl+S(document에서 받는다)가 넣은 표로 저장하게. 키는 막지 않는다
      flushSync(() => putDraft());
      return;
    }
    if (e.key === 'Escape') {
      // 칸 고치기만 멈춘다. 쓰는 칸 전체가 닫히면(전역 ESC - window에서 받는다) 적던 것이 사라진다.
      e.stopPropagation();
      e.preventDefault();
      setEditing(null);
      return;
    }
    if (e.key === 'Enter' && !e.altKey && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit({ dr: 1, dc: 0 });
      return;
    }
    if (e.key === 'Enter' && e.altKey) {
      // 엑셀처럼 Alt+Enter는 칸 안 줄 바꿈
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = el;
      setDraft((d) => d.slice(0, a) + '\n' + d.slice(b));
      requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commit({ dr: 0, dc: e.shiftKey ? -1 : 1 });
    }
  };

  /** 고치던 글을 표에 넣는다 (고치기는 이어서) */
  const putDraft = () => {
    if (!editing || draft === table.rows[editing.r].cells[editing.c].v) return;
    onChange(setCellText(table, editing.r, editing.c, draft));
  };

  const change = (fn: (t: EntryTable, at: number) => EntryTable, at: number, grow?: { rows: number; cols: number }) => {
    if (grow && !canGrow(table, grow.rows, grow.cols)) {
      showToast(GROW_LIMIT_TEXT);
      return;
    }
    // 고치던 칸이 있으면 그 글을 먼저 넣고 줄·열을 바꾼다 (고친 글이 사라지지 않게)
    const base =
      editing && draft !== table.rows[editing.r].cells[editing.c].v ? setCellText(table, editing.r, editing.c, draft) : table;
    setEditing(null);
    onChange(fn(base, at));
    setSel(null);
  };

  const btn =
    'px-2 py-1 rounded-md text-2xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-default';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden" data-note-table={table.id}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-600">
          ▦ {title || '표'} <span className="font-normal text-slate-400">· {nRows}행 × {nCols}열</span>
        </span>
        {onRemove && (
          <button
            type="button"
            data-note-table-remove={table.id}
            onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
            title="표 삭제"
            aria-label={`${title || '표'} 삭제`}
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-b border-slate-200 bg-white/60">
        <span className="text-2xs text-slate-400 mr-1">{sel ? `${sel.r + 1}행 ${sel.c + 1}열` : '칸을 누르면 고칩니다'}</span>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} disabled={!sel} onClick={() => sel && change(insertRow, sel.r, { rows: 1, cols: 0 })} title="고른 칸 위에 행 넣기" data-table-op="row-above">
          ↑ 행
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} disabled={!sel} onClick={() => sel && change(insertRow, sel.r + 1, { rows: 1, cols: 0 })} title="고른 칸 아래에 행 넣기" data-table-op="row-below">
          ↓ 행
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} disabled={!sel || nRows <= 1} onClick={() => sel && change(deleteRow, sel.r)} title="고른 칸의 행 빼기" data-table-op="row-delete">
          행 빼기
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} disabled={!sel} onClick={() => sel && change(insertCol, sel.c, { rows: 0, cols: 1 })} title="고른 칸 왼쪽에 열 넣기" data-table-op="col-left">
          ← 열
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} disabled={!sel} onClick={() => sel && change(insertCol, sel.c + 1, { rows: 0, cols: 1 })} title="고른 칸 오른쪽에 열 넣기" data-table-op="col-right">
          → 열
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} disabled={!sel || nCols <= 1} onClick={() => sel && change(deleteCol, sel.c)} title="고른 칸의 열 빼기" data-table-op="col-delete">
          열 빼기
        </button>
      </div>
      {/* 세로는 칸 안에서 따로 스크롤하지 않고 쓰는 칸 전체로 (P10-5 사용자 의견 6f), 넓은 표는 가로만 */}
      <div className="overflow-x-auto overflow-y-hidden p-2">
        <table className="border-collapse" style={TABLE_STYLE as CSSProperties}>
          <TableColGroup table={table} />
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} style={row.h ? { height: row.h } : undefined}>
                {row.cells.map((cell, c) => {
                  if (cell.x) return null;
                  const isEditing = editing?.r === r && editing?.c === c;
                  const isSel = sel?.r === r && sel?.c === c;
                  const css: CSSProperties = {
                    ...(baseCellCss(table.styles?.[cell.s ?? -1]) as CSSProperties),
                    ...(isSel ? { outline: '2px solid #2563eb', outlineOffset: -2 } : {}),
                    cursor: 'text',
                    position: isEditing ? 'relative' : undefined,
                  };
                  return (
                    <td key={c} colSpan={cell.cs} rowSpan={cell.rs} style={css} data-cell={`${r}-${c}`} onClick={() => !isEditing && startEdit(r, c)}>
                      {isEditing ? (
                        <textarea
                          ref={inputRef}
                          value={draft}
                          aria-label={`${r + 1}행 ${c + 1}열 칸`}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={onKeyDown}
                          onBlur={() => commit()}
                          rows={Math.max(1, draft.split('\n').length)}
                          className="block w-full min-w-16 resize-none bg-blue-50/60 outline-none p-0 m-0"
                          style={{ font: 'inherit', color: 'inherit', textAlign: 'inherit' }}
                        />
                      ) : (
                        cell.v
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
  );
}

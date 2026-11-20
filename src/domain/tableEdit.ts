// 메모·기록 표 고치기 - 칸 글자, 행·열 넣고 빼기 (V4 lib/entryTable.ts의 고치기 부분 - P48-1에 domain/entryTable에서 나눔).
//   쓰는 칸의 고치는 표(features/notes/TableEditor)만 부른다 - 카드가 부르는 표 그리기(EntryTableView)는 domain/tableCss만.
//   병합된 칸의 나머지 자리는 { v: '', x: 1 } (가려진 칸) - 행·열을 넣고 빼면 병합 크기가 따라간다.
import type { EntryTable, TableCell, TableRow } from '../data/types';
import { MAX_TABLE_CELLS, newTableId } from './entryTable';
import { cellWithInput, styleOf } from './tableFormat';

/** 빈 표 (쓰는 칸 ▦ 표 - P48-1, 3행 × 3열) */
export function newEmptyTable(rows = 3, cols = 3, now = Date.now()): EntryTable {
  return { id: newTableId(), createdAt: now, rows: Array.from({ length: rows }, () => ({ cells: Array.from({ length: cols }, () => ({ v: '' })) })) };
}

/** 행·열을 더 늘릴 수 있나 (표 하나 3,000칸 - 붙여넣기와 같은 한도) */
export function canGrow(t: EntryTable, addRows: number, addCols: number): boolean {
  const rows = t.rows.length + addRows;
  const cols = (t.rows[0]?.cells.length ?? 0) + addCols;
  return rows * cols <= MAX_TABLE_CELLS;
}

/** 늘릴 수 없을 때 안내 */
export const GROW_LIMIT_TEXT = `표 하나에 ${MAX_TABLE_CELLS.toLocaleString()}칸까지 둘 수 있습니다. 표를 나눠 주세요.`;

const cloneRows = (t: EntryTable): TableRow[] =>
  t.rows.map((row) => ({ ...row, cells: row.cells.map((c) => ({ ...c })) }));

/** 병합 칸 (왼쪽 위 칸의 자리와 크기) */
function anchors(rows: TableRow[]): { r: number; c: number; rs: number; cs: number }[] {
  const out: { r: number; c: number; rs: number; cs: number }[] = [];
  rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      if (!cell.x && ((cell.rs ?? 1) > 1 || (cell.cs ?? 1) > 1)) out.push({ r, c, rs: cell.rs ?? 1, cs: cell.cs ?? 1 });
    })
  );
  return out;
}

/** 칸에 글을 넣는다 - 숫자 서식이 있는 칸에 수를 치면 서식을 입힌다(P48-2 - domain/tableFormat cellWithInput) */
export function setCellText(t: EntryTable, r: number, c: number, v: string): EntryTable {
  const rows = cloneRows(t);
  const cell = rows[r]?.cells[c];
  if (!cell || cell.x) return t;
  rows[r].cells[c] = cellWithInput(cell, v, styleOf(t, cell));
  return { ...t, rows };
}

/** 줄을 at 자리에 끼운다 (at = 줄 수면 맨 아래). 새 칸은 위(없으면 아래) 줄의 서식을 따른다 */
export function insertRow(t: EntryTable, at: number): EntryTable {
  const rows = cloneRows(t);
  const n = rows[0]?.cells.length ?? 1;
  const spanning = anchors(rows).filter((a) => a.r < at && at < a.r + a.rs);
  const model = rows[at - 1] ?? rows[at];
  const cells: TableCell[] = [];
  for (let c = 0; c < n; c++) {
    const inside = spanning.some((a) => c >= a.c && c < a.c + a.cs);
    const s = model?.cells[c]?.s;
    cells.push(inside ? { v: '', x: 1 } : s !== undefined ? { v: '', s } : { v: '' });
  }
  for (const a of spanning) rows[a.r].cells[a.c].rs = a.rs + 1;
  rows.splice(at, 0, model?.h ? { h: model.h, cells } : { cells });
  return { ...t, rows };
}

/** 줄 하나를 뺀다. 병합이 걸쳐 있으면 병합을 한 줄 줄이고, 병합의 첫 줄이면 다음 줄로 넘긴다 */
export function deleteRow(t: EntryTable, at: number): EntryTable {
  if (t.rows.length <= 1) return t;
  const rows = cloneRows(t);
  for (const a of anchors(rows)) {
    if (a.r < at && at < a.r + a.rs) rows[a.r].cells[a.c].rs = a.rs - 1 > 1 ? a.rs - 1 : undefined;
    else if (a.r === at && a.rs > 1) {
      const moved = { ...rows[at].cells[a.c], rs: a.rs - 1 > 1 ? a.rs - 1 : undefined };
      delete moved.x;
      rows[at + 1].cells[a.c] = moved;
    }
  }
  rows.splice(at, 1);
  return { ...t, rows: rows.map((row) => ({ ...row, cells: row.cells.map(clean) })) };
}

/** 열을 at 자리에 끼운다 */
export function insertCol(t: EntryTable, at: number): EntryTable {
  const rows = cloneRows(t);
  const spanning = anchors(rows).filter((a) => a.c < at && at < a.c + a.cs);
  rows.forEach((row, r) => {
    const inside = spanning.some((a) => r >= a.r && r < a.r + a.rs);
    const model = row.cells[at - 1] ?? row.cells[at];
    const s = model && !model.x ? model.s : undefined;
    row.cells.splice(at, 0, inside ? { v: '', x: 1 } : s !== undefined ? { v: '', s } : { v: '' });
  });
  for (const a of spanning) rows[a.r].cells[a.c].cs = a.cs + 1;
  const cols = t.cols ? [...t.cols] : undefined;
  if (cols) cols.splice(at, 0, cols[at - 1] ?? cols[at] ?? 0);
  return { ...t, rows, ...(cols ? { cols } : {}) };
}

/** 열 하나를 뺀다 */
export function deleteCol(t: EntryTable, at: number): EntryTable {
  if ((t.rows[0]?.cells.length ?? 0) <= 1) return t;
  const rows = cloneRows(t);
  for (const a of anchors(rows)) {
    if (a.c < at && at < a.c + a.cs) rows[a.r].cells[a.c].cs = a.cs - 1 > 1 ? a.cs - 1 : undefined;
    else if (a.c === at && a.cs > 1) {
      const moved = { ...rows[a.r].cells[at], cs: a.cs - 1 > 1 ? a.cs - 1 : undefined };
      delete moved.x;
      rows[a.r].cells[at + 1] = moved;
    }
  }
  rows.forEach((row) => row.cells.splice(at, 1));
  const cols = t.cols ? t.cols.filter((_, i) => i !== at) : undefined;
  return { ...t, rows: rows.map((row) => ({ ...row, cells: row.cells.map(clean) })), ...(cols ? { cols } : {}) };
}

/** undefined 칸을 뺀다 (Firestore는 undefined를 받지 않는다) */
function clean(cell: TableCell): TableCell {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cell)) if (v !== undefined) out[k] = v;
  return out as unknown as TableCell;
}

/** 저장할 모양으로 다듬는다: undefined 없애기 */
export function tableForSave(t: EntryTable): EntryTable {
  const out: EntryTable = {
    id: t.id,
    createdAt: t.createdAt,
    rows: t.rows.map((row) => (row.h ? { h: row.h, cells: row.cells.map(clean) } : { cells: row.cells.map(clean) })),
  };
  if (t.cols) out.cols = t.cols;
  if (t.styles) out.styles = t.styles;
  return out;
}

// ───────────────────────── 고르기 (P48-1 - 칸 이름·범위·옮기기) ─────────────────────────

/** 칸 자리 (격자 - 가려진 칸 자리도 센다) */
export interface CellPos {
  r: number;
  c: number;
}

/** 범위 (위·왼쪽 r1·c1 ~ 아래·오른쪽 r2·c2, 끝 칸 포함) */
export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

/** 열 이름: 0 → A, 25 → Z, 26 → AA (엑셀과 같게) */
export function colName(c: number): string {
  let n = c + 1;
  let out = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** 칸 이름 'B2' */
export const cellName = (p: CellPos) => `${colName(p.c)}${p.r + 1}`;

/** 범위 이름 - 한 칸이면 'B2', 여럿이면 'B2:D5' */
export const rangeName = (g: CellRange) =>
  g.r1 === g.r2 && g.c1 === g.c2 ? cellName({ r: g.r1, c: g.c1 }) : `${cellName({ r: g.r1, c: g.c1 })}:${cellName({ r: g.r2, c: g.c2 })}`;

/** 칸 (r, c)를 덮는 칸 - 병합이면 그 왼쪽 위 칸과 크기, 아니면 그 칸 하나 */
export function anchorOf(t: EntryTable, r: number, c: number): { r: number; c: number; rs: number; cs: number } {
  const cell = t.rows[r]?.cells[c];
  if (cell && !cell.x) return { r, c, rs: cell.rs ?? 1, cs: cell.cs ?? 1 };
  // 가려진 칸: 왼쪽·위로 거슬러 덮는 칸을 찾는다 (병합은 100열 × 500행까지)
  for (let ar = r; ar >= 0 && ar > r - 500; ar--) {
    for (let ac = c; ac >= 0 && ac > c - 100; ac--) {
      const a = t.rows[ar]?.cells[ac];
      if (a && !a.x && ar + (a.rs ?? 1) > r && ac + (a.cs ?? 1) > c) return { r: ar, c: ac, rs: a.rs ?? 1, cs: a.cs ?? 1 };
    }
  }
  return { r, c, rs: 1, cs: 1 };
}

/** 두 칸을 끝으로 한 범위 - 걸친 병합 칸은 통째로 넣는다 (엑셀처럼) */
export function rangeOf(t: EntryTable, a: CellPos, b: CellPos): CellRange {
  const g = { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
  for (let grew = true; grew; ) {
    grew = false;
    for (let r = g.r1; r <= g.r2; r++) {
      for (let c = g.c1; c <= g.c2; c++) {
        const k = anchorOf(t, r, c);
        if (k.r < g.r1 || k.c < g.c1 || k.r + k.rs - 1 > g.r2 || k.c + k.cs - 1 > g.c2) {
          g.r1 = Math.min(g.r1, k.r);
          g.c1 = Math.min(g.c1, k.c);
          g.r2 = Math.max(g.r2, k.r + k.rs - 1);
          g.c2 = Math.max(g.c2, k.c + k.cs - 1);
          grew = true;
        }
      }
    }
  }
  return g;
}

/** 범위 안인가 */
export const inRange = (g: CellRange | null, r: number, c: number) => !!g && r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;

/** 방향키 한 번 - 병합 칸은 한 칸처럼 건너고, 끝에서는 멈춘다. 돌려주는 것은 닿은 격자 자리 */
export function moveCell(t: EntryTable, p: CellPos, dr: number, dc: number): CellPos {
  const rows = t.rows.length;
  const cols = t.rows[0]?.cells.length ?? 0;
  const k = anchorOf(t, p.r, p.c);
  let { r, c } = p;
  if (dc > 0) c = k.c + k.cs;
  else if (dc < 0) c = k.c - 1;
  if (dr > 0) r = k.r + k.rs;
  else if (dr < 0) r = k.r - 1;
  if (r < 0 || r >= rows || c < 0 || c >= cols) return p;
  return { r, c };
}

/** 범위 칸 글을 비운다 (가려진 칸은 그대로). 바뀐 것이 없으면 그 표 그대로 */
export function clearRange(t: EntryTable, g: CellRange): EntryTable {
  let changed = false;
  const rows = t.rows.map((row, r) =>
    r < g.r1 || r > g.r2
      ? row
      : {
          ...row,
          cells: row.cells.map((cell, c) => {
            if (c < g.c1 || c > g.c2 || cell.x || (cell.v === '' && cell.n === undefined)) return cell;
            changed = true;
            const out = { ...cell, v: '' };
            delete out.n;
            return out;
          }),
        }
  );
  return changed ? { ...t, rows } : t;
}

/** 행 여럿 빼기 (r1~r2) - 모두 빼지는 않는다 */
export function deleteRows(t: EntryTable, r1: number, r2: number): EntryTable {
  if (r2 - r1 + 1 >= t.rows.length) return t;
  let out = t;
  for (let r = r2; r >= r1; r--) out = deleteRow(out, r);
  return out;
}

/** 열 여럿 빼기 (c1~c2) - 모두 빼지는 않는다 */
export function deleteCols(t: EntryTable, c1: number, c2: number): EntryTable {
  if (c2 - c1 + 1 >= (t.rows[0]?.cells.length ?? 0)) return t;
  let out = t;
  for (let c = c2; c >= c1; c--) out = deleteCol(out, c);
  return out;
}

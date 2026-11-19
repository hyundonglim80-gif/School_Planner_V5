// 메모·기록 표 고치기 - 칸 글자, 행·열 넣고 빼기 (V4 lib/entryTable.ts의 고치기 부분 - P48-1에 domain/entryTable에서 나눔).
//   쓰는 칸의 고치는 표(features/notes/TableEditor)만 부른다 - 카드가 부르는 표 그리기(EntryTableView)는 domain/tableCss만.
//   병합된 칸의 나머지 자리는 { v: '', x: 1 } (가려진 칸) - 행·열을 넣고 빼면 병합 크기가 따라간다.
import type { EntryTable, TableCell, TableRow } from '../data/types';

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

export function setCellText(t: EntryTable, r: number, c: number, v: string): EntryTable {
  const rows = cloneRows(t);
  if (!rows[r]?.cells[c] || rows[r].cells[c].x) return t;
  rows[r].cells[c].v = v;
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
